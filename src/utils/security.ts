// Security and Input Validation Utilities
export class SecurityValidator {
  private static readonly ALLOWED_PROTOCOLS = ['http:', 'https:', 'data:'];
  private static readonly BLOCKED_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  private static readonly MAX_URL_LENGTH = 2048;
  private static readonly MAX_SCRIPT_LENGTH = 10000;
  private static readonly MAX_FILENAME_LENGTH = 255;
  private static readonly BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.msi'];
  private static readonly DANGEROUS_PATHS = ['/etc/', '/proc/', '/sys/', '/root', '/home/', 'C:\\Windows', 'C:\\System32'];

  /**
   * Validates and sanitizes URLs for security
   */
  static validateUrl(url: string): { isValid: boolean; sanitized?: string; error?: string } {
    if (!url || typeof url !== 'string') {
      return { isValid: false, error: 'URL must be a non-empty string' };
    }

    if (url.length > this.MAX_URL_LENGTH) {
      return { isValid: false, error: 'URL exceeds maximum length' };
    }

    try {
      const urlObj = new URL(url);
      
      // Check protocol
      if (!this.ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
        return { isValid: false, error: `Protocol ${urlObj.protocol} is not allowed` };
      }

      // Block local/internal addresses
      if (this.BLOCKED_DOMAINS.some(domain => urlObj.hostname.includes(domain))) {
        return { isValid: false, error: 'Access to local/internal addresses is not allowed' };
      }

      // Additional security checks
      if (urlObj.protocol === 'data:' && urlObj.pathname.includes('<script')) {
        return { isValid: false, error: 'Script injection in data URLs is not allowed' };
      }

      return { isValid: true, sanitized: url };
    } catch (error) {
      return { isValid: false, error: 'Invalid URL format' };
    }
  }

  /**
   * Validates and sanitizes JavaScript code
   */
  static validateScript(script: string): { isValid: boolean; sanitized?: string; error?: string } {
    if (!script || typeof script !== 'string') {
      return { isValid: false, error: 'Script must be a non-empty string' };
    }

    if (script.length > this.MAX_SCRIPT_LENGTH) {
      return { isValid: false, error: 'Script exceeds maximum length' };
    }

    // Block dangerous patterns
    const dangerousPatterns = [
      /while\s*\(\s*true\s*\)/gi,
      /for\s*\(\s*;\s*;\s*\)/gi,
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /setTimeout\s*\(\s*function\s*\(\s*\)\s*\{[^}]*while/gi,
      /window\.location\s*=/gi,
      /document\.write\s*\(/gi
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(script)) {
        return { isValid: false, error: 'Script contains potentially dangerous patterns' };
      }
    }

    return { isValid: true, sanitized: script };
  }

  /**
   * Validates and sanitizes file paths
   */
  static validateFilePath(filePath: string): { isValid: boolean; sanitized?: string; error?: string } {
    if (!filePath || typeof filePath !== 'string') {
      return { isValid: false, error: 'File path must be a non-empty string' };
    }

    // Normalize path
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+/g, '/');

    // Check for path traversal
    if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
      return { isValid: false, error: 'Path traversal is not allowed' };
    }

    // Check for dangerous paths
    if (this.DANGEROUS_PATHS.some(dangerous => normalizedPath.startsWith(dangerous))) {
      return { isValid: false, error: 'Access to system directories is not allowed' };
    }

    return { isValid: true, sanitized: normalizedPath };
  }

  /**
   * Validates and sanitizes filenames
   */
  static validateFilename(filename: string): { isValid: boolean; sanitized?: string; error?: string } {
    if (!filename || typeof filename !== 'string') {
      return { isValid: false, error: 'Filename must be a non-empty string' };
    }

    if (filename.length > this.MAX_FILENAME_LENGTH) {
      return { isValid: false, error: 'Filename exceeds maximum length' };
    }

    // Remove dangerous characters
    const sanitized = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');

    // Check for dangerous extensions
    const extension = sanitized.toLowerCase().substring(sanitized.lastIndexOf('.'));
    if (this.BLOCKED_EXTENSIONS.includes(extension)) {
      return { isValid: false, error: 'File extension is not allowed' };
    }

    // Prevent reserved filenames on Windows
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(sanitized.toUpperCase())) {
      return { isValid: false, error: 'Reserved filename is not allowed' };
    }

    return { isValid: true, sanitized };
  }

  /**
   * Validates numeric limits
   */
  static validateNumericLimit(value: any, min: number = 0, max: number = 10000): number {
    const num = parseInt(value);
    if (isNaN(num) || num < min) return min;
    if (num > max) return max;
    return num;
  }

  /**
   * Validates CSS selectors for XSS prevention
   */
  static validateCSSSelector(selector: string): { isValid: boolean; sanitized?: string; error?: string } {
    if (!selector || typeof selector !== 'string') {
      return { isValid: false, error: 'Selector must be a non-empty string' };
    }

    // Block dangerous patterns in selectors
    const dangerousPatterns = [
      /<script/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /expression\s*\(/gi
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(selector)) {
        return { isValid: false, error: 'Selector contains potentially dangerous patterns' };
      }
    }

    return { isValid: true, sanitized: selector };
  }
}

/**
 * Memory Management Utilities
 */
export class MemoryManager {
  private static readonly DEFAULT_MAX_ITEMS = 1000;
  private static readonly DEFAULT_MAX_SIZE_MB = 50;

  /**
   * Manages array size to prevent memory leaks
   */
  static limitArraySize<T>(array: T[], maxSize: number = this.DEFAULT_MAX_ITEMS): T[] {
    if (array.length > maxSize) {
      return array.slice(-maxSize);
    }
    return array;
  }

  /**
   * Estimates memory usage of objects
   */
  static estimateObjectSize(obj: any): number {
    return JSON.stringify(obj).length * 2; // Rough estimate in bytes
  }

  /**
   * Manages object collection size based on memory usage
   */
  static limitMemoryUsage<T>(array: T[], maxSizeMB: number = this.DEFAULT_MAX_SIZE_MB): T[] {
    const maxBytes = maxSizeMB * 1024 * 1024;
    let totalSize = 0;
    const result: T[] = [];

    // Process from newest to oldest
    for (let i = array.length - 1; i >= 0; i--) {
      const itemSize = this.estimateObjectSize(array[i]);
      if (totalSize + itemSize > maxBytes && result.length > 0) {
        break;
      }
      totalSize += itemSize;
      result.unshift(array[i]);
    }

    return result;
  }
}

/**
 * Rate Limiting Utilities
 */
export class RateLimiter {
  private static instances = new Map<string, { count: number; resetTime: number }>();

  /**
   * Simple rate limiting based on key
   */
  static checkRateLimit(key: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
    const now = Date.now();
    const instance = this.instances.get(key);

    if (!instance || now > instance.resetTime) {
      this.instances.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (instance.count >= maxRequests) {
      return false;
    }

    instance.count++;
    return true;
  }

  /**
   * Clean up expired rate limit entries
   */
  static cleanup(): void {
    const now = Date.now();
    for (const [key, instance] of this.instances.entries()) {
      if (now > instance.resetTime) {
        this.instances.delete(key);
      }
    }
  }
}

/**
 * Timeout Management Utilities
 */
export class TimeoutManager {
  private static timeouts = new Map<string, NodeJS.Timeout>();

  /**
   * Set a timeout with automatic cleanup
   */
  static setTimeout(key: string, callback: () => void, ms: number): void {
    this.clearTimeout(key);
    const timeout = setTimeout(() => {
      callback();
      this.timeouts.delete(key);
    }, ms);
    this.timeouts.set(key, timeout);
  }

  /**
   * Clear a specific timeout
   */
  static clearTimeout(key: string): void {
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
  }

  /**
   * Clear all timeouts
   */
  static clearAllTimeouts(): void {
    for (const [key, timeout] of this.timeouts.entries()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
  }
}