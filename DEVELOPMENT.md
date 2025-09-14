# Development Guide

## Quick Start for Developers

### Prerequisites
- Node.js 18+ 
- TypeScript knowledge
- Chrome/Chromium browser

### Development Setup
```bash
# Clone and install
git clone <repo-url>
cd mcp-browser-devtools
npm install

# Development workflow
npm run watch      # Auto-rebuild on changes
npm run dev        # Build and run
npm run type-check # Check types only
```

### Project Structure
```
src/
├── index.ts                    # Main entry point & configuration
├── server.ts                   # MCP server implementation
├── browser-client.ts           # Secure DevTools client
├── types.ts                    # Type definitions & validation schemas
└── types/chrome-remote-interface.d.ts  # CDP type definitions

dist/                           # Built JavaScript output
docs/                           # Documentation
├── README.md                   # Main documentation
├── SECURITY.md                 # Security guidelines
└── CLAUDE_SETUP.md            # Claude integration guide
```

### Key Technologies
- **MCP SDK 1.18.0** - Latest Model Context Protocol implementation
- **TypeScript 5.5+** - Type safety and modern JavaScript features
- **Zod** - Runtime type validation and schema definition
- **Chrome DevTools Protocol** - Browser automation interface
- **ESLint + Prettier** - Code quality and formatting

### Development Commands
```bash
npm run build      # Production build
npm run dev        # Development mode
npm run watch      # Watch mode
npm run clean      # Clean build artifacts
npm run lint       # Check code quality
npm run lint:fix   # Auto-fix lint issues
npm run format     # Format code
npm run type-check # TypeScript type checking
```

### Testing the Server
```bash
# 1. Start Chrome with debugging
chrome --remote-debugging-port=9222 --no-first-run

# 2. Build and start server
npm run build
npm start

# 3. Test with MCP client or inspector
```

### Code Style Guidelines
- Use TypeScript strict mode
- Follow ESLint rules (no exceptions)
- Format with Prettier
- Add JSDoc comments for public APIs
- Use Zod schemas for all external inputs
- Handle all Promise rejections

### Security Checklist
- [ ] All inputs validated with Zod schemas
- [ ] No dangerous JavaScript patterns (eval, Function)
- [ ] Localhost-only connections enforced
- [ ] Proper error handling and cleanup
- [ ] Resource limits enforced
- [ ] Security documentation updated

### Adding New Tools
1. Define input schema in `types.ts`
2. Add tool registration in `server.ts`
3. Implement handler with security checks
4. Add comprehensive error handling
5. Update documentation
6. Test thoroughly

### Performance Considerations
- Connection pooling for browser clients
- Timeout handling for all operations
- Memory limits for large responses
- Graceful degradation on errors
- Resource cleanup on shutdown

### Debugging Tips
- Use `DEVTOOLS_SECURE_MODE=false` to disable some validations
- Check Chrome DevTools at `http://localhost:9222`
- Enable verbose logging with environment variables
- Use TypeScript source maps for debugging
- Test with different Chrome versions

### Contributing
1. Fork the repository
2. Create a feature branch
3. Follow code style guidelines
4. Add tests if applicable
5. Update documentation
6. Submit pull request

### Release Process
1. Update version in package.json
2. Update CHANGELOG.md
3. Run full test suite
4. Build and verify dist/
5. Tag release
6. Publish to npm (if applicable)