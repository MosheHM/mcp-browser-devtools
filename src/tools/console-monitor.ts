import puppeteer, { Browser, Page } from 'puppeteer';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SecurityValidator, MemoryManager, RateLimiter, TimeoutManager } from '../utils/security';

export interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: number;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export class ConsoleMonitor {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private consoleMessages: ConsoleMessage[] = [];
  private isMonitoring = false;
  private readonly MAX_CONSOLE_MESSAGES = 1000;
  private readonly SCRIPT_TIMEOUT_MS = 30000;

  getTools(): Tool[] {
    return [
      {
        name: 'console_start_monitoring',
        description: 'Start monitoring console output from a webpage',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL of the webpage to monitor',
            },
            headless: {
              type: 'boolean',
              description: 'Run browser in headless mode (default: true)',
              default: true,
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'console_get_messages',
        description: 'Get collected console messages',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['log', 'warn', 'error', 'info', 'debug', 'all'],
              description: 'Filter messages by type (default: all)',
              default: 'all',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of messages to return (default: 100)',
              default: 100,
            },
          },
        },
      },
      {
        name: 'console_clear_messages',
        description: 'Clear collected console messages',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'console_stop_monitoring',
        description: 'Stop console monitoring and close browser',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'console_execute_script',
        description: 'Execute JavaScript in the monitored page and capture console output',
        inputSchema: {
          type: 'object',
          properties: {
            script: {
              type: 'string',
              description: 'JavaScript code to execute',
            },
          },
          required: ['script'],
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'console_start_monitoring':
        return await this.startMonitoring(args.url, args.headless ?? true);
      case 'console_get_messages':
        return this.getMessages(args.type ?? 'all', args.limit ?? 100);
      case 'console_clear_messages':
        return this.clearMessages();
      case 'console_stop_monitoring':
        return await this.stopMonitoring();
      case 'console_execute_script':
        return await this.executeScript(args.script);
      default:
        throw new Error(`Unknown console tool: ${name}`);
    }
  }

  private async startMonitoring(url: string, headless: boolean): Promise<any> {
    try {
      // Validate URL
      const urlValidation = SecurityValidator.validateUrl(url);
      if (!urlValidation.isValid) {
        throw new Error(`Invalid URL: ${urlValidation.error}`);
      }

      // Rate limiting
      if (!RateLimiter.checkRateLimit(`console_monitor_${url}`, 10, 60000)) {
        throw new Error('Rate limit exceeded for console monitoring');
      }

      if (this.isMonitoring) {
        await this.stopMonitoring();
      }

      this.browser = await puppeteer.launch({
        headless: headless === false ? false : 'new', // Use new headless mode
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        timeout: 30000, // 30 second timeout
      });

      this.page = await this.browser.newPage();
      
      // Set page timeout
      this.page.setDefaultTimeout(30000);
      this.page.setDefaultNavigationTimeout(30000);

      this.consoleMessages = [];
      this.isMonitoring = true;

      // Listen for console events with memory management
      this.page.on('console', (msg) => {
        const consoleMessage: ConsoleMessage = {
          type: msg.type() as ConsoleMessage['type'],
          message: msg.text().substring(0, 1000), // Limit message length
          timestamp: Date.now(),
        };

        // Try to get location info if available
        const location = msg.location();
        if (location) {
          consoleMessage.url = location.url;
          consoleMessage.lineNumber = location.lineNumber;
          consoleMessage.columnNumber = location.columnNumber;
        }

        this.consoleMessages.push(consoleMessage);
        
        // Apply memory management
        this.consoleMessages = MemoryManager.limitArraySize(
          this.consoleMessages, 
          this.MAX_CONSOLE_MESSAGES
        );
      });

      // Listen for page errors
      this.page.on('pageerror', (error) => {
        this.consoleMessages.push({
          type: 'error',
          message: error.message.substring(0, 1000), // Limit error message length
          timestamp: Date.now(),
        });

        // Apply memory management
        this.consoleMessages = MemoryManager.limitArraySize(
          this.consoleMessages, 
          this.MAX_CONSOLE_MESSAGES
        );
      });

      // Navigate to the URL with timeout
      await this.page.goto(urlValidation.sanitized!, { 
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      return {
        content: [
          {
            type: 'text',
            text: `Console monitoring started for ${url}. Browser ${headless ? 'headless' : 'visible'} mode.`,
          },
        ],
      };
    } catch (error) {
      // Clean up on error
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        this.browser = null;
        this.page = null;
        this.isMonitoring = false;
      }
      throw new Error(`Failed to start console monitoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getMessages(type: string, limit: number): any {
    // Validate and sanitize inputs
    const sanitizedLimit = SecurityValidator.validateNumericLimit(limit, 1, 10000);
    let messages = this.consoleMessages;

    if (type !== 'all') {
      const validTypes = ['log', 'warn', 'error', 'info', 'debug'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid message type: ${type}`);
      }
      messages = messages.filter((msg) => msg.type === type);
    }

    // Get the most recent messages
    messages = messages.slice(-sanitizedLimit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            totalMessages: this.consoleMessages.length,
            filteredMessages: messages.length,
            messages: messages,
            isMonitoring: this.isMonitoring,
            memoryUsage: {
              totalItems: this.consoleMessages.length,
              maxItems: this.MAX_CONSOLE_MESSAGES,
            },
          }, null, 2),
        },
      ],
    };
  }

  private clearMessages(): any {
    const previousCount = this.consoleMessages.length;
    this.consoleMessages = [];

    return {
      content: [
        {
          type: 'text',
          text: `Cleared ${previousCount} console messages.`,
        },
      ],
    };
  }

  private async stopMonitoring(): Promise<any> {
    try {
      // Clear any timeouts
      TimeoutManager.clearAllTimeouts();
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }
      this.isMonitoring = false;

      return {
        content: [
          {
            type: 'text',
            text: 'Console monitoring stopped and browser closed.',
          },
        ],
      };
    } catch (error) {
      // Force cleanup even if there's an error
      this.browser = null;
      this.page = null;
      this.isMonitoring = false;
      throw new Error(`Failed to stop console monitoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeScript(script: string): Promise<any> {
    if (!this.page || !this.isMonitoring) {
      throw new Error('Console monitoring is not active. Start monitoring first.');
    }

    // Validate script
    const scriptValidation = SecurityValidator.validateScript(script);
    if (!scriptValidation.isValid) {
      throw new Error(`Invalid script: ${scriptValidation.error}`);
    }

    // Rate limiting for script execution
    if (!RateLimiter.checkRateLimit('script_execution', 20, 60000)) {
      throw new Error('Rate limit exceeded for script execution');
    }

    try {
      const messagesBefore = this.consoleMessages.length;
      
      // Execute the script with timeout
      const result = await Promise.race([
        this.page.evaluate(scriptValidation.sanitized!),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Script execution timeout')), this.SCRIPT_TIMEOUT_MS)
        )
      ]);
      
      // Wait a bit for console messages to be captured
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const newMessages = this.consoleMessages.slice(messagesBefore);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              scriptResult: result,
              newConsoleMessages: newMessages,
              totalMessages: this.consoleMessages.length,
              executionTime: Date.now(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to execute script: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}