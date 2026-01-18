/**
 * Main plugin class that orchestrates the DesignPort workflow.
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import type { DesignPortConfig } from './config.js';
import { createConfig } from './config.js';
import {
  detectFramework,
  DevServerManager,
  ViteAdapter,
  CRAAdapter,
  SvelteAdapter,
  NextJSAdapter,
  StaticAdapter,
  type FrameworkInfo,
  type DevServerAdapter,
} from '@design-port/server-manager';
import {
  BrowserBridge,
  ScriptServer,
  type ElementSelection,
  type StagedElement,
} from '@design-port/browser-bridge';
import { TokenCache } from '@design-port/design-tokens';
import {
  Formatter,
  StatusLine,
  SelectedElementsManager,
  type SelectedElement,
} from '@design-port/terminal-ui';
import { ContextWriter } from './context-writer.js';

export interface PluginState {
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'error';
  devServerUrl?: string;
  browserConnected: boolean;
  inspectMode: boolean;
  framework?: FrameworkInfo;
  error?: Error;
}

export interface PluginEvents {
  'state-change': [state: PluginState];
  'element-selected': [selection: ElementSelection, formatted: string];
  'element-staged': [element: StagedElement];
  'element-unstaged': [id: string];
  'selections-cleared': [];
  error: [error: Error];
}

export class DesignPortPlugin {
  private config: Required<DesignPortConfig>;
  private state: PluginState = {
    status: 'idle',
    browserConnected: false,
    inspectMode: false,
  };

  // Components
  private devServerManager: DevServerManager | null = null;
  private browserBridge: BrowserBridge | null = null;
  private scriptServer: ScriptServer | null = null;
  private tokenCache: TokenCache | null = null;
  private formatter: Formatter;
  private statusLine: StatusLine;
  private selectedElements: SelectedElementsManager;
  private contextWriter: ContextWriter | null = null;

  // Event handlers
  private eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>();

  constructor(userConfig: DesignPortConfig = {}) {
    this.config = createConfig(userConfig);
    this.formatter = new Formatter({ colors: true });
    this.statusLine = new StatusLine();
    this.selectedElements = new SelectedElementsManager();
    this.contextWriter = new ContextWriter(this.config.projectPath);
  }

  /**
   * Register an event handler.
   */
  on<K extends keyof PluginEvents>(
    event: K,
    handler: (...args: PluginEvents[K]) => void
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as (...args: unknown[]) => void);
  }

  /**
   * Remove an event handler.
   */
  off<K extends keyof PluginEvents>(
    event: K,
    handler: (...args: PluginEvents[K]) => void
  ): void {
    this.eventHandlers.get(event)?.delete(handler as (...args: unknown[]) => void);
  }

  /**
   * Start the DesignPort plugin.
   */
  async start(): Promise<void> {
    this.updateState({ status: 'starting' });

    try {
      // 1. Detect framework
      this.log('Detecting framework...');
      const framework = await detectFramework(this.config.projectPath);
      this.updateState({ framework });
      this.log(`Detected: ${framework.framework} with ${framework.buildTool}`);

      // 2. Initialize design token cache
      this.log('Parsing design tokens...');
      this.tokenCache = new TokenCache(this.config.projectPath);
      await this.tokenCache.initialize();
      const systems = this.tokenCache.getSummary();
      if (systems.length > 0) {
        this.log(`Found design systems: ${systems.join(', ')}`);
      }

      // 3. Start WebSocket server and script server
      this.log('Starting communication servers...');
      this.browserBridge = new BrowserBridge({
        wsPort: this.config.inspectorPort || 0,
      });

      // Load the client script bundle
      const wsPort = await this.startWebSocketServer();
      const clientScript = await this.loadClientScript(wsPort);
      this.browserBridge.setClientScript(clientScript);

      // Create script server (serves the client-side inspector)
      this.scriptServer = new ScriptServer({
        wsUrl: `ws://localhost:${wsPort}`,
      });
      const scriptPort = await this.scriptServer.start();
      this.log(`Script server running on port ${scriptPort}`);

      // 4. Start dev server
      this.log('Starting dev server...');
      this.statusLine.update({ devServer: 'starting' });

      const devServerUrl = await this.startDevServer(framework);
      this.updateState({ devServerUrl });
      this.statusLine.update({ devServer: 'running', devServerUrl });
      this.log(`Dev server running at ${devServerUrl}`);

      // 5. Launch browser
      this.log('Launching browser...');
      this.statusLine.update({ browser: 'launching' });

      await this.browserBridge.start(devServerUrl);
      this.updateState({ browserConnected: true, inspectMode: true });
      this.statusLine.update({ browser: 'connected', inspectMode: true });

      // 6. Set up event handlers
      this.setupBrowserBridgeHandlers();

      this.updateState({ status: 'running' });
      this.log('DesignPort is ready!');
      this.log('');
      this.log(this.statusLine.render());

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.updateState({ status: 'error', error: err });
      this.statusLine.update({ devServer: 'error', error: err.message });
      throw error;
    }
  }

  /**
   * Stop the DesignPort plugin and clean up resources.
   */
  async stop(): Promise<void> {
    this.updateState({ status: 'stopping' });

    const errors: Error[] = [];

    // Stop browser bridge
    if (this.browserBridge) {
      try {
        await this.browserBridge.stop();
      } catch (e) {
        errors.push(e instanceof Error ? e : new Error(String(e)));
      }
      this.browserBridge = null;
    }

    // Stop script server
    if (this.scriptServer) {
      try {
        await this.scriptServer.stop();
      } catch (e) {
        errors.push(e instanceof Error ? e : new Error(String(e)));
      }
      this.scriptServer = null;
    }

    // Stop dev server
    if (this.devServerManager) {
      try {
        await this.devServerManager.stop();
      } catch (e) {
        errors.push(e instanceof Error ? e : new Error(String(e)));
      }
      this.devServerManager = null;
    }

    // Stop token cache watching
    if (this.tokenCache) {
      this.tokenCache.stopWatching();
      this.tokenCache = null;
    }

    // Clear context file
    if (this.contextWriter) {
      this.contextWriter.clearContext();
      this.contextWriter = null;
    }

    this.updateState({
      status: 'idle',
      browserConnected: false,
      inspectMode: false,
    });

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Failed to stop cleanly');
    }
  }

  /**
   * Toggle inspect mode on/off.
   */
  setInspectMode(enabled: boolean): void {
    this.browserBridge?.setInspectMode(enabled);
    this.updateState({ inspectMode: enabled });
    this.statusLine.update({ inspectMode: enabled });
  }

  /**
   * Highlight an element by selector.
   */
  highlightElement(selector: string): void {
    this.browserBridge?.highlightElement(selector);
  }

  /**
   * Clear element highlighting.
   */
  clearHighlight(): void {
    this.browserBridge?.clearHighlight();
  }

  /**
   * Get current plugin state.
   */
  getState(): Readonly<PluginState> {
    return { ...this.state };
  }

  /**
   * Get plugin configuration.
   */
  getConfig(): Readonly<Required<DesignPortConfig>> {
    return { ...this.config };
  }

  /**
   * Get the token cache for external access.
   */
  getTokenCache(): TokenCache | null {
    return this.tokenCache;
  }

  /**
   * Get formatted status line.
   */
  getStatusLine(): string {
    return this.statusLine.render();
  }

  private async startWebSocketServer(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.browserBridge) {
        reject(new Error('Browser bridge not initialized'));
        return;
      }

      // The browser bridge starts its own WebSocket server
      // We need to get the port it's using
      // For now, we'll start a separate one via the bridge
      resolve(this.browserBridge.getWsPort() || 9222);
    });
  }

  /**
   * Load the client script bundle for injection into the browser.
   */
  private async loadClientScript(_wsPort: number): Promise<string> {
    try {
      // Try to load from the client-script package
      // Navigate from core/dist to client-script/dist
      const bundlePath = join(__dirname, '../../browser-bridge/node_modules/@design-port/client-script/dist/bundle.js');
      const altBundlePath = join(__dirname, '../../../client-script/dist/bundle.js');

      let script: string;
      try {
        script = await readFile(bundlePath, 'utf-8');
      } catch {
        script = await readFile(altBundlePath, 'utf-8');
      }

      // Return script with placeholder intact - bridge.start() will replace it
      return script;
    } catch {
      // Return fallback inline script if bundle not available
      this.log('Client script bundle not found, using fallback');
      return this.getFallbackClientScript();
    }
  }

  /**
   * Fallback inline script for when bundle is not available.
   */
  private getFallbackClientScript(): string {
    return `
(function() {
  const WS_URL = "__DESIGN_PORT_WS_URL__";
  let socket = null;
  let inspectMode = false;
  let overlay = null;

  function connect() {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('[DesignPort] Connected');
      socket.send(JSON.stringify({ type: 'ready' }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.error('[DesignPort] Parse error:', e);
      }
    };

    socket.onclose = () => {
      console.log('[DesignPort] Disconnected, reconnecting...');
      setTimeout(connect, 1000);
    };

    socket.onerror = (e) => {
      console.error('[DesignPort] WebSocket error:', e);
    };
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'ping':
        socket.send(JSON.stringify({ type: 'pong' }));
        break;
      case 'inspect-mode':
        setInspectMode(msg.enabled);
        break;
      case 'highlight-element':
        highlightElement(msg.selector);
        break;
      case 'clear-highlight':
        clearHighlight();
        break;
    }
  }

  function setInspectMode(enabled) {
    inspectMode = enabled;
    document.body.style.cursor = enabled ? 'crosshair' : '';

    if (enabled) {
      document.addEventListener('mousemove', onMouseMove, true);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKeyDown, true);
    } else {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      clearHighlight();
    }
  }

  function onMouseMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && !el.closest('#__design-port-overlay')) {
      showOverlay(el);
    }
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && !el.closest('#__design-port-overlay')) {
      const data = measureElement(el);
      socket.send(JSON.stringify({ type: 'element-selected', payload: data }));
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      setInspectMode(false);
    }
  }

  function measureElement(el) {
    const rect = el.getBoundingClientRect();
    const styles = getComputedStyle(el);
    const px = (v) => parseFloat(v) || 0;

    return {
      selector: getSelector(el),
      tagName: el.tagName.toLowerCase(),
      classList: Array.from(el.classList),
      id: el.id || undefined,
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      boxModel: {
        content: { width: px(styles.width), height: px(styles.height) },
        padding: { top: px(styles.paddingTop), right: px(styles.paddingRight), bottom: px(styles.paddingBottom), left: px(styles.paddingLeft) },
        border: { top: px(styles.borderTopWidth), right: px(styles.borderRightWidth), bottom: px(styles.borderBottomWidth), left: px(styles.borderLeftWidth) },
        margin: { top: px(styles.marginTop), right: px(styles.marginRight), bottom: px(styles.marginBottom), left: px(styles.marginLeft) }
      },
      computedStyles: extractStyles(styles),
      componentName: getComponentName(el)
    };
  }

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    const parts = [];
    while (el && el !== document.body) {
      let sel = el.tagName.toLowerCase();
      if (el.id) { parts.unshift('#' + el.id); break; }
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
        if (siblings.length > 1) sel += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
      }
      parts.unshift(sel);
      el = parent;
    }
    return parts.join(' > ');
  }

  function extractStyles(styles) {
    const props = ['font-family','font-size','font-weight','line-height','color','background-color','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left','border-radius','display','gap'];
    const result = {};
    props.forEach(p => { if (styles.getPropertyValue(p)) result[p] = styles.getPropertyValue(p); });
    return result;
  }

  function getComponentName(el) {
    // React
    const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
    if (fiberKey) {
      let fiber = el[fiberKey];
      while (fiber) {
        const name = fiber.type?.displayName || fiber.type?.name;
        if (name) return name;
        fiber = fiber.return;
      }
    }
    // Vue
    if (el.__vue__) return el.__vue__.$options?.name;
    return undefined;
  }

  function showOverlay(el) {
    clearHighlight();
    const rect = el.getBoundingClientRect();
    overlay = document.createElement('div');
    overlay.id = '__design-port-overlay';
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);';
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    const label = document.createElement('div');
    label.style.cssText = 'position:absolute;top:-22px;left:0;background:#3b82f6;color:#fff;padding:2px 6px;font:11px monospace;border-radius:3px;white-space:nowrap;';
    label.textContent = Math.round(rect.width) + ' × ' + Math.round(rect.height);
    overlay.appendChild(label);

    document.body.appendChild(overlay);
  }

  function highlightElement(selector) {
    try {
      const el = document.querySelector(selector);
      if (el) showOverlay(el);
    } catch {}
  }

  function clearHighlight() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  // Auto-connect on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
`;
  }

  private async startDevServer(framework: FrameworkInfo): Promise<string> {
    // Select appropriate adapter based on detected framework/build tool
    const adapter = this.selectAdapter(framework);
    this.log(`Using ${adapter.name} adapter`);

    const port = this.config.devServerPort || adapter.getDefaultPort?.() || 3000;
    this.devServerManager = new DevServerManager(adapter, this.config.projectPath, port);

    // Forward dev server output if verbose
    if (this.config.verbose) {
      this.devServerManager.on('output', (data) => {
        process.stdout.write(data);
      });
    }

    return await this.devServerManager.start();
  }

  /**
   * Select the appropriate adapter based on framework detection.
   */
  private selectAdapter(framework: FrameworkInfo): DevServerAdapter {
    // Check build tool first (more specific)
    switch (framework.buildTool) {
      case 'nextjs':
        return new NextJSAdapter();
      case 'cra':
        return new CRAAdapter();
      case 'vite':
        // Vite could be used with multiple frameworks
        if (framework.framework === 'svelte') {
          return new SvelteAdapter();
        }
        return new ViteAdapter();
      case 'webpack':
        // Webpack-based projects without CRA
        return new ViteAdapter(); // Fallback to Vite CLI
      case 'unknown':
        // Check if it's a static HTML project
        return new StaticAdapter();
      default:
        return new ViteAdapter();
    }
  }

  private setupBrowserBridgeHandlers(): void {
    if (!this.browserBridge) return;

    this.browserBridge.on('element-selected', (selection) => {
      // Resolve design tokens for this element
      const tokens = this.resolveTokensForSelection(selection);

      // Format for terminal output
      const formatted = this.formatter.formatSelection(selection, tokens);

      // Emit event and print to console
      this.emit('element-selected', selection, formatted);
      console.log('\n' + formatted);
    });

    this.browserBridge.on('disconnected', () => {
      this.updateState({ browserConnected: false });
      this.statusLine.update({ browser: 'disconnected' });
      this.log('Browser disconnected');
    });

    this.browserBridge.on('ready', () => {
      this.updateState({ browserConnected: true });
      this.statusLine.update({ browser: 'connected' });
    });

    this.browserBridge.on('error', (error) => {
      this.emit('error', error);
      if (this.config.verbose) {
        console.error('[DesignPort]', error);
      }
    });

    // Staging event handlers (Phase 7.1)
    this.browserBridge.on('element-staged', (element) => {
      // Convert browser StagedElement to terminal SelectedElement
      const selection: SelectedElement = {
        id: element.id,
        selector: element.selector,
        summary: element.summary,
        tagName: element.tagName,
        timestamp: Date.now(),
      };

      // Conditionally assign optional properties (exactOptionalPropertyTypes)
      if (element.componentName) {
        selection.componentName = element.componentName;
      }
      if (element.dimensions) {
        selection.dimensions = element.dimensions;
      }
      if (element.boxModel) {
        selection.boxModel = element.boxModel;
      }
      if (element.classes) {
        selection.classes = element.classes;
      }
      if (element.font) {
        selection.font = element.font;
      }
      if (element.role) {
        selection.role = element.role;
      }
      if (element.sourceLocation) {
        selection.sourceLocation = element.sourceLocation;
      }

      this.selectedElements.add(selection);
      this.selectedElements.writeToTerminal();

      // Write formatted context to temp file for MCP server
      if (this.contextWriter) {
        const context = this.selectedElements.formatContext();
        this.contextWriter.writeContext(context);
      }

      this.emit('element-staged', element);
    });

    this.browserBridge.on('element-unstaged', (id) => {
      this.selectedElements.remove(id);
      this.selectedElements.writeToTerminal();

      // Update context in temp file for MCP server
      if (this.contextWriter) {
        if (this.selectedElements.count === 0) {
          this.contextWriter.clearContext();
        } else {
          const context = this.selectedElements.formatContext();
          this.contextWriter.writeContext(context);
        }
      }

      this.emit('element-unstaged', id);
    });

    this.browserBridge.on('selections-cleared', () => {
      this.selectedElements.clear();
      this.selectedElements.writeToTerminal();

      // Clear context file for MCP server
      if (this.contextWriter) {
        this.contextWriter.clearContext();
      }

      this.emit('selections-cleared');
    });
  }

  private resolveTokensForSelection(selection: ElementSelection): Array<{
    property: string;
    token: string;
    value: string;
    system: 'tailwind' | 'chakra' | 'css-var' | 'custom';
  }> {
    if (!this.tokenCache) return [];

    const resolver = this.tokenCache.getResolver();
    const tokens: Array<{
      property: string;
      token: string;
      value: string;
      system: 'tailwind' | 'chakra' | 'css-var' | 'custom';
    }> = [];

    // Resolve colors
    const bgColor = selection.computedStyles['background-color'];
    if (bgColor) {
      const matches = resolver.resolveColor(bgColor);
      for (const match of matches.slice(0, 1)) {
        tokens.push({
          property: 'background-color',
          token: match.token,
          value: match.value,
          system: match.system,
        });
      }
    }

    const color = selection.computedStyles['color'];
    if (color) {
      const matches = resolver.resolveColor(color);
      for (const match of matches.slice(0, 1)) {
        tokens.push({
          property: 'color',
          token: match.token,
          value: match.value,
          system: match.system,
        });
      }
    }

    // Resolve spacing
    const paddingProps = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'];
    for (const prop of paddingProps) {
      const value = selection.computedStyles[prop];
      if (value) {
        const matches = resolver.resolveSpacing(value);
        for (const match of matches.slice(0, 1)) {
          tokens.push({
            property: prop,
            token: match.token,
            value: match.value,
            system: match.system,
          });
        }
      }
    }

    return tokens;
  }

  private updateState(partial: Partial<PluginState>): void {
    this.state = { ...this.state, ...partial };
    this.emit('state-change', this.state);
  }

  private emit<K extends keyof PluginEvents>(
    event: K,
    ...args: PluginEvents[K]
  ): void {
    this.eventHandlers.get(event)?.forEach((handler) => {
      handler(...args);
    });
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[DesignPort] ${message}`);
    }
  }
}
