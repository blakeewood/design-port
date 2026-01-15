/**
 * High-level bridge combining WebSocket server and browser management.
 */

import { EventEmitter } from 'node:events';
import { WebSocketServer, type BrowserMessage } from './websocket-server.js';
import { BrowserLauncher, type BrowserLauncherOptions } from './browser-launcher.js';
import type { ElementSelection, MeasurementData } from './protocol.js';

export interface BrowserBridgeEvents {
  ready: [];
  'element-selected': [selection: ElementSelection];
  measurement: [data: MeasurementData];
  error: [error: Error];
  disconnected: [];
}

export interface BrowserBridgeOptions extends BrowserLauncherOptions {
  /** Port for WebSocket server (0 = auto) */
  wsPort?: number;
}

export class BrowserBridge extends EventEmitter<BrowserBridgeEvents> {
  private wsServer: WebSocketServer;
  private launcher: BrowserLauncher;
  private clientScript: string | null = null;

  constructor(options: BrowserBridgeOptions = {}) {
    super();
    this.wsServer = new WebSocketServer(options.wsPort ?? 0);
    this.launcher = new BrowserLauncher(options);

    this.setupEventHandlers();
  }

  /**
   * Set the client script to inject into pages.
   */
  setClientScript(script: string): void {
    this.clientScript = script;
  }

  /**
   * Start the bridge: WebSocket server + browser.
   */
  async start(devServerUrl: string): Promise<void> {
    // Start WebSocket server first
    const wsPort = await this.wsServer.start();

    // Inject WebSocket URL into client script
    const scriptWithConfig = this.clientScript
      ? this.clientScript.replace(
          '__DESIGN_PORT_WS_URL__',
          `ws://localhost:${wsPort}`
        )
      : '';

    // Launch browser
    await this.launcher.launch(devServerUrl);

    // Inject client script if available
    if (scriptWithConfig) {
      await this.launcher.injectScript(scriptWithConfig);
    }
  }

  /**
   * Stop the bridge: close browser and WebSocket server.
   */
  async stop(): Promise<void> {
    await this.launcher.close();
    await this.wsServer.stop();
  }

  /**
   * Enable or disable element inspection mode.
   */
  setInspectMode(enabled: boolean): void {
    this.wsServer.send({ type: 'inspect-mode', enabled });
  }

  /**
   * Highlight an element by selector.
   */
  highlightElement(selector: string): void {
    this.wsServer.send({ type: 'highlight-element', selector });
  }

  /**
   * Clear element highlighting.
   */
  clearHighlight(): void {
    this.wsServer.send({ type: 'clear-highlight' });
  }

  /**
   * Check if browser is connected.
   */
  isConnected(): boolean {
    return this.wsServer.isConnected() && this.launcher.isRunning();
  }

  /**
   * Get the WebSocket server port.
   */
  getWsPort(): number {
    return this.wsServer.getPort();
  }

  private setupEventHandlers(): void {
    this.wsServer.on('connection', () => {
      // Browser connected, enable inspect mode by default
      this.setInspectMode(true);
    });

    this.wsServer.on('disconnection', () => {
      this.emit('disconnected');
    });

    this.wsServer.on('message', (message: BrowserMessage) => {
      switch (message.type) {
        case 'ready':
          this.emit('ready');
          break;
        case 'element-selected':
          this.emit('element-selected', message.payload);
          break;
        case 'measurement':
          this.emit('measurement', message.payload);
          break;
        case 'error':
          this.emit('error', new Error(message.payload.message));
          break;
        case 'pong':
          // Heartbeat response, ignore
          break;
      }
    });

    this.wsServer.on('error', (error) => {
      this.emit('error', error);
    });
  }
}
