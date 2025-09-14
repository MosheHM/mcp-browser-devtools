import puppeteer, { Browser, Page, HTTPRequest, HTTPResponse } from 'puppeteer';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SecurityValidator, MemoryManager, RateLimiter, TimeoutManager } from '../utils/security';

export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: number;
  resourceType: string;
}

export interface NetworkResponse {
  id: string;
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  timestamp: number;
  size?: number;
  duration?: number;
  fromCache: boolean;
}

export interface NetworkActivity {
  requests: NetworkRequest[];
  responses: NetworkResponse[];
  failures: Array<{
    url: string;
    errorText: string;
    timestamp: number;
  }>;
}

export class NetworkMonitor {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private networkActivity: NetworkActivity = {
    requests: [],
    responses: [],
    failures: [],
  };
  private isMonitoring = false;
  private requestTimestamps = new Map<string, number>();
  private readonly MAX_NETWORK_ITEMS = 1000;
  private readonly MAX_REQUEST_SIZE = 1024 * 1024; // 1MB
  private readonly SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

  getTools(): Tool[] {
    return [
      {
        name: 'network_start_monitoring',
        description: 'Start monitoring network activity for a webpage',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL of the webpage to monitor',
            },
            headless: {
              type: 'boolean',
              description: 'Run browser in headless mode (default: true)',
              default: true,
            },
            interceptRequests: {
              type: 'boolean',
              description: 'Enable request interception for detailed analysis (default: false)',
              default: false,
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'network_get_activity',
        description: 'Get collected network activity',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              enum: ['all', 'requests', 'responses', 'failures'],
              description: 'Filter activity type (default: all)',
              default: 'all',
            },
            resourceType: {
              type: 'string',
              description: 'Filter by resource type (document, stylesheet, image, script, xhr, fetch, etc.)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of items to return per category (default: 100)',
              default: 100,
            },
          },
        },
      },
      {
        name: 'network_get_performance_metrics',
        description: 'Get network performance metrics',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'network_clear_activity',
        description: 'Clear collected network activity',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'network_stop_monitoring',
        description: 'Stop network monitoring and close browser',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'network_navigate',
        description: 'Navigate to a new URL while monitoring network activity',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to navigate to',
            },
            waitUntil: {
              type: 'string',
              enum: ['load', 'networkidle0', 'networkidle2', 'domcontentloaded'],
              description: 'When to consider navigation finished (default: networkidle0)',
              default: 'networkidle0',
            },
          },
          required: ['url'],
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'network_start_monitoring':
        return await this.startMonitoring(args.url, args.headless ?? true, args.interceptRequests ?? false);
      case 'network_get_activity':
        return this.getActivity(args.filter ?? 'all', args.resourceType, args.limit ?? 100);
      case 'network_get_performance_metrics':
        return await this.getPerformanceMetrics();
      case 'network_clear_activity':
        return this.clearActivity();
      case 'network_stop_monitoring':
        return await this.stopMonitoring();
      case 'network_navigate':
        return await this.navigate(args.url, args.waitUntil ?? 'networkidle0');
      default:
        throw new Error(`Unknown network tool: ${name}`);
    }
  }

  private async startMonitoring(url: string, headless: boolean, interceptRequests: boolean): Promise<any> {
    try {
      if (this.isMonitoring) {
        await this.stopMonitoring();
      }

      this.browser = await puppeteer.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      this.page = await this.browser.newPage();
      this.clearNetworkActivity();
      this.isMonitoring = true;

      if (interceptRequests) {
        await this.page.setRequestInterception(true);
      }

      // Monitor requests
      this.page.on('request', (request: HTTPRequest) => {
        const id = request.url() + '_' + Date.now();
        const timestamp = Date.now();
        this.requestTimestamps.set(request.url(), timestamp);

        const networkRequest: NetworkRequest = {
          id,
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData(),
          timestamp,
          resourceType: request.resourceType(),
        };

        this.networkActivity.requests.push(networkRequest);

        if (interceptRequests) {
          request.continue();
        }
      });

      // Monitor responses
      this.page.on('response', (response: HTTPResponse) => {
        const timestamp = Date.now();
        const requestTimestamp = this.requestTimestamps.get(response.url());
        const duration = requestTimestamp ? timestamp - requestTimestamp : undefined;

        const networkResponse: NetworkResponse = {
          id: response.url() + '_' + timestamp,
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          headers: response.headers(),
          timestamp,
          duration,
          fromCache: response.fromCache(),
        };

        // Try to get response size
        response.text().then(text => {
          networkResponse.size = text.length;
        }).catch(() => {
          // Response might be binary or not accessible
        });

        this.networkActivity.responses.push(networkResponse);
      });

      // Monitor failed requests
      this.page.on('requestfailed', (request: HTTPRequest) => {
        this.networkActivity.failures.push({
          url: request.url(),
          errorText: request.failure()?.errorText || 'Unknown error',
          timestamp: Date.now(),
        });
      });

      // Navigate to the URL
      await this.page.goto(url, { waitUntil: 'networkidle0' });

      return {
        content: [
          {
            type: 'text',
            text: `Network monitoring started for ${url}. Browser ${headless ? 'headless' : 'visible'} mode. Request interception: ${interceptRequests ? 'enabled' : 'disabled'}.`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to start network monitoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getActivity(filter: string, resourceType?: string, limit: number = 100): any {
    let activity = { ...this.networkActivity };

    // Filter by resource type if specified
    if (resourceType) {
      activity.requests = activity.requests.filter(req => req.resourceType === resourceType);
      activity.responses = activity.responses.filter(res => 
        activity.requests.some(req => req.url === res.url)
      );
    }

    // Apply limits
    activity.requests = activity.requests.slice(-limit);
    activity.responses = activity.responses.slice(-limit);
    activity.failures = activity.failures.slice(-limit);

    // Filter by type
    let result: any = {
      isMonitoring: this.isMonitoring,
      totalRequests: this.networkActivity.requests.length,
      totalResponses: this.networkActivity.responses.length,
      totalFailures: this.networkActivity.failures.length,
    };

    switch (filter) {
      case 'requests':
        result.requests = activity.requests;
        break;
      case 'responses':
        result.responses = activity.responses;
        break;
      case 'failures':
        result.failures = activity.failures;
        break;
      default:
        result = { ...result, ...activity };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async getPerformanceMetrics(): Promise<any> {
    if (!this.page || !this.isMonitoring) {
      throw new Error('Network monitoring is not active. Start monitoring first.');
    }

    try {
      const metrics = await this.page.metrics();
      const navigationTiming = await this.page.evaluate(() => {
        const timing = performance.timing;
        return {
          navigationStart: timing.navigationStart,
          domainLookupStart: timing.domainLookupStart,
          domainLookupEnd: timing.domainLookupEnd,
          connectStart: timing.connectStart,
          connectEnd: timing.connectEnd,
          requestStart: timing.requestStart,
          responseStart: timing.responseStart,
          responseEnd: timing.responseEnd,
          domContentLoadedEventStart: timing.domContentLoadedEventStart,
          domContentLoadedEventEnd: timing.domContentLoadedEventEnd,
          loadEventStart: timing.loadEventStart,
          loadEventEnd: timing.loadEventEnd,
        };
      });

      // Calculate derived metrics
      const derived = {
        dnsLookup: navigationTiming.domainLookupEnd - navigationTiming.domainLookupStart,
        tcpConnect: navigationTiming.connectEnd - navigationTiming.connectStart,
        ttfb: navigationTiming.responseStart - navigationTiming.requestStart,
        pageLoad: navigationTiming.loadEventEnd - navigationTiming.navigationStart,
        domContentLoaded: navigationTiming.domContentLoadedEventEnd - navigationTiming.navigationStart,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              puppeteerMetrics: metrics,
              navigationTiming,
              derivedMetrics: derived,
              networkActivity: {
                totalRequests: this.networkActivity.requests.length,
                totalResponses: this.networkActivity.responses.length,
                totalFailures: this.networkActivity.failures.length,
                avgResponseTime: this.calculateAverageResponseTime(),
              },
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get performance metrics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private calculateAverageResponseTime(): number {
    const responsesWithDuration = this.networkActivity.responses.filter(res => res.duration !== undefined);
    if (responsesWithDuration.length === 0) return 0;
    
    const totalDuration = responsesWithDuration.reduce((sum, res) => sum + (res.duration || 0), 0);
    return totalDuration / responsesWithDuration.length;
  }

  private clearActivity(): any {
    const previousCounts = {
      requests: this.networkActivity.requests.length,
      responses: this.networkActivity.responses.length,
      failures: this.networkActivity.failures.length,
    };

    this.clearNetworkActivity();

    return {
      content: [
        {
          type: 'text',
          text: `Cleared network activity: ${previousCounts.requests} requests, ${previousCounts.responses} responses, ${previousCounts.failures} failures.`,
        },
      ],
    };
  }

  private clearNetworkActivity(): void {
    this.networkActivity = {
      requests: [],
      responses: [],
      failures: [],
    };
    this.requestTimestamps.clear();
  }

  private async stopMonitoring(): Promise<any> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }
      this.isMonitoring = false;

      return {
        content: [
          {
            type: 'text',
            text: 'Network monitoring stopped and browser closed.',
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to stop network monitoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async navigate(url: string, waitUntil: string): Promise<any> {
    if (!this.page || !this.isMonitoring) {
      throw new Error('Network monitoring is not active. Start monitoring first.');
    }

    try {
      const startTime = Date.now();
      await this.page.goto(url, { waitUntil: waitUntil as any });
      const loadTime = Date.now() - startTime;

      return {
        content: [
          {
            type: 'text',
            text: `Navigated to ${url} in ${loadTime}ms. Wait condition: ${waitUntil}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to navigate: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}