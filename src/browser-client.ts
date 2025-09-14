import CDP from 'chrome-remote-interface';
import { DevToolsConfig, ConnectionStatus, PageInfo } from './types.js';

type CDPClient = ReturnType<typeof CDP> extends Promise<infer T> ? T : never;

/**
 * Secure browser DevTools client with connection management
 */
export class SecureBrowserClient {
  private client: CDPClient | null = null;
  private readonly config: DevToolsConfig;
  private lastActivity: number = 0;
  private isConnecting: boolean = false;

  constructor(config: DevToolsConfig) {
    this.config = config;
  }

  /**
   * Establish connection to browser DevTools with security validations
   */
  async connect(): Promise<void> {
    if (this.isConnecting) {
      throw new Error('Connection already in progress');
    }

    if (this.client) {
      await this.disconnect();
    }

    this.isConnecting = true;

    try {
      // Security: Only allow localhost connections
      if (!['localhost', '127.0.0.1', '::1'].includes(this.config.host)) {
        throw new Error('Only localhost connections are allowed for security');
      }

      // Connect with timeout
      const connectPromise = CDP({
        host: this.config.host,
        port: this.config.port,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), this.config.timeout);
      });

      this.client = await Promise.race([connectPromise, timeoutPromise]);
      this.lastActivity = Date.now();

      // Enable necessary domains
      await Promise.all([
        this.client.Page.enable(),
        this.client.Runtime.enable(),
        this.client.Security?.enable?.().catch(() => {
          // Security domain might not be available in all contexts
        }),
      ]);

      console.error('Connected to browser DevTools successfully');
    } catch (error) {
      this.client = null;
      throw new Error(`Failed to connect to browser: ${(error as Error).message}`);
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from browser DevTools
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('Error during disconnect:', error);
      } finally {
        this.client = null;
      }
    }
  }

  /**
   * Ensure we have an active connection
   */
  private async ensureConnection(): Promise<CDPClient> {
    if (!this.client) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error('Failed to establish connection');
    }

    this.lastActivity = Date.now();
    return this.client;
  }

  /**
   * Get current connection status
   */
  async getConnectionStatus(): Promise<ConnectionStatus> {
    try {
      if (!this.client) {
        return { connected: false };
      }

      const target = await this.client.Target?.getTargetInfo?.();
      return {
        connected: true,
        targetId: target?.targetInfo?.targetId,
        targetType: target?.targetInfo?.type,
        url: target?.targetInfo?.url,
        lastActivity: this.lastActivity,
      };
    } catch {
      return { connected: false };
    }
  }

  /**
   * Execute JavaScript with security constraints
   */
  async executeJavaScript(code: string, timeout?: number): Promise<unknown> {
    const client = await this.ensureConnection();
    const execTimeout = timeout ?? this.config.maxExecutionTime;

    try {
      // Security: Basic code validation
      if (code.includes('eval(') || code.includes('Function(') || code.includes('setTimeout(')) {
        throw new Error('Potentially unsafe JavaScript detected');
      }

      const executePromise = client.Runtime.evaluate({
        expression: code,
        returnByValue: true,
        timeout: execTimeout,
        userGesture: false,
        awaitPromise: true,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('JavaScript execution timeout')), execTimeout);
      });

      const result = await Promise.race([executePromise, timeoutPromise]);

      if (result.exceptionDetails) {
        throw new Error(`JavaScript error: ${result.exceptionDetails.text || 'Unknown error'}`);
      }

      return result.result?.value;
    } catch (error) {
      throw new Error(`JavaScript execution failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get page title safely
   */
  async getPageTitle(): Promise<string> {
    const title = await this.executeJavaScript('document.title');
    return typeof title === 'string' ? title : 'No title found';
  }

  /**
   * Get page URL safely
   */
  async getPageUrl(): Promise<string> {
    const url = await this.executeJavaScript('window.location.href');
    return typeof url === 'string' ? url : '';
  }

  /**
   * Get comprehensive page information
   */
  async getPageInfo(): Promise<PageInfo> {
    const [title, url, readyState] = await Promise.all([
      this.getPageTitle(),
      this.getPageUrl(),
      this.executeJavaScript('document.readyState'),
    ]);

    return {
      title,
      url,
      readyState: readyState as 'loading' | 'interactive' | 'complete',
      timestamp: Date.now(),
    };
  }

  /**
   * Get page HTML source with size limits
   */
  async getPageSource(): Promise<string> {
    const source = await this.executeJavaScript(`
      const html = document.documentElement.outerHTML;
      if (html.length > 1000000) {
        throw new Error('Page source too large for security (>1MB)');
      }
      html;
    `);
    return typeof source === 'string' ? source : '';
  }

  /**
   * Navigate to URL with security validation
   */
  async navigateToUrl(url: string, waitForLoad: boolean = true, timeout: number = 10000): Promise<void> {
    const client = await this.ensureConnection();

    try {
      // Security: Validate URL
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only HTTP and HTTPS URLs are allowed');
      }

      const navigatePromise = client.Page.navigate({ url });
      
      if (waitForLoad) {
        const loadPromise = new Promise<void>((resolve) => {
          const cleanup = (): void => {
            client.Page.removeListener('loadEventFired', resolve);
          };
          client.Page.once('loadEventFired', () => {
            cleanup();
            resolve();
          });
          // Cleanup on timeout
          setTimeout(cleanup, timeout);
        });

        await Promise.all([navigatePromise, loadPromise]);
      } else {
        await navigatePromise;
      }
    } catch (error) {
      throw new Error(`Navigation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Take a screenshot (base64 encoded)
   */
  async takeScreenshot(): Promise<string> {
    const client = await this.ensureConnection();

    try {
      const result = await client.Page.captureScreenshot({
        format: 'png',
        quality: 80,
        clip: undefined, // Full page
      });

      return result.data;
    } catch (error) {
      throw new Error(`Screenshot failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get security state of the page
   */
  async getSecurityState(): Promise<string> {
    try {
      const client = await this.ensureConnection();
      if (client.Security) {
        const state = await client.Security.getSecurityState();
        return state.securityState || 'unknown';
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }
}