# MCP Browser DevTools

A Model Context Protocol (MCP) server that provides comprehensive browser developer tools capabilities including console output monitoring, network activity tracking, Web Core Vitals measurement, and file resource tracking.

## Features

### 🖥️ Console Monitoring
- Real-time console output capture (log, warn, error, info, debug)
- JavaScript execution with console output tracking
- Console message filtering and history
- Error tracking with source location information

### 🌐 Network Monitoring  
- HTTP request/response tracking
- Network performance metrics
- Request/response headers and timing
- Failed request monitoring
- Cache hit rate analysis

### 📊 Web Core Vitals Tracking
- Largest Contentful Paint (LCP)
- First Input Delay (FID) 
- Cumulative Layout Shift (CLS)
- First Contentful Paint (FCP)
- Time to First Byte (TTFB)
- Lighthouse integration for performance auditing
- Continuous monitoring capabilities

### 📁 File Resource Tracking
- Resource loading monitoring (scripts, styles, images, etc.)
- File download tracking
- Resource optimization suggestions
- Filesystem change monitoring
- Content capture for text-based resources

## Installation

```bash
npm install
npm run build
```

## Usage

### As MCP Server

Start the server:
```bash
npm start
```

The server runs on stdio and provides the following tool categories:

#### Console Tools
- `console_start_monitoring` - Start monitoring console output
- `console_get_messages` - Get collected console messages  
- `console_clear_messages` - Clear console message history
- `console_execute_script` - Execute JavaScript and capture output
- `console_stop_monitoring` - Stop console monitoring

#### Network Tools
- `network_start_monitoring` - Start network activity monitoring
- `network_get_activity` - Get network requests/responses
- `network_get_performance_metrics` - Get detailed performance metrics
- `network_navigate` - Navigate to new URL while monitoring
- `network_clear_activity` - Clear network activity history
- `network_stop_monitoring` - Stop network monitoring

#### Web Core Vitals Tools
- `wcv_start_monitoring` - Start Web Core Vitals monitoring
- `wcv_measure_vitals` - Measure current vitals
- `wcv_run_lighthouse` - Run Lighthouse performance audit
- `wcv_get_vitals_history` - Get historical vitals data
- `wcv_get_performance_entries` - Get browser performance entries
- `wcv_simulate_user_interaction` - Simulate user interactions for FID
- `wcv_stop_monitoring` - Stop vitals monitoring

#### File Tracking Tools
- `file_start_tracking` - Start tracking file resources
- `file_get_resources` - Get tracked file resources
- `file_download_resource` - Download specific resources
- `file_get_downloads` - Get download history
- `file_analyze_resource` - Analyze resource performance
- `file_watch_filesystem` - Watch filesystem for changes
- `file_get_filesystem_changes` - Get filesystem change history
- `file_clear_tracking_data` - Clear all tracking data
- `file_stop_tracking` - Stop file tracking

## Tool Examples

### Console Monitoring
```javascript
// Start monitoring console output
{
  "name": "console_start_monitoring",
  "arguments": {
    "url": "https://example.com",
    "headless": true
  }
}

// Execute JavaScript and capture console output
{
  "name": "console_execute_script", 
  "arguments": {
    "script": "console.log('Hello World'); console.error('Test error');"
  }
}

// Get console messages filtered by type
{
  "name": "console_get_messages",
  "arguments": {
    "type": "error",
    "limit": 50
  }
}
```

### Network Monitoring
```javascript
// Start network monitoring with request interception
{
  "name": "network_start_monitoring",
  "arguments": {
    "url": "https://example.com",
    "interceptRequests": true
  }
}

// Get network activity filtered by resource type
{
  "name": "network_get_activity",
  "arguments": {
    "filter": "requests",
    "resourceType": "script",
    "limit": 100
  }
}

// Get performance metrics
{
  "name": "network_get_performance_metrics",
  "arguments": {}
}
```

### Web Core Vitals
```javascript
// Start monitoring with continuous measurement
{
  "name": "wcv_start_monitoring",
  "arguments": {
    "url": "https://example.com",
    "continuous": true
  }
}

// Measure current vitals
{
  "name": "wcv_measure_vitals",
  "arguments": {
    "waitTime": 5
  }
}

// Run Lighthouse audit
{
  "name": "wcv_run_lighthouse",
  "arguments": {
    "categories": ["performance", "accessibility"],
    "device": "mobile"
  }
}
```

### File Tracking
```javascript
// Start file tracking with content capture
{
  "name": "file_start_tracking",
  "arguments": {
    "url": "https://example.com",
    "captureContent": true,
    "downloadPath": "/tmp/downloads"
  }
}

// Get large image resources
{
  "name": "file_get_resources",
  "arguments": {
    "type": "image",
    "minSize": 100000,
    "limit": 20
  }
}

// Analyze specific resource
{
  "name": "file_analyze_resource",
  "arguments": {
    "url": "https://example.com/script.js"
  }
}
```

## Architecture

The server is built with:
- **TypeScript** for type safety
- **Puppeteer** for browser automation
- **MCP SDK** for protocol compliance
- **Lighthouse** for performance auditing

### Tool Structure
Each tool category is implemented as a separate class:
- `ConsoleMonitor` - Console output tracking
- `NetworkMonitor` - Network activity monitoring  
- `WebCoreVitalsTracker` - Performance metrics collection
- `FileTracker` - Resource and file monitoring

## Development

### Running Tests
```bash
npm test
```

### Development Mode
```bash
npm run dev
```

### Building
```bash
npm run build
```

## Requirements

- Node.js >= 18.0.0
- Chrome/Chromium browser (for Puppeteer)

## Configuration

The server automatically handles browser launching and management. Key configurations:

- **Headless Mode**: Control browser visibility
- **Download Paths**: Customize file download locations  
- **Content Capture**: Enable/disable content capture for analysis
- **Continuous Monitoring**: Enable automatic periodic measurements

## Performance Considerations

- Browser instances are properly cleaned up when monitoring stops
- Content capture can be disabled to reduce memory usage
- Download paths should have sufficient disk space
- Continuous monitoring intervals are optimized for performance

## Troubleshooting

### Common Issues

1. **Browser Launch Failures**: Ensure Chrome/Chromium is installed
2. **Permission Errors**: Check write permissions for download paths
3. **Network Timeouts**: Adjust timeout settings for slow networks
4. **Memory Usage**: Disable content capture for large sites

### Debug Mode

Set environment variable for verbose logging:
```bash
DEBUG=true npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality  
4. Submit a pull request

## License

MIT License - see LICENSE file for details.