const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const CDP = require('chrome-remote-interface');

class BrowserDevToolsServer {
  constructor() {
    this.server = new Server(
      {
        name: 'browser-devtools-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.client = null;
    this.setupToolHandlers();
  }

  async connectToBrowser() {
    if (this.client) return this.client;

    try {
      this.client = await CDP({
        port: 9222, // Default Chrome debugging port
      });
      console.log('Connected to browser dev tools');
      return this.client;
    } catch (error) {
      throw new Error(`Failed to connect to browser: ${error.message}`);
    }
  }

  setupToolHandlers() {
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'get_page_title',
            description: 'Get the title of the current page',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'execute_javascript',
            description: 'Execute JavaScript code in the browser console',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'JavaScript code to execute',
                },
              },
              required: ['code'],
            },
          },
          {
            name: 'get_page_source',
            description: 'Get the HTML source of the current page',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'navigate_to_url',
            description: 'Navigate to a specific URL',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL to navigate to',
                },
              },
              required: ['url'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const client = await this.connectToBrowser();
        const { Page, Runtime } = client;

        switch (name) {
          case 'get_page_title':
            const { result: titleResult } = await Runtime.evaluate({
              expression: 'document.title',
            });
            return {
              content: [{ type: 'text', text: titleResult.value || 'No title found' }],
            };

          case 'execute_javascript':
            const { result: jsResult } = await Runtime.evaluate({
              expression: args.code,
            });
            return {
              content: [{ type: 'text', text: JSON.stringify(jsResult.result) }],
            };

          case 'get_page_source':
            const { result: sourceResult } = await Runtime.evaluate({
              expression: 'document.documentElement.outerHTML',
            });
            return {
              content: [{ type: 'text', text: sourceResult.value }],
            };

          case 'navigate_to_url':
            await Page.navigate({ url: args.url });
            await Page.loadEventFired();
            return {
              content: [{ type: 'text', text: `Navigated to ${args.url}` }],
            };

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Browser DevTools MCP server running');
  }

  async close() {
    if (this.client) {
      await this.client.close();
    }
  }
}

const server = new BrowserDevToolsServer();

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

server.run().catch(console.error);