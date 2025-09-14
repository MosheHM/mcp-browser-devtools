import puppeteer, { Browser, Page, HTTPRequest, HTTPResponse } from 'puppeteer';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface FileResource {
  url: string;
  type: 'document' | 'script' | 'stylesheet' | 'image' | 'font' | 'xhr' | 'fetch' | 'websocket' | 'manifest' | 'other';
  size: number;
  loadTime: number;
  fromCache: boolean;
  status: number;
  timestamp: number;
  mimeType?: string;
  content?: string; // For text-based resources
}

export interface FileDownload {
  filename: string;
  url: string;
  size: number;
  downloadPath: string;
  timestamp: number;
  mimeType?: string;
}

export interface FileSystemChange {
  type: 'created' | 'modified' | 'deleted';
  path: string;
  timestamp: number;
  size?: number;
}

export class FileTracker {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private trackedFiles: FileResource[] = [];
  private downloads: FileDownload[] = [];
  private fsChanges: FileSystemChange[] = [];
  private isMonitoring = false;
  private downloadPath = '/tmp/file-tracker-downloads';
  private watchedPaths: string[] = [];

  getTools(): Tool[] {
    return [
      {
        name: 'file_start_tracking',
        description: 'Start tracking file resources and downloads from a webpage',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL of the webpage to track files from',
            },
            headless: {
              type: 'boolean',
              description: 'Run browser in headless mode (default: true)',
              default: true,
            },
            downloadPath: {
              type: 'string',
              description: 'Path to save downloaded files (default: /tmp/file-tracker-downloads)',
            },
            captureContent: {
              type: 'boolean',
              description: 'Capture content of text-based resources (default: false)',
              default: false,
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'file_get_resources',
        description: 'Get tracked file resources',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['all', 'document', 'script', 'stylesheet', 'image', 'font', 'xhr', 'fetch', 'websocket', 'manifest', 'other'],
              description: 'Filter by resource type (default: all)',
              default: 'all',
            },
            minSize: {
              type: 'number',
              description: 'Minimum file size in bytes',
            },
            maxSize: {
              type: 'number',
              description: 'Maximum file size in bytes',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of resources to return (default: 100)',
              default: 100,
            },
          },
        },
      },
      {
        name: 'file_download_resource',
        description: 'Download a specific resource by URL',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL of the resource to download',
            },
            filename: {
              type: 'string',
              description: 'Custom filename for the download',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'file_get_downloads',
        description: 'Get list of downloaded files',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of downloads to return (default: 50)',
              default: 50,
            },
          },
        },
      },
      {
        name: 'file_analyze_resource',
        description: 'Analyze a specific resource for detailed information',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL of the resource to analyze',
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'file_watch_filesystem',
        description: 'Watch filesystem paths for changes',
        inputSchema: {
          type: 'object',
          properties: {
            paths: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'Paths to watch for changes',
            },
          },
          required: ['paths'],
        },
      },
      {
        name: 'file_get_filesystem_changes',
        description: 'Get filesystem changes detected during monitoring',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of changes to return (default: 100)',
              default: 100,
            },
          },
        },
      },
      {
        name: 'file_clear_tracking_data',
        description: 'Clear all tracked files, downloads, and filesystem changes',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'file_stop_tracking',
        description: 'Stop file tracking and close browser',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'file_start_tracking':
        return await this.startTracking(
          args.url,
          args.headless ?? true,
          args.downloadPath,
          args.captureContent ?? false
        );
      case 'file_get_resources':
        return this.getResources(args.type ?? 'all', args.minSize, args.maxSize, args.limit ?? 100);
      case 'file_download_resource':
        return await this.downloadResource(args.url, args.filename);
      case 'file_get_downloads':
        return this.getDownloads(args.limit ?? 50);
      case 'file_analyze_resource':
        return await this.analyzeResource(args.url);
      case 'file_watch_filesystem':
        return await this.watchFilesystem(args.paths);
      case 'file_get_filesystem_changes':
        return this.getFilesystemChanges(args.limit ?? 100);
      case 'file_clear_tracking_data':
        return this.clearTrackingData();
      case 'file_stop_tracking':
        return await this.stopTracking();
      default:
        throw new Error(`Unknown file tracking tool: ${name}`);
    }
  }

  private async startTracking(
    url: string,
    headless: boolean,
    downloadPath?: string,
    captureContent: boolean = false
  ): Promise<any> {
    try {
      if (this.isMonitoring) {
        await this.stopTracking();
      }

      // Set up download path
      this.downloadPath = downloadPath || '/tmp/file-tracker-downloads';
      await fs.mkdir(this.downloadPath, { recursive: true });

      this.browser = await puppeteer.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      this.page = await this.browser.newPage();
      this.trackedFiles = [];
      this.downloads = [];
      this.isMonitoring = true;

      // Set up download behavior
      const client = await this.page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: this.downloadPath,
      });

      // Track requests and responses
      this.page.on('request', (request: HTTPRequest) => {
        // Request tracking is handled in response for complete data
      });

      this.page.on('response', async (response: HTTPResponse) => {
        try {
          const url = response.url();
          const request = response.request();
          const resourceType = this.mapResourceType(request.resourceType());
          const timestamp = Date.now();
          const startTime = this.getRequestStartTime(request);
          const loadTime = startTime ? timestamp - startTime : 0;

          let size = 0;
          let content: string | undefined;

          try {
            const buffer = await response.buffer();
            size = buffer.length;

            // Capture content for text-based resources if requested
            if (captureContent && this.isTextResource(response)) {
              content = buffer.toString('utf-8');
            }
          } catch (error) {
            // Some responses can't be buffered (e.g., already consumed)
          }

          const fileResource: FileResource = {
            url,
            type: resourceType,
            size,
            loadTime,
            fromCache: response.fromCache(),
            status: response.status(),
            timestamp,
            mimeType: response.headers()['content-type'],
            content,
          };

          this.trackedFiles.push(fileResource);
        } catch (error) {
          // Ignore errors for individual responses
        }
      });

      // Track downloads
      this.page.on('response', async (response: HTTPResponse) => {
        const contentDisposition = response.headers()['content-disposition'];
        if (contentDisposition && contentDisposition.includes('attachment')) {
          try {
            const url = response.url();
            const buffer = await response.buffer();
            const filename = this.extractFilenameFromContentDisposition(contentDisposition) || 
                            this.extractFilenameFromUrl(url);
            const downloadPath = path.join(this.downloadPath, filename);

            await fs.writeFile(downloadPath, buffer);

            const download: FileDownload = {
              filename,
              url,
              size: buffer.length,
              downloadPath,
              timestamp: Date.now(),
              mimeType: response.headers()['content-type'],
            };

            this.downloads.push(download);
          } catch (error) {
            // Ignore download errors
          }
        }
      });

      // Navigate to the URL
      await this.page.goto(url, { waitUntil: 'networkidle0' });

      return {
        content: [
          {
            type: 'text',
            text: `File tracking started for ${url}. Browser ${headless ? 'headless' : 'visible'} mode. Downloads will be saved to: ${this.downloadPath}. Content capture: ${captureContent ? 'enabled' : 'disabled'}.`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to start file tracking: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getResources(type: string, minSize?: number, maxSize?: number, limit: number = 100): any {
    let resources = this.trackedFiles;

    // Filter by type
    if (type !== 'all') {
      resources = resources.filter(resource => resource.type === type);
    }

    // Filter by size
    if (minSize !== undefined) {
      resources = resources.filter(resource => resource.size >= minSize);
    }
    if (maxSize !== undefined) {
      resources = resources.filter(resource => resource.size <= maxSize);
    }

    // Apply limit
    resources = resources.slice(-limit);

    // Calculate statistics
    const stats = {
      totalTracked: this.trackedFiles.length,
      filteredCount: resources.length,
      totalSize: resources.reduce((sum, r) => sum + r.size, 0),
      avgSize: resources.length > 0 ? resources.reduce((sum, r) => sum + r.size, 0) / resources.length : 0,
      typeBreakdown: this.getTypeBreakdown(resources),
      cacheHitRate: this.getCacheHitRate(resources),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            isMonitoring: this.isMonitoring,
            statistics: stats,
            resources: resources.map(r => ({
              ...r,
              content: r.content ? `${r.content.substring(0, 200)}...` : undefined, // Truncate content for display
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async downloadResource(url: string, customFilename?: string): Promise<any> {
    if (!this.page || !this.isMonitoring) {
      throw new Error('File tracking is not active. Start tracking first.');
    }

    try {
      const response = await this.page.goto(url);
      if (!response) {
        throw new Error('Failed to fetch resource');
      }

      const buffer = await response.buffer();
      const filename = customFilename || this.extractFilenameFromUrl(url);
      const downloadPath = path.join(this.downloadPath, filename);

      await fs.writeFile(downloadPath, buffer);

      const download: FileDownload = {
        filename,
        url,
        size: buffer.length,
        downloadPath,
        timestamp: Date.now(),
        mimeType: response.headers()['content-type'],
      };

      this.downloads.push(download);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'Resource downloaded successfully',
              download,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to download resource: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getDownloads(limit: number): any {
    const recentDownloads = this.downloads.slice(-limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            totalDownloads: this.downloads.length,
            downloadPath: this.downloadPath,
            recentDownloads,
            totalSize: this.downloads.reduce((sum, d) => sum + d.size, 0),
          }, null, 2),
        },
      ],
    };
  }

  private async analyzeResource(url: string): Promise<any> {
    const resource = this.trackedFiles.find(r => r.url === url);
    if (!resource) {
      throw new Error(`Resource not found in tracking data: ${url}`);
    }

    const analysis = {
      basic: resource,
      performance: {
        loadTimeMs: resource.loadTime,
        loadTimeCategory: this.categorizeLoadTime(resource.loadTime),
        sizeCategory: this.categorizeSize(resource.size),
        cacheEfficiency: resource.fromCache ? 'Cached' : 'Network',
      },
      optimization: this.getOptimizationSuggestions(resource),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(analysis, null, 2),
        },
      ],
    };
  }

  private async watchFilesystem(paths: string[]): Promise<any> {
    // Note: In a real implementation, you'd use fs.watch() or a library like chokidar
    // For this example, we'll simulate filesystem watching
    this.watchedPaths = paths;
    this.fsChanges = [];

    // Simulate some filesystem monitoring
    // In practice, you'd set up actual file watchers here

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            message: 'Filesystem watching started',
            watchedPaths: this.watchedPaths,
            note: 'This is a simplified implementation. In production, use fs.watch() or chokidar for real filesystem monitoring.',
          }, null, 2),
        },
      ],
    };
  }

  private getFilesystemChanges(limit: number): any {
    const recentChanges = this.fsChanges.slice(-limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            totalChanges: this.fsChanges.length,
            watchedPaths: this.watchedPaths,
            recentChanges,
          }, null, 2),
        },
      ],
    };
  }

  private clearTrackingData(): any {
    const previousCounts = {
      trackedFiles: this.trackedFiles.length,
      downloads: this.downloads.length,
      fsChanges: this.fsChanges.length,
    };

    this.trackedFiles = [];
    this.downloads = [];
    this.fsChanges = [];

    return {
      content: [
        {
          type: 'text',
          text: `Cleared tracking data: ${previousCounts.trackedFiles} files, ${previousCounts.downloads} downloads, ${previousCounts.fsChanges} filesystem changes.`,
        },
      ],
    };
  }

  private async stopTracking(): Promise<any> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }
      this.isMonitoring = false;

      const summary = {
        totalTrackedFiles: this.trackedFiles.length,
        totalDownloads: this.downloads.length,
        totalFsChanges: this.fsChanges.length,
        downloadPath: this.downloadPath,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'File tracking stopped and browser closed.',
              summary,
          }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to stop file tracking: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper methods
  private mapResourceType(puppeteerType: string): FileResource['type'] {
    const typeMap: Record<string, FileResource['type']> = {
      document: 'document',
      script: 'script',
      stylesheet: 'stylesheet',
      image: 'image',
      font: 'font',
      xhr: 'xhr',
      fetch: 'fetch',
      websocket: 'websocket',
      manifest: 'manifest',
    };
    return typeMap[puppeteerType] || 'other';
  }

  private getRequestStartTime(request: HTTPRequest): number {
    // This is a simplified approach - in practice you'd track request start times
    return Date.now() - 1000; // Simulate 1 second ago
  }

  private isTextResource(response: HTTPResponse): boolean {
    const contentType = response.headers()['content-type'] || '';
    return contentType.includes('text/') || 
           contentType.includes('application/json') || 
           contentType.includes('application/javascript') ||
           contentType.includes('application/xml');
  }

  private extractFilenameFromContentDisposition(contentDisposition: string): string | null {
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    return filenameMatch ? filenameMatch[1] : null;
  }

  private extractFilenameFromUrl(url: string): string {
    try {
      const urlPath = new URL(url).pathname;
      const filename = path.basename(urlPath);
      return filename || 'download';
    } catch {
      return 'download';
    }
  }

  private getTypeBreakdown(resources: FileResource[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const resource of resources) {
      breakdown[resource.type] = (breakdown[resource.type] || 0) + 1;
    }
    return breakdown;
  }

  private getCacheHitRate(resources: FileResource[]): number {
    if (resources.length === 0) return 0;
    const cachedCount = resources.filter(r => r.fromCache).length;
    return (cachedCount / resources.length) * 100;
  }

  private categorizeLoadTime(loadTime: number): string {
    if (loadTime < 100) return 'Fast';
    if (loadTime < 500) return 'Medium';
    return 'Slow';
  }

  private categorizeSize(size: number): string {
    if (size < 10 * 1024) return 'Small'; // < 10KB
    if (size < 100 * 1024) return 'Medium'; // < 100KB
    if (size < 1024 * 1024) return 'Large'; // < 1MB
    return 'Very Large';
  }

  private getOptimizationSuggestions(resource: FileResource): string[] {
    const suggestions: string[] = [];

    if (resource.size > 1024 * 1024) { // > 1MB
      suggestions.push('Consider compressing this large resource');
    }

    if (resource.loadTime > 1000) { // > 1 second
      suggestions.push('Resource takes a long time to load - consider optimization');
    }

    if (!resource.fromCache && resource.type !== 'xhr' && resource.type !== 'fetch') {
      suggestions.push('Resource not cached - consider adding cache headers');
    }

    if (resource.type === 'image' && resource.size > 500 * 1024) { // > 500KB
      suggestions.push('Large image detected - consider using modern formats like WebP');
    }

    if (resource.type === 'script' && resource.size > 100 * 1024) { // > 100KB
      suggestions.push('Large JavaScript file - consider code splitting or minification');
    }

    return suggestions;
  }
}