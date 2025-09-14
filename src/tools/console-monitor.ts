import puppeteer, { Browser, Page } from 'puppeteer';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

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
      if (this.isMonitoring) {
        await this.stopMonitoring();
      }

      this.browser = await puppeteer.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      this.page = await this.browser.newPage();
      this.consoleMessages = [];
      this.isMonitoring = true;

      // Listen for console events
      this.page.on('console', (msg) => {
        const consoleMessage: ConsoleMessage = {
          type: msg.type() as ConsoleMessage['type'],
          message: msg.text(),
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
      });

      // Listen for page errors
      this.page.on('pageerror', (error) => {
        this.consoleMessages.push({
          type: 'error',
          message: error.message,
          timestamp: Date.now(),
        });
      });

      // Navigate to the URL
      await this.page.goto(url, { waitUntil: 'networkidle0' });

      return {
        content: [
          {
            type: 'text',
            text: `Console monitoring started for ${url}. Browser ${headless ? 'headless' : 'visible'} mode.`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to start console monitoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getMessages(type: string, limit: number): any {
    let messages = this.consoleMessages;

    if (type !== 'all') {
      messages = messages.filter((msg) => msg.type === type);
    }

    // Get the most recent messages
    messages = messages.slice(-limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            totalMessages: this.consoleMessages.length,
            filteredMessages: messages.length,
            messages: messages,
            isMonitoring: this.isMonitoring,
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
      throw new Error(`Failed to stop console monitoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async executeScript(script: string): Promise<any> {
    if (!this.page || !this.isMonitoring) {
      throw new Error('Console monitoring is not active. Start monitoring first.');
    }

    try {
      const messagesBefore = this.consoleMessages.length;
      
      // Execute the script
      const result = await this.page.evaluate(script);
      
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
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to execute script: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}