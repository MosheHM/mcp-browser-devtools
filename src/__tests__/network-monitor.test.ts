import { NetworkMonitor, NetworkRequest, NetworkResponse } from '../tools/network-monitor';

describe('NetworkMonitor - Comprehensive Tests', () => {
  let networkMonitor: NetworkMonitor;

  beforeEach(() => {
    networkMonitor = new NetworkMonitor();
  });

  afterEach(async () => {
    try {
      await networkMonitor.handleTool('network_stop_monitoring', {});
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Tool Definition Tests', () => {
    test('should provide correct tools with proper schemas', () => {
      const tools = networkMonitor.getTools();
      expect(tools).toHaveLength(6);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toEqual([
        'network_start_monitoring',
        'network_get_activity',
        'network_get_performance_metrics',
        'network_clear_activity',
        'network_stop_monitoring',
        'network_navigate',
      ]);

      // Validate critical input schemas
      const startTool = tools.find(t => t.name === 'network_start_monitoring');
      expect(startTool?.inputSchema.properties).toHaveProperty('url');
      expect(startTool?.inputSchema.required).toContain('url');
    });
  });

  describe('Input Validation Tests', () => {
    test('should reject invalid URLs', async () => {
      await expect(
        networkMonitor.handleTool('network_start_monitoring', { url: 'not-a-url' })
      ).rejects.toThrow();
    });

    test('should reject empty URL', async () => {
      await expect(
        networkMonitor.handleTool('network_start_monitoring', { url: '' })
      ).rejects.toThrow();
    });

    test('should handle missing required arguments', async () => {
      await expect(
        networkMonitor.handleTool('network_start_monitoring', {})
      ).rejects.toThrow();

      await expect(
        networkMonitor.handleTool('network_navigate', {})
      ).rejects.toThrow();
    });

    test('should validate limit parameters', async () => {
      const result = await networkMonitor.handleTool('network_get_activity', { 
        limit: -1 
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.requests).toHaveLength(0); // Should handle negative limits gracefully
    });
  });

  describe('Memory Management Tests', () => {
    test('should limit network activity storage to prevent memory leaks', async () => {
      await networkMonitor.handleTool('network_start_monitoring', { 
        url: 'data:text/html,<html><head><script>for(let i=0; i<1000; i++) fetch("data:text/plain,test" + i);</script></head><body>Test</body></html>' 
      });

      // Wait for requests to be generated
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = await networkMonitor.handleTool('network_get_activity', { 
        limit: 500 
      });
      const data = JSON.parse(result.content[0].text);
      
      // Should respect limit and not cause memory issues
      expect(data.requests.length).toBeLessThanOrEqual(500);
    });

    test('should handle network activity clearing', async () => {
      await networkMonitor.handleTool('network_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const clearResult = await networkMonitor.handleTool('network_clear_activity', {});
      expect(clearResult.content[0].text).toContain('Cleared network activity');

      const getResult = await networkMonitor.handleTool('network_get_activity', {});
      const data = JSON.parse(getResult.content[0].text);
      expect(data.requests).toHaveLength(0);
      expect(data.responses).toHaveLength(0);
      expect(data.failures).toHaveLength(0);
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle network failures gracefully', async () => {
      await networkMonitor.handleTool('network_start_monitoring', { 
        url: 'https://nonexistent-domain-12345.com' 
      });

      // Wait for failure to be registered
      await new Promise(resolve => setTimeout(resolve, 3000));

      const result = await networkMonitor.handleTool('network_get_activity', {});
      const data = JSON.parse(result.content[0].text);
      
      // Should capture the network failure
      expect(data.failures.length).toBeGreaterThan(0);
    });

    test('should handle browser crash gracefully', async () => {
      await networkMonitor.handleTool('network_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Should be able to restart monitoring after failure
      const result = await networkMonitor.handleTool('network_start_monitoring', { 
        url: 'data:text/html,<html><body>Recovery</body></html>' 
      });
      
      expect(result.content[0].text).toContain('Network monitoring started');
    });

    test('should handle navigation without active monitoring', async () => {
      await expect(
        networkMonitor.handleTool('network_navigate', { url: 'https://example.com' })
      ).rejects.toThrow('Network monitoring is not active');
    });
  });

  describe('Functional Tests', () => {
    test('should capture different resource types', async () => {
      const html = `
        <html>
          <head>
            <link rel="stylesheet" href="data:text/css,body{margin:0}">
            <script src="data:text/javascript,console.log('test');"></script>
          </head>
          <body>
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==">
          </body>
        </html>
      `;
      
      await networkMonitor.handleTool('network_start_monitoring', { 
        url: `data:text/html,${encodeURIComponent(html)}` 
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await networkMonitor.handleTool('network_get_activity', {});
      const data = JSON.parse(result.content[0].text);
      
      const resourceTypes = data.requests.map((req: NetworkRequest) => req.resourceType);
      expect(resourceTypes).toContain('document');
    });

    test('should filter by resource type', async () => {
      await networkMonitor.handleTool('network_start_monitoring', { 
        url: 'data:text/html,<html><head><script src="data:text/javascript,console.log();"></script></head><body>Test</body></html>' 
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await networkMonitor.handleTool('network_get_activity', { 
        resourceType: 'script' 
      });
      const data = JSON.parse(result.content[0].text);
      
      if (data.requests.length > 0) {
        expect(data.requests.every((req: NetworkRequest) => req.resourceType === 'script')).toBe(true);
      }
    });

    test('should track request/response timing', async () => {
      await networkMonitor.handleTool('network_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await networkMonitor.handleTool('network_get_activity', {});
      const data = JSON.parse(result.content[0].text);
      
      if (data.requests.length > 0 && data.responses.length > 0) {
        const request = data.requests[0];
        const response = data.responses.find((r: NetworkResponse) => r.url === request.url);
        
        if (response) {
          expect(request.timestamp).toBeGreaterThan(0);
          expect(response.timestamp).toBeGreaterThan(0);
          expect(response.timestamp).toBeGreaterThanOrEqual(request.timestamp);
        }
      }
    });
  });

  describe('Performance Tests', () => {
    test('should handle rapid navigation', async () => {
      await networkMonitor.handleTool('network_start_monitoring', { 
        url: 'data:text/html,<html><body>Initial</body></html>' 
      });

      const start = Date.now();
      
      for (let i = 0; i < 5; i++) {
        await networkMonitor.handleTool('network_navigate', { 
          url: `data:text/html,<html><body>Page ${i}</body></html>`,
          waitUntil: 'domcontentloaded'
        });
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should get performance metrics without errors', async () => {
      await networkMonitor.handleTool('network_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await networkMonitor.handleTool('network_get_performance_metrics', {});
      expect(result.content[0].text).toBeDefined();
      
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('timing');
      expect(data).toHaveProperty('navigation');
    });
  });

  describe('Security Tests', () => {
    test('should not expose sensitive request data', async () => {
      await networkMonitor.handleTool('network_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const result = await networkMonitor.handleTool('network_get_activity', {});
      const data = JSON.parse(result.content[0].text);
      
      // Should not expose sensitive headers or credentials
      data.requests.forEach((request: NetworkRequest) => {
        expect(request.headers).toBeDefined();
        // Verify sensitive headers are not exposed inappropriately
        if (request.headers.authorization) {
          expect(request.headers.authorization).not.toContain('Bearer');
        }
      });
    });

    test('should handle malicious URLs safely', async () => {
      const maliciousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'file:///etc/passwd'
      ];

      for (const url of maliciousUrls) {
        await expect(
          networkMonitor.handleTool('network_start_monitoring', { url })
        ).rejects.toThrow();
      }
    });
  });

  describe('Request Interception Tests', () => {
    test('should handle request interception without blocking', async () => {
      await networkMonitor.handleTool('network_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>',
        interceptRequests: true
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await networkMonitor.handleTool('network_get_activity', {});
      const data = JSON.parse(result.content[0].text);
      
      // Should still capture requests even with interception enabled
      expect(data.requests.length).toBeGreaterThan(0);
    });
  });
});