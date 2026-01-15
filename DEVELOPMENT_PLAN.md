# Development Plan: Claude Code Browser Plugin

## Executive Summary

This document outlines the implementation strategy for a Claude Code plugin that provides visual UI design feedback through a managed browser preview. The plugin enables developers to inspect, measure, and refine UI components visually while maintaining terminal-first development.

---

## Project Architecture

### Directory Structure

```
design-port/
├── packages/
│   ├── core/                    # Plugin entry point and orchestration
│   │   ├── src/
│   │   │   ├── index.ts         # Main plugin entry
│   │   │   ├── plugin.ts        # Plugin lifecycle management
│   │   │   └── config.ts        # Configuration handling
│   │   └── package.json
│   │
│   ├── server-manager/          # Dev server detection and management
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── detector.ts      # Framework/tooling detection
│   │   │   ├── adapters/        # Framework-specific adapters
│   │   │   │   ├── vite.ts
│   │   │   │   ├── nextjs.ts
│   │   │   │   ├── cra.ts
│   │   │   │   └── base.ts      # Abstract adapter interface
│   │   │   └── process.ts       # Process lifecycle management
│   │   └── package.json
│   │
│   ├── browser-bridge/          # Browser communication layer
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── websocket-server.ts
│   │   │   ├── protocol.ts      # Message type definitions
│   │   │   └── browser-launcher.ts
│   │   └── package.json
│   │
│   ├── inspector/               # Component inspection and source mapping
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── dom-inspector.ts
│   │   │   ├── source-mapper.ts
│   │   │   └── style-extractor.ts
│   │   └── package.json
│   │
│   ├── client-script/           # Browser-injected inspection script
│   │   ├── src/
│   │   │   ├── index.ts         # Entry point for bundled script
│   │   │   ├── element-picker.ts
│   │   │   ├── measurement.ts
│   │   │   ├── overlay.ts       # Visual selection overlay
│   │   │   └── websocket-client.ts
│   │   └── package.json
│   │
│   └── terminal-ui/             # Terminal output formatting
│       ├── src/
│       │   ├── index.ts
│       │   ├── formatter.ts     # Measurement data formatting
│       │   └── status.ts        # Status indicator management
│       └── package.json
│
├── examples/                    # Example projects for testing
│   ├── react-vite/
│   ├── nextjs-app/
│   └── vue-vite/
│
├── docs/
│   ├── architecture.md
│   ├── extending-frameworks.md
│   └── api-reference.md
│
├── package.json                 # Root workspace config
├── tsconfig.json
└── turbo.json                   # Turborepo for monorepo management
```

### Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Language | TypeScript | Type safety, better DX for contributors |
| Monorepo | Turborepo + pnpm workspaces | Fast builds, clean dependency management |
| WebSocket | ws | Lightweight, well-maintained |
| Browser Control | Puppeteer-core | Avoid bundling Chromium, use system browser |
| Build (client script) | esbuild | Fast bundling for injected script |
| Testing | Vitest | Fast, TypeScript-native |

---

## Implementation Phases

### Phase 1: Foundation

**Goal:** Establish project infrastructure and basic plugin scaffold with dev server detection.

#### Tasks

**1.1 Project Setup**
- Initialize pnpm workspace with Turborepo
- Configure TypeScript with strict mode and path aliases
- Set up ESLint and Prettier
- Create CI workflow for tests and linting

**1.2 Framework Detection (`server-manager`)**
- Implement project analyzer that detects:
  - Package manager (npm, yarn, pnpm)
  - Framework (React, Vue, Svelte, vanilla)
  - Build tool (Vite, Next.js, CRA, Webpack)
- Detection strategy:
  1. Parse `package.json` dependencies
  2. Check for config files (`vite.config.*`, `next.config.*`, etc.)
  3. Inspect `node_modules` structure as fallback

**1.3 Dev Server Adapter Interface**
- Define abstract `DevServerAdapter` interface:
  ```typescript
  interface DevServerAdapter {
    name: string;
    detect(projectPath: string): Promise<boolean>;
    getStartCommand(): string[];
    getDevServerUrl(): string;
    injectMiddleware?(script: string): void;
  }
  ```
- Implement Vite adapter (highest priority)
- Implement Next.js adapter

#### Deliverables
- Working monorepo with all package stubs
- Framework detection that correctly identifies React/Vite, Next.js, Vue/Vite projects
- Dev server can be spawned and managed programmatically

---

### Phase 2: Browser Communication

**Goal:** Establish bidirectional communication between terminal process and browser.

#### Tasks

**2.1 WebSocket Server (`browser-bridge`)**
- Implement WebSocket server on dynamic port
- Define message protocol:
  ```typescript
  type BrowserMessage =
    | { type: 'element-selected'; payload: ElementSelection }
    | { type: 'measurement'; payload: MeasurementData }
    | { type: 'error'; payload: ErrorInfo }
    | { type: 'ready' }
    | { type: 'pong' };

  type TerminalMessage =
    | { type: 'inspect-mode'; enabled: boolean }
    | { type: 'highlight-element'; selector: string }
    | { type: 'ping' };
  ```
- Implement connection lifecycle management with reconnection logic

**2.2 Browser Launcher**
- Use Puppeteer-core to launch browser with system Chrome/Chromium
- Configure browser window positioning (side-by-side with terminal if possible)
- Handle browser crash recovery

**2.3 Client Script Foundation (`client-script`)**
- Create minimal client that:
  - Establishes WebSocket connection
  - Sends ready signal
  - Handles ping/pong heartbeat
- Bundle with esbuild for injection

**2.4 Script Injection**
- Implement middleware injection for Vite
- Fallback: inject via Puppeteer's `page.addScriptTag()`

#### Deliverables
- Browser window spawns and connects to WebSocket server
- Bidirectional messages flow between terminal and browser
- Connection survives page reloads (reconnection logic)

---

### Phase 3: Element Inspection

**Goal:** Enable clicking elements in browser to capture measurements and component info.

#### Tasks

**3.1 Element Picker (`client-script`)**
- Implement click-to-select mode:
  - Visual hover overlay showing element boundaries
  - Click captures element without triggering native click handlers
  - ESC key exits inspection mode
- Extract on selection:
  - Bounding rect (x, y, width, height)
  - Computed styles (all CSS properties)
  - Element tag, classes, attributes
  - React/Vue component name (if available via devtools globals)

**3.2 Visual Overlay**
- Render measurement overlay showing:
  - Element boundaries (box model: content, padding, border, margin)
  - Dimension labels
  - Guide lines to parent/siblings (optional)
- Use CSS injection or canvas overlay

**3.3 Style Extraction**
- Capture computed styles via `getComputedStyle()`
- Identify design tokens:
  - Parse CSS custom property usage
  - Map colors to nearest design token if possible
- Group styles by category (typography, spacing, colors, etc.)

**3.4 Terminal Formatter (`terminal-ui`)**
- Format selection data for terminal display:
  ```
  ┌─ Selected Element ─────────────────────────────────
  │ Component: Button (src/components/Button.tsx:24)
  │ Tag: <button class="btn btn-primary">
  ├─ Dimensions ──────────────────────────────────────
  │ Size: 120px × 40px
  │ Padding: 8px 16px
  │ Margin: 0px
  ├─ Typography ──────────────────────────────────────
  │ Font: Inter, 14px, weight 500
  │ Color: #ffffff
  ├─ Background ──────────────────────────────────────
  │ Color: #2563eb (var(--primary-600))
  └───────────────────────────────────────────────────
  ```

#### Deliverables
- Click any element in browser to see measurements in terminal
- Visual overlay shows box model during hover
- Computed styles extracted and formatted

---

### Phase 4: Source Code Mapping

**Goal:** Map selected DOM elements back to source code file and line number.

#### Tasks

**4.1 React Component Detection**
- Access React DevTools fiber data via `__REACT_DEVTOOLS_GLOBAL_HOOK__`
- Walk fiber tree to find component owning selected element
- Extract component name and source location from `_debugSource`

**4.2 Vue Component Detection**
- Access Vue DevTools data via `__VUE_DEVTOOLS_GLOBAL_HOOK__`
- Identify component instance from DOM element
- Extract component file path from `__file` property

**4.3 Source Map Correlation**
- Parse source maps from dev server
- Map transpiled line numbers to original source
- Handle both inline and external source maps

**4.4 Fallback Strategies**
- If no devtools hook: use DOM structure + filename heuristics
- Parse component names from class names or data attributes
- Graceful degradation messaging

#### Deliverables
- Selected elements show source file and line number
- Works with React and Vue components
- Graceful fallback when source mapping unavailable

---

### Phase 5: Integration & Polish

**Goal:** Create cohesive plugin experience with status indicators and error handling.

#### Tasks

**5.1 Plugin Core (`core`)**
- Implement main plugin entry point
- Orchestrate startup sequence:
  1. Detect framework
  2. Start dev server
  3. Launch browser
  4. Establish WebSocket connection
  5. Inject client script
- Handle cleanup on exit (SIGINT, SIGTERM)

**5.2 Status Management**
- Terminal status line showing:
  - Dev server status (starting/running/error)
  - Browser connection status (connected/disconnected)
  - Current inspection mode (on/off)
- Non-intrusive updates that don't interrupt workflow

**5.3 Error Handling**
- Graceful handling of:
  - Dev server fails to start (missing deps, port conflict)
  - Browser fails to launch (no Chrome found)
  - WebSocket disconnection
  - Source mapping failures
- Clear, actionable error messages

**5.4 Configuration**
- Support `.designportrc` or `package.json` config:
  ```json
  {
    "designPort": {
      "browser": "chrome",
      "devServerPort": 3000,
      "inspectorPort": 9222
    }
  }
  ```

#### Deliverables
- Single command starts entire workflow
- Status visible in terminal at all times
- Graceful error recovery and messaging

---

### Phase 6: Extended Framework Support

**Goal:** Add support for additional frameworks and edge cases.

#### Tasks

**6.1 Additional Adapters**
- Create React App (CRA) adapter
- Svelte/SvelteKit adapter
- Plain HTML/CSS with live-server fallback

**6.2 Svelte Component Detection**
- Implement Svelte-specific component identification
- Handle Svelte's compiled output structure

**6.3 Framework Extension Documentation**
- Document adapter interface
- Provide template for community adapters
- Example: adding Astro support

#### Deliverables
- CRA and Svelte projects work out of the box
- Documentation for adding framework support
- At least one community adapter example

---

## Technical Deep Dives

### Dev Server Script Injection

Three strategies in order of preference:

**Strategy 1: Vite Plugin (cleanest)**
```typescript
// Injected as Vite plugin
export default function designPortPlugin(wsPort: number) {
  return {
    name: 'design-port',
    transformIndexHtml(html) {
      return html.replace(
        '</body>',
        `<script src="http://localhost:${wsPort}/__design-port.js"></script></body>`
      );
    }
  };
}
```

**Strategy 2: Dev Server Middleware**
```typescript
// Inject via middleware that serves the client script
app.use('/__design-port.js', (req, res) => {
  res.type('application/javascript');
  res.send(clientScriptBundle);
});
```

**Strategy 3: Puppeteer Injection (fallback)**
```typescript
// When we control the browser
await page.addScriptTag({
  content: clientScriptBundle
});
```

### Component Name Resolution

```typescript
// React fiber traversal
function getReactComponentName(element: Element): string | null {
  const key = Object.keys(element).find(k =>
    k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
  );
  if (!key) return null;

  let fiber = (element as any)[key];
  while (fiber) {
    if (fiber.type?.name || fiber.type?.displayName) {
      return fiber.type.displayName || fiber.type.name;
    }
    fiber = fiber.return;
  }
  return null;
}

// Vue component detection
function getVueComponentName(element: Element): string | null {
  const vueInstance = (element as any).__vue__;
  if (!vueInstance) return null;
  return vueInstance.$options.name || vueInstance.$options._componentTag;
}
```

### Design Token Detection

```typescript
function extractDesignTokens(element: Element): Map<string, string> {
  const tokens = new Map();
  const styles = getComputedStyle(element);

  // Check for CSS custom property usage in stylesheets
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSStyleRule && element.matches(rule.selectorText)) {
          const style = rule.style;
          for (let i = 0; i < style.length; i++) {
            const prop = style[i];
            const value = style.getPropertyValue(prop);
            if (value.includes('var(--')) {
              const match = value.match(/var\((--[\w-]+)\)/);
              if (match) {
                tokens.set(prop, match[1]);
              }
            }
          }
        }
      }
    } catch (e) {
      // CORS restriction on external stylesheets
    }
  }

  return tokens;
}
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| React devtools hook unavailable in production builds | Require dev mode; document limitation clearly |
| Source maps not always available | Graceful fallback to "unknown location" with clear messaging |
| Port conflicts on dev server | Allow configurable ports; auto-detect available ports |
| Browser not installed | Detect Chrome/Chromium paths; provide installation guidance |
| Hot reload breaks WebSocket | Auto-reconnect with exponential backoff |
| Framework detection false positives | Allow manual override via config |
| Large DOM trees slow inspection | Debounce hover events; optimize traversal |

---

## Testing Strategy

### Unit Tests
- Framework detection logic
- Style extraction and formatting
- Message protocol serialization
- Source map parsing

### Integration Tests
- Dev server lifecycle (start, stop, restart)
- WebSocket communication roundtrip
- Element selection end-to-end

### E2E Tests (using example projects)
- Full workflow with React/Vite project
- Full workflow with Next.js project
- Error recovery scenarios

### Manual Testing Checklist
- [ ] Plugin starts in fresh React/Vite project
- [ ] Browser opens and connects
- [ ] Clicking element shows measurements
- [ ] Source file link is accurate
- [ ] Hot reload preserves connection
- [ ] Clean shutdown on Ctrl+C
- [ ] Error message when Chrome not found
- [ ] Error message when port in use

---

## Dependencies

### Runtime Dependencies
```json
{
  "ws": "^8.x",
  "puppeteer-core": "^22.x",
  "source-map": "^0.7.x",
  "chalk": "^5.x"
}
```

### Development Dependencies
```json
{
  "typescript": "^5.x",
  "esbuild": "^0.20.x",
  "vitest": "^1.x",
  "turbo": "^1.x",
  "@types/ws": "^8.x"
}
```

---

## Open Questions

1. **Claude Code integration point:** How does the plugin surface data to Claude? Options:
   - Write to stdout for Claude to read
   - MCP (Model Context Protocol) tool registration
   - Shared file/IPC mechanism

2. **Browser window management:** Should we support:
   - Headless mode for CI/testing?
   - Multiple browser windows for multi-component comparison?

3. **Design system integration:** How to detect and validate against design systems like Tailwind, Chakra, etc.?

4. **State persistence:** Should inspection history be saved for reference?

---

## Success Metrics

- **Startup latency:** < 3 seconds from command to browser visible
- **Selection latency:** < 100ms from click to terminal display
- **Hot reload latency:** < 500ms additional overhead vs native dev server
- **Framework coverage:** React (Vite, Next.js, CRA), Vue (Vite), Svelte
- **Error rate:** < 1% false positives in component detection

---

## Next Steps

1. Set up monorepo structure and tooling
2. Implement framework detection for Vite projects
3. Build minimal WebSocket communication layer
4. Create basic element picker with measurement display
5. Iterate based on real-world testing
