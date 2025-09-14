# MCP Browser DevTools Server

An MCP (Model Context Protocol) server that connects to browser dev tools via Chrome DevTools Protocol (CDP), allowing programmatic interaction with the browser for inspection and debugging tasks.

## Features

- Get page title
- Execute JavaScript in the browser console
- Get HTML source of the current page
- Navigate to URLs

## Prerequisites

- Node.js
- Chrome browser with remote debugging enabled

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start Chrome with remote debugging:
   ```bash
   chrome --remote-debugging-port=9222
   ```

3. Start the MCP server:
   ```bash
   npm start
   ```

## Usage

This server provides tools that can be used by MCP-compatible clients to interact with the browser.

## License

MIT