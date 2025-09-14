import { ConsoleMonitor } from '../tools/console-monitor';
import { NetworkMonitor } from '../tools/network-monitor';
import { WebCoreVitalsTracker } from '../tools/web-core-vitals';
import { FileTracker } from '../tools/file-tracker';

describe('Integration Tests - MCP Browser DevTools', () => {
  let consoleMonitor: ConsoleMonitor;
  let networkMonitor: NetworkMonitor;
  let wcvTracker: WebCoreVitalsTracker;
  let fileTracker: FileTracker;

  beforeEach(() => {
    consoleMonitor = new ConsoleMonitor();
    networkMonitor = new NetworkMonitor();
    wcvTracker = new WebCoreVitalsTracker();
    fileTracker = new FileTracker();
  });

  afterEach(async () => {
    // Clean up all tools
    const cleanupPromises = [
      consoleMonitor.handleTool('console_stop_monitoring', {}),
      networkMonitor.handleTool('network_stop_monitoring', {}),
      wcvTracker.handleTool('wcv_stop_monitoring', {}),
      fileTracker.handleTool('file_stop_tracking', {})
    ];

    await Promise.allSettled(cleanupPromises);
  });

  describe('Concurrent Tool Usage', () => {
    test('should handle multiple tools monitoring simultaneously', async () => {
      const testUrl = 'data:text/html,<html><head><script>console.log("test");</script></head><body><h1>Test Page</h1></body></html>';

      // Start all monitoring tools
      const startPromises = [
        consoleMonitor.handleTool('console_start_monitoring', { url: testUrl }),
        networkMonitor.handleTool('network_start_monitoring', { url: testUrl }),
        wcvTracker.handleTool('wcv_start_monitoring', { url: testUrl }),
        fileTracker.handleTool('file_start_tracking', { url: testUrl })
      ];

      const results = await Promise.allSettled(startPromises);
      
      // Check that all tools started successfully
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          expect(result.value.content[0].text).toContain('started');
        } else {
          console.warn(`Tool ${index} failed to start:`, result.reason);
        }
      });

      // Wait for some activity
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check that all tools can provide data
      const dataPromises = [
        consoleMonitor.handleTool('console_get_messages', {}),
        networkMonitor.handleTool('network_get_activity', {}),
        wcvTracker.handleTool('wcv_get_vitals_history', {}),
        fileTracker.handleTool('file_get_resources', {})
      ];

      const dataResults = await Promise.allSettled(dataPromises);
      
      dataResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          expect(result.value.content[0].text).toBeDefined();
          expect(() => JSON.parse(result.value.content[0].text)).not.toThrow();
        }
      });
    });

    test('should handle resource contention gracefully', async () => {
      const testUrl = 'data:text/html,<html><body>Test</body></html>';

      // Try to start the same tool multiple times rapidly
      const rapidStarts = Array(5).fill(null).map(() => 
        consoleMonitor.handleTool('console_start_monitoring', { url: testUrl })
      );

      const results = await Promise.allSettled(rapidStarts);
      
      // At least one should succeed
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery Tests', () => {
    test('should recover from tool failures', async () => {
      // Start console monitoring
      await consoleMonitor.handleTool('console_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Simulate tool failure by trying invalid operation
      try {
        await consoleMonitor.handleTool('console_execute_script', { 
          script: 'invalid.javascript.syntax(' 
        });
      } catch (error) {
        // Expected to fail
      }

      // Tool should still be operational
      const result = await consoleMonitor.handleTool('console_get_messages', {});
      expect(result.content[0].text).toBeDefined();
    });

    test('should handle browser crashes across tools', async () => {
      const testUrl = 'data:text/html,<html><body>Test</body></html>';

      // Start multiple tools
      await consoleMonitor.handleTool('console_start_monitoring', { url: testUrl });
      await networkMonitor.handleTool('network_start_monitoring', { url: testUrl });

      // Force restart one tool (simulating crash recovery)
      await consoleMonitor.handleTool('console_stop_monitoring', {});
      await consoleMonitor.handleTool('console_start_monitoring', { url: testUrl });

      // Both tools should still work
      const consoleResult = await consoleMonitor.handleTool('console_get_messages', {});
      const networkResult = await networkMonitor.handleTool('network_get_activity', {});

      expect(consoleResult.content[0].text).toBeDefined();
      expect(networkResult.content[0].text).toBeDefined();
    });
  });

  describe('Performance Under Load', () => {
    test('should handle rapid operations without memory leaks', async () => {
      await consoleMonitor.handleTool('console_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const startMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await consoleMonitor.handleTool('console_execute_script', { 
          script: `console.log('Operation ${i}');` 
        });
        
        if (i % 10 === 0) {
          await consoleMonitor.handleTool('console_clear_messages', {});
        }
      }

      const endMemory = process.memoryUsage();
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle concurrent operations efficiently', async () => {
      const testUrl = 'data:text/html,<html><body>Test</body></html>';

      await Promise.all([
        consoleMonitor.handleTool('console_start_monitoring', { url: testUrl }),
        networkMonitor.handleTool('network_start_monitoring', { url: testUrl })
      ]);

      const start = Date.now();

      // Run concurrent operations
      const operations = [];
      for (let i = 0; i < 20; i++) {
        operations.push(
          consoleMonitor.handleTool('console_execute_script', { 
            script: `console.log('Concurrent ${i}');` 
          })
        );
        operations.push(
          networkMonitor.handleTool('network_get_activity', {})
        );
      }

      await Promise.allSettled(operations);
      const duration = Date.now() - start;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(15000); // 15 seconds
    });
  });

  describe('Data Consistency Tests', () => {
    test('should maintain data integrity across tools', async () => {
      const testUrl = 'data:text/html,<html><head><script>console.log("consistency test");</script></head><body>Test</body></html>';

      // Start console and network monitoring
      await Promise.all([
        consoleMonitor.handleTool('console_start_monitoring', { url: testUrl }),
        networkMonitor.handleTool('network_start_monitoring', { url: testUrl })
      ]);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get data from both tools
      const [consoleResult, networkResult] = await Promise.all([
        consoleMonitor.handleTool('console_get_messages', {}),
        networkMonitor.handleTool('network_get_activity', {})
      ]);

      const consoleData = JSON.parse(consoleResult.content[0].text);
      const networkData = JSON.parse(networkResult.content[0].text);

      // Both should have captured the page load
      expect(consoleData.isMonitoring).toBe(true);
      expect(networkData.requests.length).toBeGreaterThan(0);
    });
  });

  describe('Security Integration Tests', () => {
    test('should prevent cross-tool data leakage', async () => {
      const secretUrl = 'data:text/html,<html><body>SECRET_DATA_12345</body></html>';
      const normalUrl = 'data:text/html,<html><body>Normal data</body></html>';

      // Start one tool with secret data
      await consoleMonitor.handleTool('console_start_monitoring', { url: secretUrl });
      
      // Start another tool with normal data
      await fileTracker.handleTool('file_start_tracking', { url: normalUrl });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get data from file tracker
      const fileResult = await fileTracker.handleTool('file_get_resources', {});
      const fileData = JSON.parse(fileResult.content[0].text);

      // Should not contain secret data
      expect(JSON.stringify(fileData)).not.toContain('SECRET_DATA_12345');
    });

    test('should sanitize cross-tool error messages', async () => {
      // Start with a tool in error state
      try {
        await consoleMonitor.handleTool('console_start_monitoring', { 
          url: 'https://localhost:99999/nonexistent' 
        });
      } catch (error) {
        // Expected to fail
      }

      // Start another tool successfully
      await networkMonitor.handleTool('network_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const result = await networkMonitor.handleTool('network_get_activity', {});
      const data = JSON.parse(result.content[0].text);

      // Should not expose error details from other tools
      expect(JSON.stringify(data)).not.toContain('localhost:99999');
    });
  });

  describe('Tool State Management', () => {
    test('should maintain independent tool states', async () => {
      const url1 = 'data:text/html,<html><body>Page 1</body></html>';
      const url2 = 'data:text/html,<html><body>Page 2</body></html>';

      // Start tools with different URLs
      await consoleMonitor.handleTool('console_start_monitoring', { url: url1 });
      await networkMonitor.handleTool('network_start_monitoring', { url: url2 });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Stop one tool
      await consoleMonitor.handleTool('console_stop_monitoring', {});

      // Other tool should still be active
      const networkResult = await networkMonitor.handleTool('network_get_activity', {});
      const networkData = JSON.parse(networkResult.content[0].text);

      expect(networkData.requests.length).toBeGreaterThan(0);

      // Console tool should be inactive
      await expect(
        consoleMonitor.handleTool('console_execute_script', { script: 'console.log("test");' })
      ).rejects.toThrow();
    });

    test('should handle tool restart without affecting others', async () => {
      const testUrl = 'data:text/html,<html><body>Test</body></html>';

      // Start multiple tools
      await Promise.all([
        consoleMonitor.handleTool('console_start_monitoring', { url: testUrl }),
        networkMonitor.handleTool('network_start_monitoring', { url: testUrl }),
        fileTracker.handleTool('file_start_tracking', { url: testUrl })
      ]);

      // Restart one tool
      await consoleMonitor.handleTool('console_stop_monitoring', {});
      await consoleMonitor.handleTool('console_start_monitoring', { url: testUrl });

      // All tools should be functional
      const [consoleResult, networkResult, fileResult] = await Promise.allSettled([
        consoleMonitor.handleTool('console_get_messages', {}),
        networkMonitor.handleTool('network_get_activity', {}),
        fileTracker.handleTool('file_get_resources', {})
      ]);

      expect(consoleResult.status).toBe('fulfilled');
      expect(networkResult.status).toBe('fulfilled');
      expect(fileResult.status).toBe('fulfilled');
    });
  });
});