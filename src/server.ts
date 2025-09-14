import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SecureBrowserClient } from './browser-client.js';
import {
  DevToolsConfigSchema,
  JavaScriptExecutionSchema,
  NavigationSchema,
  type DevToolsConfig,
} from './types.js';

/**
 * Secure MCP Browser DevTools Server
 * 
 * Provides secure browser automation and inspection capabilities through
 * the Chrome DevTools Protocol with comprehensive security measures.
 */
export class BrowserDevToolsServer {
  private readonly server: McpServer;
  private readonly browserClient: SecureBrowserClient;
  private readonly config: DevToolsConfig;

  constructor(config?: Partial<DevToolsConfig>) {
    // Validate and set configuration with security defaults
    this.config = DevToolsConfigSchema.parse(config || {});
    
    // Initialize secure browser client
    this.browserClient = new SecureBrowserClient(this.config);

    // Initialize MCP server with enhanced metadata
    this.server = new McpServer({
      name: 'browser-devtools-server',
      version: '2.0.0',
    }, {
      capabilities: {
        tools: {},
        logging: {},
      },
      instructions: `
        Secure Browser DevTools MCP Server
        
        This server provides safe browser automation and inspection capabilities:
        - JavaScript execution with security constraints
        - Page navigation with URL validation  
        - Safe DOM inspection and manipulation
        - Screenshot capture
        - Security state monitoring
        
        All operations are performed with security best practices including:
        - Input validation and sanitization
        - Execution timeouts and limits
        - Localhost-only connections
        - Code injection prevention
      `,
    });

    this.registerTools();
    this.setupErrorHandling();
  }

  /**
   * Register all secure DevTools capabilities as MCP tools
   */
  private registerTools(): void {
    // Connection management
    this.server.registerTool(
      'get_connection_status',
      {
        title: 'Get Connection Status',
        description: 'Check the current status of the browser DevTools connection',
        inputSchema: {},
      },
      async () => {
        try {
          const status = await this.browserClient.getConnectionStatus();
          return {
            content: [{
              type: 'text',
              text: `Connection Status:\n${JSON.stringify(status, null, 2)}`,
            }],
          };
        } catch (error) {
          return this.createErrorResponse(error as Error);
        }
      }
    );

    // Page information
    this.server.registerTool(
      'get_page_info',
      {
        title: 'Get Page Information',
        description: 'Retrieve comprehensive information about the current page',
        inputSchema: {},
      },
      async () => {
        try {
          const pageInfo = await this.browserClient.getPageInfo();
          return {
            content: [{
              type: 'text',
              text: `Page Information:\n${JSON.stringify(pageInfo, null, 2)}`,
            }],
          };
        } catch (error) {
          return this.createErrorResponse(error as Error);
        }
      }
    );

    // Safe JavaScript execution
    this.server.registerTool(
      'execute_javascript',
      {
        title: 'Execute JavaScript',
        description: 'Execute JavaScript code in the browser with security constraints',
        inputSchema: {
          code: z.string()
            .min(1, 'JavaScript code cannot be empty')
            .max(10000, 'Code too long for security (max 10,000 characters)')
            .describe('JavaScript code to execute (eval, Function, setTimeout not allowed)'),
          timeout: z.number().int().min(100).max(10000).optional()
            .describe('Execution timeout in milliseconds (100-10000)'),
        },
      },
      async ({ code, timeout }) => {
        try {
          // Validate input
          const validated = JavaScriptExecutionSchema.parse({ code, timeout });
          
          const result = await this.browserClient.executeJavaScript(
            validated.code,
            validated.timeout
          );

          return {
            content: [{
              type: 'text',
              text: `JavaScript Result:\n${JSON.stringify(result, null, 2)}`,
            }],
          };
        } catch (error) {
          return this.createErrorResponse(error as Error);
        }
      }
    );

    // Page navigation
    this.server.registerTool(
      'navigate_to_url',
      {
        title: 'Navigate to URL',
        description: 'Navigate the browser to a specific URL (HTTP/HTTPS only)',
        inputSchema: {
          url: z.string().url().describe('URL to navigate to (must be HTTP or HTTPS)'),
          waitForLoad: z.boolean().default(true)
            .describe('Whether to wait for the page load event'),
          timeout: z.number().int().min(1000).max(30000).default(10000)
            .describe('Navigation timeout in milliseconds'),
        },
      },
      async ({ url, waitForLoad = true, timeout = 10000 }) => {
        try {
          // Validate input
          const validated = NavigationSchema.parse({ url, waitForLoad, timeout });
          
          await this.browserClient.navigateToUrl(
            validated.url,
            validated.waitForLoad,
            validated.timeout
          );

          const pageInfo = await this.browserClient.getPageInfo();
          
          return {
            content: [{
              type: 'text',
              text: `Successfully navigated to: ${validated.url}\nCurrent page info:\n${JSON.stringify(pageInfo, null, 2)}`,
            }],
          };
        } catch (error) {
          return this.createErrorResponse(error as Error);
        }
      }
    );

    // Page source retrieval
    this.server.registerTool(
      'get_page_source',
      {
        title: 'Get Page Source',
        description: 'Retrieve the HTML source of the current page (size limited for security)',
        inputSchema: {},
      },
      async () => {
        try {
          const source = await this.browserClient.getPageSource();
          return {
            content: [{
              type: 'text',
              text: `Page Source (${source.length} characters):\n${source}`,
            }],
          };
        } catch (error) {
          return this.createErrorResponse(error as Error);
        }
      }
    );

    // Screenshot capture
    this.server.registerTool(
      'take_screenshot',
      {
        title: 'Take Screenshot',
        description: 'Capture a screenshot of the current page',
        inputSchema: {},
      },
      async () => {
        try {
          const screenshot = await this.browserClient.takeScreenshot();
          return {
            content: [{
              type: 'text',
              text: `Screenshot captured successfully (${screenshot.length} bytes base64 data)`,
            }, {
              type: 'text',
              text: `data:image/png;base64,${screenshot.substring(0, 100)}...`,
            }],
          };
        } catch (error) {
          return this.createErrorResponse(error as Error);
        }
      }
    );

    // Security state monitoring
    this.server.registerTool(
      'get_security_state',
      {
        title: 'Get Security State',
        description: 'Check the security state of the current page',
        inputSchema: {},
      },
      async () => {
        try {
          const securityState = await this.browserClient.getSecurityState();
          return {
            content: [{
              type: 'text',
              text: `Security State: ${securityState}`,
            }],
          };
        } catch (error) {
          return this.createErrorResponse(error as Error);
        }
      }
    );

    // Server configuration info
    this.server.registerTool(
      'get_server_config',
      {
        title: 'Get Server Configuration',
        description: 'Display current server configuration and security settings',
        inputSchema: {},
      },
      async () => {
        return {
          content: [{
            type: 'text',
            text: `Server Configuration:\n${JSON.stringify(this.config, null, 2)}`,
          }],
        };
      }
    );
  }

  /**
   * Create a standardized error response
   */
  private createErrorResponse(error: Error): { content: Array<{ type: 'text'; text: string }>; isError: true } {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`,
      }],
      isError: true,
    };
  }

  /**
   * Set up error handling and cleanup
   */
  private setupErrorHandling(): void {
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      await this.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.close();
      process.exit(0);
    });

    // Handle unexpected errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      void this.close().finally(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection:', reason);
      void this.close().finally(() => process.exit(1));
    });
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Secure Browser DevTools MCP server started successfully');
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Clean shutdown
   */
  async close(): Promise<void> {
    try {
      await this.browserClient.disconnect();
      console.error('Browser DevTools MCP server closed');
    } catch (error) {
      console.error('Error during server shutdown:', error);
    }
  }
}