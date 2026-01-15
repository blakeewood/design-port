/**
 * Main plugin class that orchestrates the DesignPort workflow.
 */

import type { DesignPortConfig } from './config.js';
import { createConfig } from './config.js';
import {
  detectFramework,
  DevServerManager,
  ViteAdapter,
  type FrameworkInfo,
} from '@design-port/server-manager';
import {
  BrowserBridge,
  ScriptServer,
  type ElementSelection,
} from '@design-port/browser-bridge';
import { TokenCache } from '@design-port/design-tokens';
import { Formatter, StatusLine } from '@design-port/terminal-ui';

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

  // Event handlers
  private eventHandlers = new Map<string, Set<(...args: unknown[]) => void>>();

  constructor(userConfig: DesignPortConfig = {}) {
    this.config = createConfig(userConfig);
    this.formatter = new Formatter({ colors: true });
    this.statusLine = new StatusLine();
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

      // Create script server (serves the client-side inspector)
      const wsPort = await this.startWebSocketServer();
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

  private async startDevServer(framework: FrameworkInfo): Promise<string> {
    // Select appropriate adapter based on detected framework
    let adapter;

    switch (framework.buildTool) {
      case 'vite':
        adapter = new ViteAdapter();
        break;
      case 'nextjs':
        // TODO: Add Next.js adapter
        adapter = new ViteAdapter(); // Fallback for now
        break;
      default:
        adapter = new ViteAdapter();
    }

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
