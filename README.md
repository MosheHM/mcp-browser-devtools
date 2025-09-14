# MCP Browser DevTools Server

A modern, secure MCP (Model Context Protocol) server written in TypeScript that provides safe browser automation and inspection capabilities through the Chrome DevTools Protocol (CDP).

## 🚀 Features

### Core Capabilities
- **Secure JavaScript Execution**: Execute JavaScript in the browser with comprehensive security constraints
- **Safe Navigation**: Navigate to URLs with protocol validation and security checks
- **Page Inspection**: Retrieve page information, source code, and take screenshots
- **Connection Management**: Robust connection handling with automatic retries and timeouts
- **Security Monitoring**: Check page security state and connection status

### Security Features
- **Input Validation**: All inputs are validated using Zod schemas with strict constraints
- **Code Injection Prevention**: Blocks dangerous JavaScript patterns (eval, Function, etc.)
- **Localhost-Only Connections**: Restricts DevTools connections to localhost for security
- **Execution Limits**: Configurable timeouts and size limits for all operations
- **Protocol Restrictions**: Only allows HTTP/HTTPS URLs for navigation
- **Memory Protection**: Limits on source code size and execution time

### Modern Architecture
- **TypeScript**: Full type safety with comprehensive type definitions
- **Latest MCP SDK**: Built with MCP SDK v1.18.0 for optimal compatibility
- **ESM Modules**: Modern ES module support
- **Error Handling**: Comprehensive error handling and graceful degradation
- **Configuration**: Environment-based configuration with secure defaults

## 📋 Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **Chrome/Chromium**: Browser with remote debugging enabled
- **MCP Client**: Any MCP-compatible client (Claude Desktop, etc.)

## 🛠️ Installation & Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Chrome with Remote Debugging

```bash
# Linux/macOS
google-chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check

# Windows
chrome.exe --remote-debugging-port=9222 --no-first-run --no-default-browser-check
```

### 3. Build the Server

```bash
npm run build
```

### 4. Start the MCP Server

```bash
npm start
```

## ⚙️ Configuration

The server can be configured using environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DEVTOOLS_PORT` | `9222` | Chrome DevTools port (1024-65535) |
| `DEVTOOLS_HOST` | `localhost` | DevTools host (localhost/127.0.0.1/::1 only) |
| `DEVTOOLS_TIMEOUT` | `10000` | Connection timeout in milliseconds |
| `DEVTOOLS_MAX_RETRIES` | `3` | Maximum connection retry attempts |
| `DEVTOOLS_SECURE_MODE` | `true` | Enable enhanced security validations |
| `DEVTOOLS_MAX_EXECUTION_TIME` | `5000` | JavaScript execution timeout in milliseconds |

### Example Configuration

```bash
export DEVTOOLS_PORT=9222
export DEVTOOLS_HOST=localhost
export DEVTOOLS_SECURE_MODE=true
npm start
```

## 🔧 Available Tools

### Connection Management

#### `get_connection_status`
Check the current status of the browser DevTools connection.
- **Input**: None
- **Output**: Connection status with target information

#### `get_server_config`
Display current server configuration and security settings.
- **Input**: None
- **Output**: Server configuration details

### Page Information

#### `get_page_info`
Retrieve comprehensive information about the current page.
- **Input**: None
- **Output**: Page title, URL, ready state, and timestamp

#### `get_page_source`
Get the HTML source of the current page with size limits.
- **Input**: None
- **Output**: Page HTML source (max 1MB for security)

#### `get_security_state`
Check the security state of the current page.
- **Input**: None
- **Output**: Security state (secure, insecure, unknown, etc.)

### Browser Automation

#### `execute_javascript`
Execute JavaScript code with security constraints.
- **Input**: 
  - `code` (string): JavaScript code to execute (max 10,000 chars)
  - `timeout` (optional): Execution timeout in milliseconds (100-10000)
- **Security**: Blocks eval, Function, setTimeout, and other dangerous patterns
- **Output**: Execution result as JSON

#### `navigate_to_url`
Navigate the browser to a specific URL.
- **Input**:
  - `url` (string): URL to navigate to (HTTP/HTTPS only)
  - `waitForLoad` (boolean, default: true): Wait for page load event
  - `timeout` (number, default: 10000): Navigation timeout
- **Output**: Navigation success confirmation with page info

#### `take_screenshot`
Capture a screenshot of the current page.
- **Input**: None
- **Output**: Base64-encoded PNG screenshot data

## 🔒 Security Considerations

### Input Validation
- All inputs are validated using Zod schemas
- String lengths are limited to prevent memory exhaustion
- URLs are validated and restricted to HTTP/HTTPS protocols
- Numeric inputs have strict ranges

### Code Execution Safety
- JavaScript execution is sandboxed in the browser context
- Dangerous functions like `eval()`, `Function()`, and `setTimeout()` are blocked
- Execution time is limited to prevent infinite loops
- Return values are safely serialized

### Network Security
- Only localhost connections are allowed (127.0.0.1, ::1, localhost)
- Chrome DevTools port must be in the safe range (1024-65535)
- Connection timeouts prevent hanging connections
- No external network access from the server itself

### Resource Limits
- Page source is limited to 1MB to prevent memory issues
- JavaScript code is limited to 10,000 characters
- Screenshot capture uses reasonable compression settings
- All operations have configurable timeouts

## 🧪 Development

### Building

```bash
npm run build        # Build TypeScript to JavaScript
npm run watch        # Watch mode for development
npm run clean        # Clean build directory
```

### Code Quality

```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues automatically
npm run format       # Format code with Prettier
npm run type-check   # Type check without building
```

### Project Structure

```
src/
├── index.ts              # Main entry point
├── server.ts             # MCP server implementation
├── browser-client.ts     # Secure DevTools client
├── types.ts              # Type definitions and schemas
└── types/
    └── chrome-remote-interface.d.ts  # CDP type definitions
```

## 🔍 Usage Examples

### Basic Page Information
```typescript
// Get current page details
const pageInfo = await callTool('get_page_info');
console.log(pageInfo); // { title, url, readyState, timestamp }
```

### Safe JavaScript Execution
```typescript
// Execute safe JavaScript
const result = await callTool('execute_javascript', {
  code: 'document.querySelectorAll("a").length',
  timeout: 3000
});
console.log(`Found ${result} links on the page`);
```

### Secure Navigation
```typescript
// Navigate to a secure URL
await callTool('navigate_to_url', {
  url: 'https://example.com',
  waitForLoad: true,
  timeout: 15000
});
```

## 🚨 Troubleshooting

### Connection Issues
1. **Ensure Chrome is running with debugging enabled**:
   ```bash
   chrome --remote-debugging-port=9222
   ```

2. **Check if port is available**:
   ```bash
   netstat -an | grep 9222
   ```

3. **Verify localhost access**:
   ```bash
   curl http://localhost:9222/json
   ```

### Permission Errors
- Make sure Chrome has necessary permissions
- Check firewall settings for local connections
- Ensure no other processes are using the DevTools port

### Security Warnings
- Only connect to trusted local Chrome instances
- Never expose DevTools ports to external networks
- Keep the server updated with latest security patches

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run linting and type checking
5. Submit a pull request

## 🆕 Changelog

### v2.0.0
- Complete rewrite in TypeScript
- Upgraded to MCP SDK v1.18.0
- Enhanced security features
- Modern ES module architecture
- Comprehensive input validation
- Improved error handling and logging