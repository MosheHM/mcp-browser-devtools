import { z } from 'zod';

/**
 * Configuration schema for browser DevTools connection with security validation
 */
export const DevToolsConfigSchema = z.object({
  /** DevTools port number (must be in safe range) */
  port: z.number().int().min(1024).max(65535).default(9222),
  
  /** Host address (restricted to localhost/loopback for security) */
  host: z.string().regex(/^(localhost|127\.0\.0\.1|::1)$/).default('localhost'),
  
  /** Connection timeout in milliseconds */
  timeout: z.number().int().min(1000).max(30000).default(10000),
  
  /** Maximum number of retry attempts */
  maxRetries: z.number().int().min(0).max(5).default(3),
  
  /** Enable secure mode (additional validations) */
  secureMode: z.boolean().default(true),
  
  /** List of allowed origins for additional security */
  allowedOrigins: z.array(z.string().url()).optional(),
  
  /** Maximum execution time for JavaScript code in milliseconds */
  maxExecutionTime: z.number().int().min(100).max(10000).default(5000),
});

export type DevToolsConfig = z.infer<typeof DevToolsConfigSchema>;

/**
 * JavaScript execution parameters with security constraints
 */
export const JavaScriptExecutionSchema = z.object({
  code: z.string()
    .min(1, 'Code cannot be empty')
    .max(10000, 'Code too long for security reasons')
    .refine(
      (code) => !code.includes('eval(') && !code.includes('Function('),
      'Dynamic code execution (eval, Function) is not allowed for security'
    ),
  
  /** Context for execution (optional) */
  context: z.enum(['page', 'worker', 'isolated']).default('page'),
  
  /** Whether to return the result value */
  returnValue: z.boolean().default(true),
  
  /** Timeout for this specific execution */
  timeout: z.number().int().min(100).max(10000).optional(),
});

export type JavaScriptExecution = z.infer<typeof JavaScriptExecutionSchema>;

/**
 * Navigation parameters with URL validation
 */
export const NavigationSchema = z.object({
  url: z.string().url('Must be a valid URL').refine(
    (url) => {
      const parsed = new URL(url);
      // Allow only HTTP/HTTPS protocols for security
      return ['http:', 'https:'].includes(parsed.protocol);
    },
    'Only HTTP and HTTPS URLs are allowed'
  ),
  
  /** Wait for page load event */
  waitForLoad: z.boolean().default(true),
  
  /** Timeout for navigation */
  timeout: z.number().int().min(1000).max(30000).default(10000),
});

export type Navigation = z.infer<typeof NavigationSchema>;

/**
 * Page information response
 */
export const PageInfoSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  readyState: z.enum(['loading', 'interactive', 'complete']),
  timestamp: z.number(),
});

export type PageInfo = z.infer<typeof PageInfoSchema>;

/**
 * DevTools connection status
 */
export const ConnectionStatusSchema = z.object({
  connected: z.boolean(),
  targetId: z.string().optional(),
  targetType: z.string().optional(),
  url: z.string().url().optional(),
  lastActivity: z.number().optional(),
});

export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;