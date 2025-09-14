#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { ConsoleMonitor } from './tools/console-monitor.js';
import { NetworkMonitor } from './tools/network-monitor.js';
import { WebCoreVitalsTracker } from './tools/web-core-vitals.js';
import { FileTracker } from './tools/file-tracker.js';

class BrowserDevToolsServer {
  private server: Server;
  private consoleMonitor: ConsoleMonitor;
  private networkMonitor: NetworkMonitor;
  private webCoreVitalsTracker: WebCoreVitalsTracker;
  private fileTracker: FileTracker;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-browser-devtools',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.consoleMonitor = new ConsoleMonitor();
    this.networkMonitor = new NetworkMonitor();
    this.webCoreVitalsTracker = new WebCoreVitalsTracker();
    this.fileTracker = new FileTracker();

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          ...this.consoleMonitor.getTools(),
          ...this.networkMonitor.getTools(),
          ...this.webCoreVitalsTracker.getTools(),
          ...this.fileTracker.getTools(),
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Route to appropriate tool handler
        if (name.startsWith('console_')) {
          return await this.consoleMonitor.handleTool(name, args);
        } else if (name.startsWith('network_')) {
          return await this.networkMonitor.handleTool(name, args);
        } else if (name.startsWith('wcv_')) {
          return await this.webCoreVitalsTracker.handleTool(name, args);
        } else if (name.startsWith('file_')) {
          return await this.fileTracker.handleTool(name, args);
        }

        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Browser DevTools Server running on stdio');
  }
}

const server = new BrowserDevToolsServer();
server.run().catch(console.error);