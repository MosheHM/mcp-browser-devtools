import { ConsoleMonitor } from '../tools/console-monitor';
import { NetworkMonitor } from '../tools/network-monitor';
import { WebCoreVitalsTracker } from '../tools/web-core-vitals';
import { FileTracker } from '../tools/file-tracker';

describe('MCP Browser DevTools', () => {
  describe('ConsoleMonitor', () => {
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

    test('should provide correct tools', () => {
      const tools = consoleMonitor.getTools();
      expect(tools).toHaveLength(5);
      expect(tools.map(t => t.name)).toEqual([
        'console_start_monitoring',
        'console_get_messages',
        'console_clear_messages',
        'console_stop_monitoring',
        'console_execute_script',
      ]);
    });

    test('should handle clear messages', async () => {
      const result = await consoleMonitor.handleTool('console_clear_messages', {});
      expect(result.content[0].text).toContain('Cleared 0 console messages');
    });
  });

  describe('NetworkMonitor', () => {
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

    test('should provide correct tools', () => {
      const tools = networkMonitor.getTools();
      expect(tools).toHaveLength(6);
      expect(tools.map(t => t.name)).toEqual([
        'network_start_monitoring',
        'network_get_activity',
        'network_get_performance_metrics',
        'network_clear_activity',
        'network_stop_monitoring',
        'network_navigate',
      ]);
    });

    test('should handle clear activity', async () => {
      const result = await networkMonitor.handleTool('network_clear_activity', {});
      expect(result.content[0].text).toContain('Cleared network activity');
    });
  });

  describe('WebCoreVitalsTracker', () => {
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

    test('should provide correct tools', () => {
      const tools = wcvTracker.getTools();
      expect(tools).toHaveLength(7);
      expect(tools.map(t => t.name)).toEqual([
        'wcv_start_monitoring',
        'wcv_measure_vitals',
        'wcv_run_lighthouse',
        'wcv_get_vitals_history',
        'wcv_get_performance_entries',
        'wcv_simulate_user_interaction',
        'wcv_stop_monitoring',
      ]);
    });

    test('should handle get vitals history', async () => {
      const result = await wcvTracker.handleTool('wcv_get_vitals_history', { limit: 5 });
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('totalMeasurements');
      expect(data).toHaveProperty('isMonitoring');
    });
  });

  describe('FileTracker', () => {
    let fileTracker: FileTracker;

    beforeEach(() => {
      fileTracker = new FileTracker();
    });

    afterEach(async () => {
      try {
        await fileTracker.handleTool('file_stop_tracking', {});
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    test('should provide correct tools', () => {
      const tools = fileTracker.getTools();
      expect(tools).toHaveLength(9);
      expect(tools.map(t => t.name)).toEqual([
        'file_start_tracking',
        'file_get_resources',
        'file_download_resource',
        'file_get_downloads',
        'file_analyze_resource',
        'file_watch_filesystem',
        'file_get_filesystem_changes',
        'file_clear_tracking_data',
        'file_stop_tracking',
      ]);
    });

    test('should handle clear tracking data', async () => {
      const result = await fileTracker.handleTool('file_clear_tracking_data', {});
      expect(result.content[0].text).toContain('Cleared tracking data');
    });

    test('should handle filesystem watching', async () => {
      const result = await fileTracker.handleTool('file_watch_filesystem', { 
        paths: ['/tmp/test'] 
      });
      const data = JSON.parse(result.content[0].text);
      expect(data.watchedPaths).toEqual(['/tmp/test']);
    });
  });
});