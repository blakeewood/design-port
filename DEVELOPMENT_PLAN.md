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
│   ├── terminal-ui/             # Terminal output formatting
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── formatter.ts     # Measurement data formatting
│   │   │   └── status.ts        # Status indicator management
│   │   └── package.json
│   │
│   └── design-tokens/           # Design system parsing and token resolution
│       ├── src/
│       │   ├── index.ts
│       │   ├── parsers/
│       │   │   ├── tailwind.ts  # Tailwind config parser
│       │   │   ├── chakra.ts    # Chakra theme parser
│       │   │   └── css-vars.ts  # CSS custom properties extractor
│       │   ├── resolver.ts      # Maps values to token names
│       │   └── cache.ts         # Token cache for fast lookups
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
- Format selection data for terminal display with design token context:
  ```
  ┌─ Selected Element ─────────────────────────────────
  │ Component: Button (src/components/Button.tsx:24)
  │ Tag: <button class="px-4 py-2 bg-blue-500 text-white">
  ├─ Dimensions ──────────────────────────────────────
  │ Size: 120px × 40px
  │ Padding: 8px 16px (Tailwind: py-2 px-4)
  │ Margin: 0px
  ├─ Typography ──────────────────────────────────────
  │ Font: Inter, 14px, weight 500
  │ Color: #ffffff (Tailwind: text-white)
  ├─ Background ──────────────────────────────────────
  │ Color: #3b82f6 (--primary-500 / Tailwind: bg-blue-500)
  ├─ Design Tokens Used ──────────────────────────────
  │ spacing.4 → 1rem (16px)
  │ spacing.2 → 0.5rem (8px)
  │ colors.blue.500 → #3b82f6
  └───────────────────────────────────────────────────
  ```

#### Deliverables
- Click any element in browser to see measurements in terminal
- Visual overlay shows box model during hover
- Computed styles extracted and formatted

---

### Phase 3.5: Design Token Integration

**Goal:** Parse project design systems and map computed values to semantic tokens.

This phase is critical for making the plugin genuinely useful. When a user selects an element with `class="px-4 py-2 bg-blue-500"`, Claude needs to understand what tokens are being used, not just the computed pixel values.

#### Tasks

**3.5.1 Design System Detection**
- During plugin startup, detect design system in use:
  - Tailwind: presence of `tailwind.config.js` / `tailwind.config.ts`
  - Chakra UI: `@chakra-ui/react` in dependencies + theme file
  - CSS Custom Properties: scan for `:root` or `[data-theme]` definitions
  - Styled Components / Emotion themes: detect theme provider patterns
- Support multiple systems simultaneously (e.g., Tailwind + CSS vars)

**3.5.2 Tailwind Config Parser (`design-tokens/parsers/tailwind.ts`)**
```typescript
interface TailwindTokens {
  colors: Record<string, string | Record<string, string>>;
  spacing: Record<string, string>;
  fontSize: Record<string, string | [string, { lineHeight: string }]>;
  fontWeight: Record<string, string>;
  borderRadius: Record<string, string>;
  // ... other theme keys
}

async function parseTailwindConfig(projectPath: string): Promise<TailwindTokens> {
  // 1. Find tailwind.config.{js,ts,mjs,cjs}
  // 2. Use esbuild to bundle + evaluate the config
  // 3. Merge with Tailwind's default theme
  // 4. Resolve theme() references
  // 5. Return flattened token map
}
```

**Implementation approach:**
- Use `jiti` or `esbuild` to evaluate TypeScript/ESM configs
- Handle `tailwind.config.ts` with TypeScript imports
- Merge user config with `tailwindcss/defaultTheme`
- Flatten nested color objects (e.g., `blue.500` → `#3b82f6`)

**3.5.3 Chakra Theme Parser (`design-tokens/parsers/chakra.ts`)**
```typescript
interface ChakraTokens {
  colors: Record<string, string | Record<string, string>>;
  space: Record<string, string>;
  fontSizes: Record<string, string>;
  // ... other theme keys
}

async function parseChakraTheme(projectPath: string): Promise<ChakraTokens> {
  // 1. Find theme.ts or theme/index.ts
  // 2. Look for extendTheme() calls
  // 3. Merge with @chakra-ui/theme defaults
  // 4. Return flattened token map
}
```

**3.5.4 CSS Custom Properties Extractor (`design-tokens/parsers/css-vars.ts`)**
```typescript
interface CSSVarTokens {
  variables: Map<string, string>;  // --color-primary → #2563eb
  sources: Map<string, string>;    // --color-primary → src/styles/variables.css:12
}

async function extractCSSVariables(projectPath: string): Promise<CSSVarTokens> {
  // 1. Glob for *.css files in src/, styles/, etc.
  // 2. Parse CSS and extract :root, [data-theme], html selectors
  // 3. Collect all --custom-property definitions
  // 4. Track source file and line for each variable
}
```

**3.5.5 Token Resolution Engine (`design-tokens/resolver.ts`)**

The resolver maps computed CSS values back to design tokens:

```typescript
interface TokenResolver {
  // Given a computed value, find matching tokens
  resolveColor(hex: string): TokenMatch[];
  resolveSpacing(px: number): TokenMatch[];
  resolveFontSize(px: number): TokenMatch[];

  // Given element classes, extract token usage
  parseClassList(classes: string[]): ClassTokenMapping;
}

interface TokenMatch {
  system: 'tailwind' | 'chakra' | 'css-var' | 'custom';
  token: string;           // e.g., 'blue-500', 'spacing.4', '--primary'
  path: string;            // e.g., 'colors.blue.500'
  value: string;           // e.g., '#3b82f6'
  confidence: number;      // 0-1, for fuzzy color matching
}

interface ClassTokenMapping {
  class: string;           // e.g., 'px-4'
  property: string;        // e.g., 'padding-left', 'padding-right'
  token: string;           // e.g., 'spacing.4'
  value: string;           // e.g., '1rem'
}
```

**Color matching strategy:**
- Exact hex match first
- If no exact match, find nearest color in LAB color space
- Report confidence score for fuzzy matches
- Handle color format variations (hex, rgb, hsl)

**3.5.6 Token Cache (`design-tokens/cache.ts`)**
- Parse design tokens once at plugin startup
- Watch config files for changes (invalidate cache on save)
- In-memory lookup tables for O(1) resolution
- Color values indexed by hex for fast reverse lookup

**3.5.7 Class Name Parsing**

For Tailwind specifically, parse class names to understand token usage:

```typescript
// Input: "px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium"
// Output:
[
  { class: 'px-4', property: 'padding-inline', token: 'spacing.4', value: '1rem' },
  { class: 'py-2', property: 'padding-block', token: 'spacing.2', value: '0.5rem' },
  { class: 'bg-blue-500', property: 'background-color', token: 'colors.blue.500', value: '#3b82f6' },
  { class: 'text-white', property: 'color', token: 'colors.white', value: '#ffffff' },
  { class: 'font-medium', property: 'font-weight', token: 'fontWeight.medium', value: '500' },
]
```

**Handling complex Tailwind patterns:**
- Arbitrary values: `bg-[#1a1a1a]` → no token, literal value
- Responsive prefixes: `md:px-6` → conditional token
- State variants: `hover:bg-blue-600` → state-dependent token
- Negative values: `-mt-4` → negative spacing token

#### Deliverables
- Tailwind config parsed and cached at startup
- Chakra theme parsed and cached at startup
- CSS custom properties extracted from project styles
- Token resolver maps computed values → semantic tokens
- Class name parser understands Tailwind utility classes
- Terminal output shows both computed values AND token names

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

### Phase 7: Non-Web Framework Adapters (Future)

**Goal:** Extend DesignPort to support mobile and native application frameworks.

While the MVP focuses on web-based frameworks with browser-based dev servers, the plugin architecture is designed to support additional platforms as future adapters. Three priority candidates for post-MVP development are **Flutter**, **React Native**, and **SwiftUI**. Each presents unique challenges around live preview and design token mapping, but follows the same extensible adapter pattern established in Phase 1.

#### Flutter Adapter

Enable visual design editing for Flutter applications by connecting to Flutter's widget tree inspection capabilities. Rather than a browser-based preview, the adapter communicates with a running Flutter emulator or physical device, capturing widget hierarchies and computed layouts.

**Key implementation details:**
- Connect to Flutter DevTools protocol for widget inspection
- Map `ThemeData` and `ColorScheme` objects to design tokens
- Resolve Material Design spacing values (e.g., `EdgeInsets`)
- Reverse-map compiled Dart code to source locations
- Handle non-DOM widget tree structure

#### React Native Adapter

Connect to the React Native debugger to inspect component trees and style information from Android/iOS simulators.

**Key implementation details:**
- Integrate with React Native debugger WebSocket protocol
- Resolve design tokens from `StyleSheet` definitions
- Extract theme provider values
- Capture platform-specific measurements (dp, pt)
- Map components to source via Hermes/JSC debugging

#### SwiftUI Adapter

Extend support to native iOS/macOS development by connecting to Xcode's preview system and runtime inspection APIs.

**Key implementation details:**
- Connect to Xcode preview system or running simulator
- Map SwiftUI view hierarchies to source locations
- Extract `@State` and `@Environment` values
- Resolve custom color schemes and spacing systems
- Handle declarative view modifiers

#### Architecture Note

All adapters leverage the core plugin infrastructure:
- MCP server for Claude Code communication
- Terminal formatter for measurement display
- Design token resolver (extended for platform themes)
- Component mapping engine

Each adapter implements platform-specific:
- Communication layer (DevTools protocol, debugger, Xcode)
- Design system parser (ThemeData, StyleSheet, SwiftUI themes)
- Source mapping strategy

#### Deliverables
- Flutter adapter with emulator/device connection
- React Native adapter with simulator inspection
- SwiftUI adapter with Xcode preview integration
- Documentation for contributing new platform adapters
- At least one community-contributed adapter example

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
| Tailwind config uses dynamic values | Evaluate config at runtime with jiti; warn if resolution fails |
| Custom Tailwind plugins add classes | Parse plugin output where possible; fallback to raw class display |
| Chakra theme not in standard location | Check common patterns; allow config override for theme path |
| CSS variables use calc() or references | Resolve computed values; show both expression and result |
| Color matching ambiguous (similar colors) | Report confidence score; show top 3 matches for low confidence |
| Design system not detected | Graceful degradation to raw values; prompt user to configure |

---

## Testing Strategy

### Unit Tests
- Framework detection logic
- Style extraction and formatting
- Message protocol serialization
- Source map parsing
- Tailwind config parsing (default theme, custom theme, TypeScript config)
- Chakra theme parsing (extendTheme, custom tokens)
- CSS variable extraction from stylesheets
- Token resolution (exact match, fuzzy color match)
- Tailwind class name parsing (utilities, variants, arbitrary values)

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
- [ ] Tailwind classes show token names (e.g., "Tailwind: bg-blue-500")
- [ ] Custom Tailwind theme colors resolved correctly
- [ ] CSS custom properties show variable names
- [ ] Chakra components show theme tokens
- [ ] Fuzzy color match shows confidence indicator
- [ ] Design token cache updates when config file changes

---

## Dependencies

### Runtime Dependencies
```json
{
  "ws": "^8.x",
  "puppeteer-core": "^22.x",
  "source-map": "^0.7.x",
  "chalk": "^5.x",
  "jiti": "^1.x",
  "culori": "^4.x",
  "@anthropic-ai/sdk": "^0.x"
}
```

**Design Token Dependencies:**
- `jiti`: Evaluate TypeScript/ESM config files (tailwind.config.ts, theme.ts)
- `culori`: Color space conversions for fuzzy color matching (LAB distance)
- `@anthropic-ai/sdk`: MCP server integration

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

## Design Decisions

### 1. Claude Code Integration: MCP Server Pattern

The plugin will expose its capabilities via **MCP (Model Context Protocol)** server registration. This enables:

- Claude Code to discover and invoke inspection tools programmatically
- Structured data exchange (not just stdout parsing)
- Bidirectional communication for Claude-initiated inspections
- Clean integration with Claude Code's existing MCP infrastructure

**MCP Tools Exposed:**
```typescript
// Tool definitions the plugin registers
{
  "design-port/inspect-element": {
    description: "Get measurements and design tokens for selected element",
    returns: ElementInspectionResult
  },
  "design-port/get-design-tokens": {
    description: "List all design tokens in the project",
    returns: DesignTokenMap
  },
  "design-port/highlight-element": {
    description: "Highlight an element by selector in the browser",
    params: { selector: string }
  }
}
```

### 2. Browser Window Management: GUI-First MVP

- **Headless mode:** Deferred to post-MVP. The core value is visual inspection, which requires a visible browser.
- **Multiple windows:** Not in scope for MVP. Single browser window sufficient for initial use cases.
- **Future consideration:** Terminal-based browser rendering (e.g., via Carbonyl) is interesting but not a priority.

### 3. Design System Integration: Core Feature

Design token awareness is critical for the plugin to be genuinely useful. See **Phase 3.5: Design Token Integration** for full implementation details.

### 4. State Persistence: Deferred

Inspection history persistence is not required for MVP. The terminal scroll buffer provides sufficient history for immediate use.

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
