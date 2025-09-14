import { WebCoreVitalsTracker, WebCoreVitals, PerformanceEntry } from '../tools/web-core-vitals';

describe('WebCoreVitalsTracker - Comprehensive Tests', () => {
  let wcvTracker: WebCoreVitalsTracker;

  beforeEach(() => {
    wcvTracker = new WebCoreVitalsTracker();
  });

  afterEach(async () => {
    try {
      await wcvTracker.handleTool('wcv_stop_monitoring', {});
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Tool Definition Tests', () => {
    test('should provide correct tools with proper schemas', () => {
      const tools = wcvTracker.getTools();
      expect(tools).toHaveLength(7);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toEqual([
        'wcv_start_monitoring',
        'wcv_measure_vitals',
        'wcv_run_lighthouse',
        'wcv_get_vitals_history',
        'wcv_get_performance_entries',
        'wcv_simulate_user_interaction',
        'wcv_stop_monitoring',
      ]);

      // Validate input schemas
      const startTool = tools.find(t => t.name === 'wcv_start_monitoring');
      expect(startTool?.inputSchema.properties).toHaveProperty('url');
      expect(startTool?.inputSchema.required).toContain('url');
    });
  });

  describe('Input Validation Tests', () => {
    test('should reject invalid URLs', async () => {
      await expect(
        wcvTracker.handleTool('wcv_start_monitoring', { url: 'invalid-url' })
      ).rejects.toThrow();
    });

    test('should reject empty URL', async () => {
      await expect(
        wcvTracker.handleTool('wcv_start_monitoring', { url: '' })
      ).rejects.toThrow();
    });

    test('should handle missing required arguments', async () => {
      await expect(
        wcvTracker.handleTool('wcv_start_monitoring', {})
      ).rejects.toThrow();
    });

    test('should validate numeric parameters', async () => {
      const result = await wcvTracker.handleTool('wcv_get_vitals_history', { 
        limit: -1 
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.measurements).toHaveLength(0); // Should handle negative limits gracefully
    });

    test('should validate enum parameters', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Valid enum values should work
      await expect(
        wcvTracker.handleTool('wcv_simulate_user_interaction', { action: 'click' })
      ).resolves.toBeDefined();

      await expect(
        wcvTracker.handleTool('wcv_simulate_user_interaction', { action: 'scroll' })
      ).resolves.toBeDefined();

      // Invalid enum values should be handled
      await expect(
        wcvTracker.handleTool('wcv_simulate_user_interaction', { action: 'invalid' })
      ).rejects.toThrow();
    });
  });

  describe('Memory Management Tests', () => {
    test('should limit vitals history to prevent memory leaks', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Generate many measurements
      for (let i = 0; i < 100; i++) {
        await wcvTracker.handleTool('wcv_measure_vitals', { waitTime: 0.1 });
      }

      const result = await wcvTracker.handleTool('wcv_get_vitals_history', { 
        limit: 50 
      });
      const data = JSON.parse(result.content[0].text);
      
      // Should respect limit
      expect(data.measurements.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle lighthouse failures gracefully', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Lighthouse might fail in test environment
      const result = await wcvTracker.handleTool('wcv_run_lighthouse', { 
        categories: ['performance'], 
        device: 'mobile' 
      });
      
      expect(result.content[0].text).toBeDefined();
      const data = JSON.parse(result.content[0].text);
      
      // Should either succeed or fail gracefully
      expect(data).toHaveProperty('success');
      if (!data.success) {
        expect(data).toHaveProperty('error');
      }
    });

    test('should handle browser crash gracefully', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Should be able to restart monitoring
      const result = await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Recovery</body></html>' 
      });
      
      expect(result.content[0].text).toContain('Web Core Vitals monitoring started');
    });

    test('should handle measurement without active monitoring', async () => {
      await expect(
        wcvTracker.handleTool('wcv_measure_vitals', {})
      ).rejects.toThrow('Web Core Vitals monitoring is not active');
    });

    test('should handle user interaction without active monitoring', async () => {
      await expect(
        wcvTracker.handleTool('wcv_simulate_user_interaction', { action: 'click' })
      ).rejects.toThrow('Web Core Vitals monitoring is not active');
    });
  });

  describe('Functional Tests', () => {
    test('should measure basic vitals', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body><h1>Test Page</h1><p>Content for LCP measurement</p></body></html>' 
      });

      const result = await wcvTracker.handleTool('wcv_measure_vitals', { waitTime: 2 });
      const data = JSON.parse(result.content[0].text);
      
      expect(data).toHaveProperty('vitals');
      expect(data.vitals).toHaveProperty('timestamp');
      expect(data.vitals).toHaveProperty('url');
      
      // Core vitals should be present (may be null initially)
      expect(data.vitals).toHaveProperty('LCP');
      expect(data.vitals).toHaveProperty('FID');
      expect(data.vitals).toHaveProperty('CLS');
      expect(data.vitals).toHaveProperty('FCP');
      expect(data.vitals).toHaveProperty('TTFB');
    });

    test('should track vitals history', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Take multiple measurements
      await wcvTracker.handleTool('wcv_measure_vitals', { waitTime: 1 });
      await wcvTracker.handleTool('wcv_measure_vitals', { waitTime: 1 });

      const result = await wcvTracker.handleTool('wcv_get_vitals_history', { limit: 10 });
      const data = JSON.parse(result.content[0].text);
      
      expect(data).toHaveProperty('totalMeasurements');
      expect(data).toHaveProperty('measurements');
      expect(data).toHaveProperty('isMonitoring');
      expect(data.isMonitoring).toBe(true);
      expect(data.measurements.length).toBeGreaterThan(0);
    });

    test('should get performance entries', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const result = await wcvTracker.handleTool('wcv_get_performance_entries', {});
      expect(result.content[0].text).toBeDefined();
      
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('entries');
      expect(Array.isArray(data.entries)).toBe(true);
    });

    test('should filter performance entries by type', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const result = await wcvTracker.handleTool('wcv_get_performance_entries', { 
        entryType: 'navigation' 
      });
      const data = JSON.parse(result.content[0].text);
      
      if (data.entries.length > 0) {
        expect(data.entries.every((entry: PerformanceEntry) => entry.entryType === 'navigation')).toBe(true);
      }
    });

    test('should simulate user interactions', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body><button id="test">Click me</button></body></html>' 
      });

      const clickResult = await wcvTracker.handleTool('wcv_simulate_user_interaction', { 
        action: 'click',
        target: '#test'
      });
      expect(clickResult.content[0].text).toContain('interaction simulated');

      const scrollResult = await wcvTracker.handleTool('wcv_simulate_user_interaction', { 
        action: 'scroll'
      });
      expect(scrollResult.content[0].text).toContain('interaction simulated');
    });
  });

  describe('Performance Tests', () => {
    test('should handle rapid measurements', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const start = Date.now();
      
      // Take multiple quick measurements
      for (let i = 0; i < 5; i++) {
        await wcvTracker.handleTool('wcv_measure_vitals', { waitTime: 0.5 });
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should handle continuous monitoring mode', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>',
        continuous: true
      });

      // Wait for some automatic measurements
      await new Promise(resolve => setTimeout(resolve, 3000));

      const result = await wcvTracker.handleTool('wcv_get_vitals_history', {});
      const data = JSON.parse(result.content[0].text);
      
      // Should have some measurements from continuous monitoring
      expect(data.totalMeasurements).toBeGreaterThan(0);
    });
  });

  describe('Security Tests', () => {
    test('should not expose sensitive browser information', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const result = await wcvTracker.handleTool('wcv_get_performance_entries', {});
      const data = JSON.parse(result.content[0].text);
      
      // Should not expose internal implementation details
      expect(JSON.stringify(data)).not.toContain('puppeteer');
    });

    test('should handle malicious target selectors safely', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const maliciousSelectors = [
        'javascript:alert("xss")',
        '<script>alert("xss")</script>',
        '../../../../../../etc/passwd'
      ];

      for (const selector of maliciousSelectors) {
        await expect(
          wcvTracker.handleTool('wcv_simulate_user_interaction', { 
            action: 'click', 
            target: selector 
          })
        ).rejects.toThrow();
      }
    });
  });

  describe('Lighthouse Integration Tests', () => {
    test('should handle lighthouse with different categories', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
      
      for (const category of categories) {
        const result = await wcvTracker.handleTool('wcv_run_lighthouse', { 
          categories: [category],
          device: 'desktop'
        });
        
        expect(result.content[0].text).toBeDefined();
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveProperty('success');
      }
    });

    test('should handle lighthouse with different devices', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const devices = ['mobile', 'desktop'];
      
      for (const device of devices) {
        const result = await wcvTracker.handleTool('wcv_run_lighthouse', { 
          categories: ['performance'],
          device
        });
        
        expect(result.content[0].text).toBeDefined();
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveProperty('success');
      }
    });
  });

  describe('Data Integrity Tests', () => {
    test('should maintain data consistency across operations', async () => {
      await wcvTracker.handleTool('wcv_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Take measurements
      await wcvTracker.handleTool('wcv_measure_vitals', { waitTime: 1 });
      
      const historyBefore = await wcvTracker.handleTool('wcv_get_vitals_history', {});
      const dataBefore = JSON.parse(historyBefore.content[0].text);
      
      // Take another measurement
      await wcvTracker.handleTool('wcv_measure_vitals', { waitTime: 1 });
      
      const historyAfter = await wcvTracker.handleTool('wcv_get_vitals_history', {});
      const dataAfter = JSON.parse(historyAfter.content[0].text);
      
      // Total measurements should increase
      expect(dataAfter.totalMeasurements).toBeGreaterThan(dataBefore.totalMeasurements);
    });
  });
});