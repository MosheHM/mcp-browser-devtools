#!/usr/bin/env node

/**
 * Example usage of MCP Browser DevTools
 * This script demonstrates how to use the various tools
 */

import { ConsoleMonitor } from '../src/tools/console-monitor.js';
import { NetworkMonitor } from '../src/tools/network-monitor.js';
import { WebCoreVitalsTracker } from '../src/tools/web-core-vitals.js';
import { FileTracker } from '../src/tools/file-tracker.js';

async function demonstrateConsoleMonitoring() {
  console.log('\n=== Console Monitoring Demo ===');
  const monitor = new ConsoleMonitor();
  
  try {
    // Start monitoring a test page
    console.log('Starting console monitoring...');
    await monitor.handleTool('console_start_monitoring', {
      url: 'data:text/html,<html><head><script>console.log("Hello from page!"); console.error("Test error");</script></head><body>Test Page</body></html>',
      headless: true
    });

    // Wait a moment for console messages to be captured
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get console messages
    const messages = await monitor.handleTool('console_get_messages', {
      type: 'all',
      limit: 10
    });
    console.log('Console messages:', JSON.parse(messages.content[0].text));

    // Execute script
    const scriptResult = await monitor.handleTool('console_execute_script', {
      script: 'console.log("Executed script!"); return document.title;'
    });
    console.log('Script execution result:', JSON.parse(scriptResult.content[0].text));

  } catch (error) {
    console.error('Console monitoring error:', error.message);
  } finally {
    await monitor.handleTool('console_stop_monitoring', {});
  }
}

async function demonstrateNetworkMonitoring() {
  console.log('\n=== Network Monitoring Demo ===');
  const monitor = new NetworkMonitor();
  
  try {
    // Start monitoring
    console.log('Starting network monitoring...');
    await monitor.handleTool('network_start_monitoring', {
      url: 'https://httpbin.org/json',
      headless: true,
      interceptRequests: false
    });

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get network activity
    const activity = await monitor.handleTool('network_get_activity', {
      filter: 'all',
      limit: 10
    });
    console.log('Network activity:', JSON.parse(activity.content[0].text));

    // Get performance metrics
    const metrics = await monitor.handleTool('network_get_performance_metrics', {});
    console.log('Performance metrics:', JSON.parse(metrics.content[0].text));

  } catch (error) {
    console.error('Network monitoring error:', error.message);
  } finally {
    await monitor.handleTool('network_stop_monitoring', {});
  }
}

async function demonstrateWebCoreVitals() {
  console.log('\n=== Web Core Vitals Demo ===');
  const tracker = new WebCoreVitalsTracker();
  
  try {
    // Start monitoring
    console.log('Starting Web Core Vitals monitoring...');
    await tracker.handleTool('wcv_start_monitoring', {
      url: 'data:text/html,<html><head><style>body{font-family:Arial}</style></head><body><h1>Test Page</h1><p>Testing Web Core Vitals</p></body></html>',
      headless: true,
      continuous: false
    });

    // Wait for page to settle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Measure vitals
    const vitals = await tracker.handleTool('wcv_measure_vitals', {
      waitTime: 1
    });
    console.log('Web Core Vitals:', JSON.parse(vitals.content[0].text));

    // Get vitals history
    const history = await tracker.handleTool('wcv_get_vitals_history', {
      limit: 5
    });
    console.log('Vitals history:', JSON.parse(history.content[0].text));

  } catch (error) {
    console.error('Web Core Vitals error:', error.message);
  } finally {
    await tracker.handleTool('wcv_stop_monitoring', {});
  }
}

async function demonstrateFileTracking() {
  console.log('\n=== File Tracking Demo ===');
  const tracker = new FileTracker();
  
  try {
    // Start tracking
    console.log('Starting file tracking...');
    await tracker.handleTool('file_start_tracking', {
      url: 'data:text/html,<html><head><link rel="stylesheet" href="data:text/css,body{color:red}"><script src="data:text/javascript,console.log("script loaded")"></script></head><body>Test Page</body></html>',
      headless: true,
      captureContent: true
    });

    // Wait for resources to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get tracked resources
    const resources = await tracker.handleTool('file_get_resources', {
      type: 'all',
      limit: 10
    });
    console.log('Tracked resources:', JSON.parse(resources.content[0].text));

    // Watch filesystem (demonstration)
    const watchResult = await tracker.handleTool('file_watch_filesystem', {
      paths: ['/tmp/test-watch']
    });
    console.log('Filesystem watching:', JSON.parse(watchResult.content[0].text));

  } catch (error) {
    console.error('File tracking error:', error.message);
  } finally {
    await tracker.handleTool('file_stop_tracking', {});
  }
}

async function main() {
  console.log('MCP Browser DevTools Example Usage');
  console.log('===================================');

  try {
    await demonstrateConsoleMonitoring();
    await demonstrateNetworkMonitoring();
    await demonstrateWebCoreVitals();
    await demonstrateFileTracking();
    
    console.log('\n✅ All demos completed successfully!');
  } catch (error) {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  }
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}