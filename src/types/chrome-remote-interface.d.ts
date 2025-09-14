declare module 'chrome-remote-interface' {
  interface Client {
    Page: {
      enable(): Promise<void>;
      navigate(params: { url: string }): Promise<void>;
      captureScreenshot(params?: {
        format?: 'png' | 'jpeg';
        quality?: number;
        clip?: unknown;
      }): Promise<{ data: string }>;
      once(event: string, callback: () => void): void;
      removeListener(event: string, callback: () => void): void;
    };

    Runtime: {
      enable(): Promise<void>;
      evaluate(params: {
        expression: string;
        returnByValue?: boolean;
        timeout?: number;
        userGesture?: boolean;
        awaitPromise?: boolean;
      }): Promise<{
        result?: { value?: unknown };
        exceptionDetails?: { text?: string };
      }>;
    };

    Security?: {
      enable?(): Promise<void>;
      getSecurityState(): Promise<{ securityState?: string }>;
    };

    Target?: {
      getTargetInfo?(): Promise<{
        targetInfo?: {
          targetId?: string;
          type?: string;
          url?: string;
        };
      }>;
    };

    close(): Promise<void>;
  }

  interface Options {
    host?: string;
    port?: number;
  }

  function CDP(options?: Options): Promise<Client>;

  export = CDP;
}
