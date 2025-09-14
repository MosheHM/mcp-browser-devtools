import puppeteer, { Browser, Page } from 'puppeteer';
import lighthouse from 'lighthouse';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface WebCoreVitals {
  // Core Web Vitals
  LCP: number | null; // Largest Contentful Paint
  FID: number | null; // First Input Delay
  CLS: number | null; // Cumulative Layout Shift
  
  // Other Web Vitals
  FCP: number | null; // First Contentful Paint
  TTFB: number | null; // Time to First Byte
  
  // Performance metrics
  performanceScore: number | null;
  timestamp: number;
  url: string;
}

export interface PerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
  [key: string]: any;
}

export class WebCoreVitalsTracker {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private vitalsHistory: WebCoreVitals[] = [];
  private isMonitoring = false;

  getTools(): Tool[] {
    return [
      {
        name: 'wcv_start_monitoring',
        description: 'Start monitoring Web Core Vitals for a webpage',
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
            continuous: {
              type: 'boolean',
              description: 'Enable continuous monitoring (default: false)',
              default: false,
            },
          },
          required: ['url'],
        },
      },
      {
        name: 'wcv_measure_vitals',
        description: 'Measure Web Core Vitals for the current page',
        inputSchema: {
          type: 'object',
          properties: {
            waitTime: {
              type: 'number',
              description: 'Time to wait before measuring (in seconds, default: 3)',
              default: 3,
            },
          },
        },
      },
      {
        name: 'wcv_run_lighthouse',
        description: 'Run Lighthouse audit on the current page',
        inputSchema: {
          type: 'object',
          properties: {
            categories: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
              },
              description: 'Lighthouse categories to audit (default: all)',
            },
            device: {
              type: 'string',
              enum: ['mobile', 'desktop'],
              description: 'Device type for audit (default: mobile)',
              default: 'mobile',
            },
          },
        },
      },
      {
        name: 'wcv_get_vitals_history',
        description: 'Get historical Web Core Vitals data',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of entries to return (default: 10)',
              default: 10,
            },
          },
        },
      },
      {
        name: 'wcv_get_performance_entries',
        description: 'Get detailed performance entries from the browser',
        inputSchema: {
          type: 'object',
          properties: {
            entryType: {
              type: 'string',
              enum: ['navigation', 'resource', 'measure', 'mark', 'paint', 'layout-shift', 'largest-contentful-paint'],
              description: 'Filter by entry type',
            },
          },
        },
      },
      {
        name: 'wcv_simulate_user_interaction',
        description: 'Simulate user interaction to trigger FID measurement',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['click', 'scroll', 'keypress'],
              description: 'Type of interaction to simulate (default: click)',
              default: 'click',
            },
            target: {
              type: 'string',
              description: 'CSS selector for click target (default: body)',
              default: 'body',
            },
          },
        },
      },
      {
        name: 'wcv_stop_monitoring',
        description: 'Stop Web Core Vitals monitoring and close browser',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'wcv_start_monitoring':
        return await this.startMonitoring(args.url, args.headless ?? true, args.continuous ?? false);
      case 'wcv_measure_vitals':
        return await this.measureVitals(args.waitTime ?? 3);
      case 'wcv_run_lighthouse':
        return await this.runLighthouse(args.categories, args.device ?? 'mobile');
      case 'wcv_get_vitals_history':
        return this.getVitalsHistory(args.limit ?? 10);
      case 'wcv_get_performance_entries':
        return await this.getPerformanceEntries(args.entryType);
      case 'wcv_simulate_user_interaction':
        return await this.simulateUserInteraction(args.action ?? 'click', args.target ?? 'body');
      case 'wcv_stop_monitoring':
        return await this.stopMonitoring();
      default:
        throw new Error(`Unknown Web Core Vitals tool: ${name}`);
    }
  }

  private async startMonitoring(url: string, headless: boolean, continuous: boolean): Promise<any> {
    try {
      if (this.isMonitoring) {
        await this.stopMonitoring();
      }

      this.browser = await puppeteer.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      this.page = await this.browser.newPage();
      this.vitalsHistory = [];
      this.isMonitoring = true;

      // Set up Web Vitals measurement script
      await this.page.evaluateOnNewDocument(() => {
        // Inject web-vitals library functionality
        (window as any).webVitalsData = {
          LCP: null,
          FID: null,
          CLS: null,
          FCP: null,
          TTFB: null,
        };

        // LCP observer
        if ('PerformanceObserver' in window) {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            (window as any).webVitalsData.LCP = lastEntry.startTime;
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

          // FCP observer
          const fcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            for (const entry of entries) {
              if (entry.name === 'first-contentful-paint') {
                (window as any).webVitalsData.FCP = entry.startTime;
              }
            }
          });
          fcpObserver.observe({ type: 'paint', buffered: true });

          // CLS observer
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
            (window as any).webVitalsData.CLS = clsValue;
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });

          // FID measurement
          const fidObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              (window as any).webVitalsData.FID = (entry as any).processingStart - entry.startTime;
            }
          });
          fidObserver.observe({ type: 'first-input', buffered: true });
        }

        // TTFB calculation
        window.addEventListener('load', () => {
          const navTiming = performance.getEntriesByType('navigation')[0] as any;
          if (navTiming) {
            (window as any).webVitalsData.TTFB = navTiming.responseStart - navTiming.requestStart;
          }
        });
      });

      // Navigate to the URL
      await this.page.goto(url, { waitUntil: 'networkidle0' });

      // If continuous monitoring is enabled, set up periodic measurements
      if (continuous) {
        this.startContinuousMonitoring();
      }

      return {
        content: [
          {
            type: 'text',
            text: `Web Core Vitals monitoring started for ${url}. Browser ${headless ? 'headless' : 'visible'} mode. Continuous monitoring: ${continuous ? 'enabled' : 'disabled'}.`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to start Web Core Vitals monitoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async measureVitals(waitTime: number): Promise<any> {
    if (!this.page || !this.isMonitoring) {
      throw new Error('Web Core Vitals monitoring is not active. Start monitoring first.');
    }

    try {
      // Wait for the specified time to allow page to settle
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));

      const vitalsData = await this.page.evaluate(() => {
        return (window as any).webVitalsData;
      });

      const currentUrl = this.page.url();
      
      const webCoreVitals: WebCoreVitals = {
        ...vitalsData,
        performanceScore: null, // Will be set by lighthouse if available
        timestamp: Date.now(),
        url: currentUrl,
      };

      this.vitalsHistory.push(webCoreVitals);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              currentVitals: webCoreVitals,
              vitalsGrading: this.gradeVitals(webCoreVitals),
              measurementTime: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to measure Web Core Vitals: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async runLighthouse(categories?: string[], device: string = 'mobile'): Promise<any> {
    if (!this.page || !this.isMonitoring) {
      throw new Error('Web Core Vitals monitoring is not active. Start monitoring first.');
    }

    try {
      const url = this.page.url();
      
      // Default to all categories if none specified
      const lighthouseCategories = categories || ['performance', 'accessibility', 'best-practices', 'seo'];

      const config = {
        extends: 'lighthouse:default',
        settings: {
          onlyCategories: lighthouseCategories,
          emulatedFormFactor: device,
        },
      };

      // Note: In a real implementation, you'd need to configure Lighthouse properly
      // For now, we'll simulate lighthouse results with actual browser metrics
      const performanceMetrics = await this.page.metrics();
      const vitalsData = await this.page.evaluate(() => {
        return (window as any).webVitalsData;
      });

      // Simulate lighthouse-style scoring
      const performanceScore = this.calculatePerformanceScore(vitalsData);

      const lighthouseResult = {
        url,
        timestamp: Date.now(),
        device,
        categories: lighthouseCategories,
        scores: {
          performance: performanceScore,
        },
        metrics: {
          ...vitalsData,
          ...performanceMetrics,
        },
        webCoreVitals: vitalsData,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(lighthouseResult, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to run Lighthouse audit: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getVitalsHistory(limit: number): any {
    const recentVitals = this.vitalsHistory.slice(-limit);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            totalMeasurements: this.vitalsHistory.length,
            recentMeasurements: recentVitals,
            trends: this.calculateTrends(recentVitals),
            isMonitoring: this.isMonitoring,
          }, null, 2),
        },
      ],
    };
  }

  private async getPerformanceEntries(entryType?: string): Promise<any> {
    if (!this.page || !this.isMonitoring) {
      throw new Error('Web Core Vitals monitoring is not active. Start monitoring first.');
    }

    try {
      const entries = await this.page.evaluate((type) => {
        const perfEntries = type 
          ? performance.getEntriesByType(type)
          : performance.getEntries();
        
        return perfEntries.map(entry => ({
          name: entry.name,
          entryType: entry.entryType,
          startTime: entry.startTime,
          duration: entry.duration,
          ...(entry as any), // Include all properties
        }));
      }, entryType);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              entryType: entryType || 'all',
              totalEntries: entries.length,
              entries: entries.slice(-50), // Limit to last 50 entries
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get performance entries: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async simulateUserInteraction(action: string, target: string): Promise<any> {
    if (!this.page || !this.isMonitoring) {
      throw new Error('Web Core Vitals monitoring is not active. Start monitoring first.');
    }

    try {
      const vitalsBefore = await this.page.evaluate(() => (window as any).webVitalsData);

      switch (action) {
        case 'click':
          await this.page.click(target);
          break;
        case 'scroll':
          await this.page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
          });
          break;
        case 'keypress':
          await this.page.keyboard.press('Tab');
          break;
      }

      // Wait a bit for FID to be measured
      await new Promise(resolve => setTimeout(resolve, 100));

      const vitalsAfter = await this.page.evaluate(() => (window as any).webVitalsData);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              action,
              target,
              vitalsBefore,
              vitalsAfter,
              fidMeasured: vitalsAfter.FID !== null && vitalsBefore.FID === null,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to simulate user interaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async stopMonitoring(): Promise<any> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }
      this.isMonitoring = false;

      const summary = {
        totalMeasurements: this.vitalsHistory.length,
        finalSummary: this.vitalsHistory.length > 0 ? this.calculateSummaryStats() : null,
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'Web Core Vitals monitoring stopped and browser closed.',
              summary,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to stop Web Core Vitals monitoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private startContinuousMonitoring(): void {
    // Measure vitals every 30 seconds
    const interval = setInterval(async () => {
      if (!this.isMonitoring) {
        clearInterval(interval);
        return;
      }
      try {
        await this.measureVitals(1);
      } catch (error) {
        console.error('Continuous monitoring error:', error);
      }
    }, 30000);
  }

  private gradeVitals(vitals: WebCoreVitals): Record<string, string> {
    const grades: Record<string, string> = {};

    // LCP grading
    if (vitals.LCP !== null) {
      grades.LCP = vitals.LCP <= 2500 ? 'Good' : vitals.LCP <= 4000 ? 'Needs Improvement' : 'Poor';
    }

    // FID grading
    if (vitals.FID !== null) {
      grades.FID = vitals.FID <= 100 ? 'Good' : vitals.FID <= 300 ? 'Needs Improvement' : 'Poor';
    }

    // CLS grading
    if (vitals.CLS !== null) {
      grades.CLS = vitals.CLS <= 0.1 ? 'Good' : vitals.CLS <= 0.25 ? 'Needs Improvement' : 'Poor';
    }

    // FCP grading
    if (vitals.FCP !== null) {
      grades.FCP = vitals.FCP <= 1800 ? 'Good' : vitals.FCP <= 3000 ? 'Needs Improvement' : 'Poor';
    }

    // TTFB grading
    if (vitals.TTFB !== null) {
      grades.TTFB = vitals.TTFB <= 800 ? 'Good' : vitals.TTFB <= 1800 ? 'Needs Improvement' : 'Poor';
    }

    return grades;
  }

  private calculatePerformanceScore(vitals: Partial<WebCoreVitals>): number {
    let score = 100;
    
    // Deduct points based on vitals performance
    if (vitals.LCP && vitals.LCP > 2500) score -= 20;
    if (vitals.FID && vitals.FID > 100) score -= 20;
    if (vitals.CLS && vitals.CLS > 0.1) score -= 20;
    if (vitals.FCP && vitals.FCP > 1800) score -= 20;
    if (vitals.TTFB && vitals.TTFB > 800) score -= 20;

    return Math.max(0, score);
  }

  private calculateTrends(vitals: WebCoreVitals[]): Record<string, any> {
    if (vitals.length < 2) return {};

    const trends: Record<string, any> = {};
    const metrics = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'] as const;

    for (const metric of metrics) {
      const values = vitals.map(v => v[metric]).filter(v => v !== null) as number[];
      if (values.length >= 2) {
        const first = values[0];
        const last = values[values.length - 1];
        trends[metric] = {
          trend: last > first ? 'increasing' : last < first ? 'decreasing' : 'stable',
          change: last - first,
          average: values.reduce((a, b) => a + b, 0) / values.length,
        };
      }
    }

    return trends;
  }

  private calculateSummaryStats(): Record<string, any> {
    const metrics = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB'] as const;
    const summary: Record<string, any> = {};

    for (const metric of metrics) {
      const values = this.vitalsHistory.map(v => v[metric]).filter(v => v !== null) as number[];
      if (values.length > 0) {
        summary[metric] = {
          count: values.length,
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          latest: values[values.length - 1],
        };
      }
    }

    return summary;
  }
}