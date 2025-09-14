import { ConsoleMonitor, ConsoleMessage } from '../tools/console-monitor';

describe('ConsoleMonitor - Comprehensive Tests', () => {
  let consoleMonitor: ConsoleMonitor;

  beforeEach(() => {
    consoleMonitor = new ConsoleMonitor();
  });

  afterEach(async () => {
    try {
      await consoleMonitor.handleTool('console_stop_monitoring', {});
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Tool Definition Tests', () => {
    test('should provide correct tools with proper schemas', () => {
      const tools = consoleMonitor.getTools();
      expect(tools).toHaveLength(5);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toEqual([
        'console_start_monitoring',
        'console_get_messages',
        'console_clear_messages',
        'console_stop_monitoring',
        'console_execute_script',
      ]);

      // Validate input schemas
      const startTool = tools.find(t => t.name === 'console_start_monitoring');
      expect(startTool?.inputSchema.properties).toHaveProperty('url');
      expect(startTool?.inputSchema.required).toContain('url');
    });
  });

  describe('Input Validation Tests', () => {
    test('should reject invalid URLs', async () => {
      await expect(
        consoleMonitor.handleTool('console_start_monitoring', { url: 'invalid-url' })
      ).rejects.toThrow();
    });

    test('should reject empty URL', async () => {
      await expect(
        consoleMonitor.handleTool('console_start_monitoring', { url: '' })
      ).rejects.toThrow();
    });

    test('should reject malicious script injection', async () => {
      // Start monitoring first
      await consoleMonitor.handleTool('console_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Try to inject malicious script
      const maliciousScript = 'while(true) { console.log("infinite loop"); }';
      
      // Should have timeout protection
      await expect(
        consoleMonitor.handleTool('console_execute_script', { script: maliciousScript })
      ).rejects.toThrow();
    });

    test('should handle missing required arguments', async () => {
      await expect(
        consoleMonitor.handleTool('console_start_monitoring', {})
      ).rejects.toThrow();

      await expect(
        consoleMonitor.handleTool('console_execute_script', {})
      ).rejects.toThrow();
    });
  });

  describe('Memory Management Tests', () => {
    test('should limit console messages to prevent memory leaks', async () => {
      await consoleMonitor.handleTool('console_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Execute many console.log statements
      const script = Array.from({ length: 10000 }, (_, i) => `console.log('Message ${i}');`).join('');
      await consoleMonitor.handleTool('console_execute_script', { script });

      const result = await consoleMonitor.handleTool('console_get_messages', { limit: 5000 });
      const data = JSON.parse(result.content[0].text);
      
      // Should respect limit and not crash
      expect(data.messages.length).toBeLessThanOrEqual(5000);
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle script execution errors gracefully', async () => {
      await consoleMonitor.handleTool('console_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const invalidScript = 'this.is.invalid.javascript.syntax(';
      
      await expect(
        consoleMonitor.handleTool('console_execute_script', { script: invalidScript })
      ).rejects.toThrow();
    });

    test('should handle browser crash gracefully', async () => {
      await consoleMonitor.handleTool('console_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Force browser crash simulation
      try {
        await consoleMonitor.handleTool('console_execute_script', { 
          script: 'window.location = "chrome://crash";' 
        });
      } catch (error) {
        // Expected to fail
      }

      // Should be able to restart monitoring
      const result = await consoleMonitor.handleTool('console_start_monitoring', { 
        url: 'data:text/html,<html><body>Recovery</body></html>' 
      });
      
      expect(result.content[0].text).toContain('Console monitoring started');
    });

    test('should handle execution without active page', async () => {
      await expect(
        consoleMonitor.handleTool('console_execute_script', { script: 'console.log("test");' })
      ).rejects.toThrow('Console monitoring is not active');
    });
  });

  describe('Functional Tests', () => {
    test('should capture different console message types', async () => {
      await consoleMonitor.handleTool('console_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const script = `
        console.log('Log message');
        console.warn('Warning message');
        console.error('Error message');
        console.info('Info message');
        console.debug('Debug message');
      `;

      await consoleMonitor.handleTool('console_execute_script', { script });

      const result = await consoleMonitor.handleTool('console_get_messages', {});
      const data = JSON.parse(result.content[0].text);
      
      const messageTypes = data.messages.map((msg: ConsoleMessage) => msg.type);
      expect(messageTypes).toContain('log');
      expect(messageTypes).toContain('warn');
      expect(messageTypes).toContain('error');
      expect(messageTypes).toContain('info');
    });

    test('should filter messages by type', async () => {
      await consoleMonitor.handleTool('console_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      await consoleMonitor.handleTool('console_execute_script', { 
        script: 'console.log("Log"); console.error("Error");' 
      });

      const errorResult = await consoleMonitor.handleTool('console_get_messages', { type: 'error' });
      const errorData = JSON.parse(errorResult.content[0].text);
      
      expect(errorData.messages.every((msg: ConsoleMessage) => msg.type === 'error')).toBe(true);
    });

    test('should clear messages correctly', async () => {
      await consoleMonitor.handleTool('console_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      await consoleMonitor.handleTool('console_execute_script', { 
        script: 'console.log("Test message");' 
      });

      const clearResult = await consoleMonitor.handleTool('console_clear_messages', {});
      expect(clearResult.content[0].text).toContain('Cleared');

      const getResult = await consoleMonitor.handleTool('console_get_messages', {});
      const data = JSON.parse(getResult.content[0].text);
      expect(data.messages).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    test('should handle rapid script execution', async () => {
      await consoleMonitor.handleTool('console_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const start = Date.now();
      
      for (let i = 0; i < 10; i++) {
        await consoleMonitor.handleTool('console_execute_script', { 
          script: `console.log('Rapid execution ${i}');` 
        });
      }
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Security Tests', () => {
    test('should not expose sensitive browser information', async () => {
      await consoleMonitor.handleTool('console_start_monitoring', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const result = await consoleMonitor.handleTool('console_execute_script', { 
        script: 'JSON.stringify(navigator)' 
      });

      const data = JSON.parse(result.content[0].text);
      // Should not expose internal implementation details
      expect(JSON.stringify(data)).not.toContain('puppeteer');
    });
  });
});