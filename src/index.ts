#!/usr/bin/env node

import { BrowserDevToolsServer } from './server.js';
import { DevToolsConfigSchema } from './types.js';

/**
 * Main entry point for the MCP Browser DevTools Server
 */
async function main(): Promise<void> {
  try {
    // Parse configuration from environment variables or use secure defaults
    const config = DevToolsConfigSchema.parse({
      port: process.env.DEVTOOLS_PORT ? parseInt(process.env.DEVTOOLS_PORT, 10) : undefined,
      host: process.env.DEVTOOLS_HOST || undefined,
      timeout: process.env.DEVTOOLS_TIMEOUT ? parseInt(process.env.DEVTOOLS_TIMEOUT, 10) : undefined,
      maxRetries: process.env.DEVTOOLS_MAX_RETRIES ? parseInt(process.env.DEVTOOLS_MAX_RETRIES, 10) : undefined,
      secureMode: process.env.DEVTOOLS_SECURE_MODE !== 'false',
      maxExecutionTime: process.env.DEVTOOLS_MAX_EXECUTION_TIME ? parseInt(process.env.DEVTOOLS_MAX_EXECUTION_TIME, 10) : undefined,
    });

    console.error('Starting MCP Browser DevTools Server...');
    console.error(`Configuration: ${JSON.stringify(config, null, 2)}`);

    // Create and start the server
    const server = new BrowserDevToolsServer(config);
    await server.start();

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the server
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});