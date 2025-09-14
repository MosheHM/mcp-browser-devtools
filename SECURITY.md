# Security Guidelines

## Overview
This document outlines the security measures implemented in the MCP Browser DevTools Server and provides guidelines for secure usage.

## Security Architecture

### 1. Network Security
- **Localhost-Only Connections**: The server only accepts connections to localhost addresses (127.0.0.1, ::1, localhost)
- **Port Restrictions**: DevTools port must be in the safe range (1024-65535)
- **Protocol Validation**: Only HTTP/HTTPS URLs are allowed for navigation
- **No External Access**: The server itself does not make external network requests

### 2. Input Validation
- **Zod Schema Validation**: All inputs are validated using strict Zod schemas
- **Length Limits**: String inputs have maximum length constraints
- **Type Safety**: TypeScript ensures type safety at compile time
- **Range Validation**: Numeric inputs are constrained to safe ranges

### 3. Code Execution Security
- **Pattern Blocking**: Dangerous JavaScript patterns are blocked:
  - `eval()` function calls
  - `Function()` constructor
  - `setTimeout()` and `setInterval()` with string arguments
- **Execution Limits**: JavaScript execution is limited by:
  - Maximum execution time (default: 5 seconds)
  - Maximum code length (10,000 characters)
  - Memory usage constraints
- **Sandboxing**: Code executes in the browser context, not the server

### 4. Resource Protection
- **Memory Limits**: Page source retrieval is limited to 1MB
- **Timeout Protection**: All operations have configurable timeouts
- **Connection Management**: Automatic cleanup of stale connections
- **Rate Limiting**: Built-in delays prevent resource exhaustion

## Configuration Security

### Environment Variables
Never expose these environment variables in production:
```bash
# ❌ DON'T expose to external networks
DEVTOOLS_HOST=0.0.0.0  # DANGEROUS!

# ✅ DO use localhost only
DEVTOOLS_HOST=localhost  # SAFE
```

### Secure Defaults
The server uses secure defaults:
- `secureMode: true` - Enhanced security validations
- `host: localhost` - Localhost-only connections
- `timeout: 10000` - Reasonable connection timeouts
- `maxExecutionTime: 5000` - Limited JavaScript execution time

## Usage Guidelines

### 1. Browser Setup
```bash
# ✅ Secure Chrome startup
chrome --remote-debugging-port=9222 \
       --no-first-run \
       --no-default-browser-check \
       --disable-background-timer-throttling \
       --disable-renderer-backgrounding

# ❌ Don't expose to network
chrome --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0  # DANGEROUS!
```

### 2. JavaScript Execution
```javascript
// ✅ Safe patterns
document.title
document.querySelectorAll('a').length
window.location.href

// ❌ Blocked patterns
eval('dangerous code')  // Blocked
new Function('return dangerous')()  // Blocked
setTimeout('dangerous', 1000)  // Blocked
```

### 3. URL Navigation
```javascript
// ✅ Allowed protocols
https://example.com
http://localhost:3000

// ❌ Blocked protocols
file:///etc/passwd  // Blocked
ftp://example.com   // Blocked
javascript:alert(1) // Blocked
```

## Security Monitoring

### 1. Connection Status
Monitor connection status to detect unusual activity:
```typescript
const status = await server.getConnectionStatus();
if (!status.connected) {
  // Handle disconnection
}
```

### 2. Security State
Check page security state:
```typescript
const securityState = await server.getSecurityState();
// Returns: secure, insecure, unknown, etc.
```

### 3. Error Handling
All security violations are logged and return descriptive errors:
```typescript
try {
  await server.executeJavaScript('eval("dangerous")');
} catch (error) {
  // Error: Potentially unsafe JavaScript detected
}
```

## Threat Model

### Mitigated Risks
1. **Code Injection**: Blocked dangerous JavaScript patterns
2. **Network Exposure**: Localhost-only connections
3. **Resource Exhaustion**: Size and time limits
4. **Unauthorized Access**: Input validation and type safety

### Remaining Considerations
1. **Browser Security**: Relies on Chrome's security model
2. **Local Access**: Full access to localhost browser instance
3. **JavaScript Capabilities**: Limited by browser sandbox

### Best Practices
1. **Regular Updates**: Keep dependencies updated
2. **Monitoring**: Monitor for unusual activity patterns
3. **Access Control**: Restrict access to the MCP server
4. **Logging**: Enable comprehensive logging for audit trails

## Incident Response

### Security Issues
If you discover a security issue:
1. **Don't** open a public issue
2. **Do** report privately to maintainers
3. **Include** reproduction steps and impact assessment
4. **Allow** time for responsible disclosure

### Common Issues
1. **Connection Refused**: Check Chrome debug port
2. **Execution Timeout**: Reduce code complexity
3. **Navigation Failed**: Verify URL protocol
4. **Size Limit Exceeded**: Reduce content size

## Compliance

### Standards
- Follows OWASP secure coding practices
- Implements defense in depth
- Uses principle of least privilege
- Maintains audit trails

### Regular Security Reviews
- Code review for security implications
- Dependency scanning for vulnerabilities
- Regular penetration testing
- Security-focused automated testing