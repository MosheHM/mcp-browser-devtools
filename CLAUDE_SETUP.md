# MCP Browser DevTools - Claude Desktop Integration

This guide shows how to integrate the MCP Browser DevTools Server with Claude Desktop.

## Setup Instructions

### 1. Install the Server

```bash
# Clone or download the repository
cd mcp-browser-devtools
npm install
npm run build
```

### 2. Configure Claude Desktop

Add the following configuration to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "browser-devtools": {
      "command": "node",
      "args": ["/path/to/mcp-browser-devtools/dist/index.js"],
      "env": {
        "DEVTOOLS_PORT": "9222",
        "DEVTOOLS_HOST": "localhost",
        "DEVTOOLS_SECURE_MODE": "true",
        "DEVTOOLS_MAX_EXECUTION_TIME": "5000"
      }
    }
  }
}
```

### 3. Start Chrome with DevTools

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --no-first-run --no-default-browser-check

# Linux
google-chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check
```

### 4. Restart Claude Desktop

Restart Claude Desktop to load the new MCP server configuration.

## Usage Examples

Once configured, you can use the following commands in Claude Desktop:

### Getting Page Information
```
Can you check what page is currently open in the browser?
```

### Safe JavaScript Execution
```
Please execute this JavaScript in the browser: document.querySelectorAll('h1').length
```

### Navigation
```
Navigate the browser to https://example.com and wait for it to load
```

### Page Source Analysis
```
Get the HTML source of the current page and tell me about its structure
```

### Screenshots
```
Take a screenshot of the current page
```

## Available Tools

The following tools will be available in Claude Desktop:

1. **get_connection_status** - Check browser connection
2. **get_page_info** - Get current page details
3. **execute_javascript** - Run safe JavaScript
4. **navigate_to_url** - Navigate to URLs
5. **get_page_source** - Retrieve page HTML
6. **take_screenshot** - Capture page screenshots
7. **get_security_state** - Check page security
8. **get_server_config** - View server settings

## Security Notes

- The server only connects to localhost Chrome instances
- JavaScript execution is sandboxed and limited
- Dangerous code patterns are automatically blocked
- All operations have timeout and size limits
- Only HTTP/HTTPS URLs are allowed for navigation

## Troubleshooting

### Chrome Not Connected
1. Ensure Chrome is running with `--remote-debugging-port=9222`
2. Check if port 9222 is available: `netstat -an | grep 9222`
3. Verify Claude Desktop configuration path and syntax

### Permission Errors
1. Check file permissions on the script path
2. Ensure Node.js is in the system PATH
3. Verify Chrome has necessary permissions

### Security Warnings
1. Ensure `DEVTOOLS_SECURE_MODE` is set to `true`
2. Only use with trusted local Chrome instances
3. Never expose DevTools port to external networks

## Advanced Configuration

### Custom Chrome Profile
```bash
chrome --remote-debugging-port=9222 --user-data-dir=/path/to/profile --no-first-run
```

### Multiple Browser Instances
```json
{
  "mcpServers": {
    "browser-devtools-main": {
      "command": "node",
      "args": ["/path/to/mcp-browser-devtools/dist/index.js"],
      "env": {
        "DEVTOOLS_PORT": "9222"
      }
    },
    "browser-devtools-secondary": {
      "command": "node", 
      "args": ["/path/to/mcp-browser-devtools/dist/index.js"],
      "env": {
        "DEVTOOLS_PORT": "9223"
      }
    }
  }
}
```

### Environment Variables

| Variable | Purpose | Default | Example |
|----------|---------|---------|---------|
| `DEVTOOLS_PORT` | Chrome debug port | 9222 | 9222 |
| `DEVTOOLS_HOST` | Connection host | localhost | localhost |
| `DEVTOOLS_TIMEOUT` | Connection timeout (ms) | 10000 | 15000 |
| `DEVTOOLS_SECURE_MODE` | Enhanced security | true | true |
| `DEVTOOLS_MAX_EXECUTION_TIME` | JS timeout (ms) | 5000 | 3000 |

## Examples

### Web Scraping
```
Navigate to https://news.ycombinator.com and get me the titles of the top 5 articles
```

### Form Automation
```
Go to https://example.com/contact and fill out the form with test data
```

### Page Analysis
```
Analyze the current page's SEO elements - check for title, meta description, and heading structure
```

### Performance Testing
```
Take a screenshot of the page and measure how long it takes to load the main content
```