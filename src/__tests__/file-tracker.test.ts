import { FileTracker, FileResource, FileDownload, FileSystemChange } from '../tools/file-tracker';
import { promises as fs } from 'fs';
import * as path from 'path';

describe('FileTracker - Comprehensive Tests', () => {
  let fileTracker: FileTracker;
  const testDir = '/tmp/file-tracker-test';

  beforeEach(async () => {
    fileTracker = new FileTracker();
    // Create test directory
    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterEach(async () => {
    try {
      await fileTracker.handleTool('file_stop_tracking', {});
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Clean up test directory
    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Tool Definition Tests', () => {
    test('should provide correct tools with proper schemas', () => {
      const tools = fileTracker.getTools();
      expect(tools).toHaveLength(9);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toEqual([
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

      // Validate input schemas
      const startTool = tools.find(t => t.name === 'file_start_tracking');
      expect(startTool?.inputSchema.properties).toHaveProperty('url');
      expect(startTool?.inputSchema.required).toContain('url');
    });
  });

  describe('Input Validation Tests', () => {
    test('should reject invalid URLs', async () => {
      await expect(
        fileTracker.handleTool('file_start_tracking', { url: 'invalid-url' })
      ).rejects.toThrow();
    });

    test('should reject empty URL', async () => {
      await expect(
        fileTracker.handleTool('file_start_tracking', { url: '' })
      ).rejects.toThrow();
    });

    test('should handle missing required arguments', async () => {
      await expect(
        fileTracker.handleTool('file_start_tracking', {})
      ).rejects.toThrow();

      await expect(
        fileTracker.handleTool('file_download_resource', {})
      ).rejects.toThrow();

      await expect(
        fileTracker.handleTool('file_analyze_resource', {})
      ).rejects.toThrow();

      await expect(
        fileTracker.handleTool('file_watch_filesystem', {})
      ).rejects.toThrow();
    });

    test('should validate file paths for security', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '/etc/shadow',
        'C:\\Windows\\System32',
        '..\\..\\..\\Windows\\System32',
        '/proc/self/environ'
      ];

      for (const maliciousPath of maliciousPaths) {
        await expect(
          fileTracker.handleTool('file_watch_filesystem', { paths: [maliciousPath] })
        ).rejects.toThrow();
      }
    });

    test('should validate download paths', async () => {
      const invalidPaths = [
        '/root',
        '/etc',
        '/proc',
        '/sys',
        'C:\\Windows',
        'C:\\System32'
      ];

      for (const invalidPath of invalidPaths) {
        await expect(
          fileTracker.handleTool('file_start_tracking', { 
            url: 'data:text/html,<html><body>Test</body></html>',
            downloadPath: invalidPath
          })
        ).rejects.toThrow();
      }
    });
  });

  describe('Memory Management Tests', () => {
    test('should limit tracked files to prevent memory leaks', async () => {
      const html = Array.from({ length: 1000 }, (_, i) => 
        `<script src="data:text/javascript,console.log('script${i}');"></script>`
      ).join('');

      await fileTracker.handleTool('file_start_tracking', { 
        url: `data:text/html,<html><head>${html}</head><body>Test</body></html>`,
        captureContent: false
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = await fileTracker.handleTool('file_get_resources', { 
        limit: 500 
      });
      const data = JSON.parse(result.content[0].text);
      
      // Should respect limit
      expect(data.resources.length).toBeLessThanOrEqual(500);
    });

    test('should handle tracking data clearing', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const clearResult = await fileTracker.handleTool('file_clear_tracking_data', {});
      expect(clearResult.content[0].text).toContain('Cleared tracking data');

      const getResult = await fileTracker.handleTool('file_get_resources', {});
      const data = JSON.parse(getResult.content[0].text);
      expect(data.resources).toHaveLength(0);
      expect(data.downloads).toHaveLength(0);
      expect(data.filesystemChanges).toHaveLength(0);
    });
  });

  describe('Error Handling Tests', () => {
    test('should handle filesystem watch failures gracefully', async () => {
      // Try to watch non-existent path
      const result = await fileTracker.handleTool('file_watch_filesystem', { 
        paths: ['/non/existent/path'] 
      });
      
      const data = JSON.parse(result.content[0].text);
      expect(data.watchedPaths).toEqual(['/non/existent/path']);
      expect(data.errors).toBeDefined();
    });

    test('should handle download failures gracefully', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Try to download non-existent resource
      await expect(
        fileTracker.handleTool('file_download_resource', { 
          url: 'https://nonexistent-domain-12345.com/file.txt' 
        })
      ).rejects.toThrow();
    });

    test('should handle analysis of non-existent resources', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      await expect(
        fileTracker.handleTool('file_analyze_resource', { 
          url: 'https://nonexistent-domain-12345.com/file.txt' 
        })
      ).rejects.toThrow();
    });

    test('should handle browser crash gracefully', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      // Should be able to restart tracking
      const result = await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Recovery</body></html>' 
      });
      
      expect(result.content[0].text).toContain('File tracking started');
    });
  });

  describe('Functional Tests', () => {
    test('should track different file types', async () => {
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
      
      await fileTracker.handleTool('file_start_tracking', { 
        url: `data:text/html,${encodeURIComponent(html)}`,
        captureContent: true
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await fileTracker.handleTool('file_get_resources', {});
      const data = JSON.parse(result.content[0].text);
      
      const fileTypes = data.resources.map((res: FileResource) => res.type);
      expect(fileTypes).toContain('document');
    });

    test('should filter resources by type', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><head><script src="data:text/javascript,console.log();"></script></head><body>Test</body></html>' 
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await fileTracker.handleTool('file_get_resources', { 
        type: 'script' 
      });
      const data = JSON.parse(result.content[0].text);
      
      if (data.resources.length > 0) {
        expect(data.resources.every((res: FileResource) => res.type === 'script')).toBe(true);
      }
    });

    test('should filter resources by size', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Test content</body></html>' 
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await fileTracker.handleTool('file_get_resources', { 
        minSize: 10,
        maxSize: 10000
      });
      const data = JSON.parse(result.content[0].text);
      
      data.resources.forEach((res: FileResource) => {
        expect(res.size).toBeGreaterThanOrEqual(10);
        expect(res.size).toBeLessThanOrEqual(10000);
      });
    });

    test('should capture content when enabled', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Test content for capture</body></html>',
        captureContent: true
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await fileTracker.handleTool('file_get_resources', {});
      const data = JSON.parse(result.content[0].text);
      
      const documentResource = data.resources.find((res: FileResource) => res.type === 'document');
      if (documentResource) {
        expect(documentResource.content).toBeDefined();
        expect(documentResource.content).toContain('Test content for capture');
      }
    });

    test('should watch filesystem changes', async () => {
      // Create a test file
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'initial content');

      await fileTracker.handleTool('file_watch_filesystem', { 
        paths: [testDir] 
      });

      // Wait a bit for watcher to initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Modify the file
      await fs.writeFile(testFile, 'modified content');
      
      // Wait for change to be detected
      await new Promise(resolve => setTimeout(resolve, 1000));

      const result = await fileTracker.handleTool('file_get_filesystem_changes', {});
      const data = JSON.parse(result.content[0].text);
      
      expect(data.changes.length).toBeGreaterThan(0);
      const change = data.changes.find((c: FileSystemChange) => c.path.includes('test.txt'));
      if (change) {
        expect(['created', 'modified']).toContain(change.type);
      }
    });
  });

  describe('Performance Tests', () => {
    test('should handle large files efficiently', async () => {
      // Create large content
      const largeContent = 'x'.repeat(100000);
      
      await fileTracker.handleTool('file_start_tracking', { 
        url: `data:text/html,<html><body>${largeContent}</body></html>`,
        captureContent: false // Disable to test performance
      });

      const start = Date.now();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = await fileTracker.handleTool('file_get_resources', {});
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.content[0].text).toBeDefined();
    });

    test('should handle many filesystem changes', async () => {
      await fileTracker.handleTool('file_watch_filesystem', { 
        paths: [testDir] 
      });

      // Wait for watcher to initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create many files rapidly
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(fs.writeFile(path.join(testDir, `test${i}.txt`), `content ${i}`));
      }
      await Promise.all(promises);
      
      // Wait for changes to be detected
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = await fileTracker.handleTool('file_get_filesystem_changes', { 
        limit: 100 
      });
      const data = JSON.parse(result.content[0].text);
      
      // Should have detected many changes
      expect(data.changes.length).toBeGreaterThan(0);
      expect(data.changes.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Security Tests', () => {
    test('should not expose sensitive file paths', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const result = await fileTracker.handleTool('file_get_resources', {});
      const data = JSON.parse(result.content[0].text);
      
      // Should not expose internal system paths
      data.resources.forEach((resource: FileResource) => {
        expect(resource.url).not.toContain('/etc/');
        expect(resource.url).not.toContain('/proc/');
        expect(resource.url).not.toContain('/sys/');
      });
    });

    test('should sanitize download filenames', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Test</body></html>',
        downloadPath: testDir
      });

      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\..\\Windows\\System32\\config\\sam',
        'test<script>alert("xss")</script>.txt',
        'test\x00.txt'
      ];

      for (const filename of maliciousFilenames) {
        await expect(
          fileTracker.handleTool('file_download_resource', { 
            url: 'data:text/plain,test content',
            filename
          })
        ).rejects.toThrow();
      }
    });

    test('should validate download URLs', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Test</body></html>' 
      });

      const maliciousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'file:///etc/passwd',
        'ftp://malicious.com/file.exe'
      ];

      for (const url of maliciousUrls) {
        await expect(
          fileTracker.handleTool('file_download_resource', { url })
        ).rejects.toThrow();
      }
    });
  });

  describe('Resource Analysis Tests', () => {
    test('should analyze tracked resources', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Test content</body></html>' 
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get a resource to analyze
      const resourcesResult = await fileTracker.handleTool('file_get_resources', {});
      const resourcesData = JSON.parse(resourcesResult.content[0].text);
      
      if (resourcesData.resources.length > 0) {
        const resource = resourcesData.resources[0];
        
        const analysisResult = await fileTracker.handleTool('file_analyze_resource', { 
          url: resource.url 
        });
        const analysisData = JSON.parse(analysisResult.content[0].text);
        
        expect(analysisData).toHaveProperty('resource');
        expect(analysisData).toHaveProperty('analysis');
        expect(analysisData.resource.url).toBe(resource.url);
      }
    });
  });

  describe('Download Management Tests', () => {
    test('should track downloads', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Test</body></html>',
        downloadPath: testDir
      });

      // Download a test file
      await fileTracker.handleTool('file_download_resource', { 
        url: 'data:text/plain,test download content',
        filename: 'test-download.txt'
      });

      const result = await fileTracker.handleTool('file_get_downloads', {});
      const data = JSON.parse(result.content[0].text);
      
      expect(data.downloads.length).toBeGreaterThan(0);
      const download = data.downloads.find((d: FileDownload) => d.filename === 'test-download.txt');
      expect(download).toBeDefined();
      if (download) {
        expect(download.downloadPath).toContain(testDir);
      }
    });

    test('should handle download limits', async () => {
      await fileTracker.handleTool('file_start_tracking', { 
        url: 'data:text/html,<html><body>Test</body></html>',
        downloadPath: testDir
      });

      // Download multiple files
      for (let i = 0; i < 10; i++) {
        await fileTracker.handleTool('file_download_resource', { 
          url: `data:text/plain,content ${i}`,
          filename: `test-${i}.txt`
        });
      }

      const result = await fileTracker.handleTool('file_get_downloads', { limit: 5 });
      const data = JSON.parse(result.content[0].text);
      
      expect(data.downloads.length).toBeLessThanOrEqual(5);
    });
  });
});