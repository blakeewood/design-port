/**
 * Browser entry point for the DesignPort client script.
 * This file is bundled with esbuild and injected into the browser.
 */

import { ElementPicker } from './element-picker.js';
import { WebSocketClient } from './websocket-client.js';

// Configuration injected at runtime
declare const __DESIGN_PORT_WS_URL__: string;

const WS_URL = typeof __DESIGN_PORT_WS_URL__ !== 'undefined'
  ? __DESIGN_PORT_WS_URL__
  : 'ws://localhost:9222';

class DesignPortClient {
  private ws: WebSocketClient;
  private picker: ElementPicker;

  constructor() {
    this.ws = new WebSocketClient(WS_URL);
    this.picker = new ElementPicker();

    this.setupMessageHandlers();
  }

  async init(): Promise<void> {
    try {
      await this.ws.connect();
      console.log('[DesignPort] Connected to terminal');
    } catch (error) {
      console.error('[DesignPort] Failed to connect:', error);
    }
  }

  private setupMessageHandlers(): void {
    this.ws.on('inspect-mode', (msg) => {
      const data = msg as { enabled: boolean };
      if (data.enabled) {
        this.picker.enable((measurement) => {
          this.ws.send({
            type: 'element-selected',
            payload: measurement,
          });
        });
      } else {
        this.picker.disable();
      }
    });

    this.ws.on('highlight-element', (msg) => {
      const data = msg as { selector: string };
      this.picker.highlight(data.selector);
    });

    this.ws.on('clear-highlight', () => {
      this.picker.clearHighlight();
    });

    this.ws.on('ping', () => {
      this.ws.send({ type: 'pong' });
    });
  }
}

// Auto-initialize when script loads
const client = new DesignPortClient();
client.init().catch(console.error);

// Export for debugging
(window as unknown as { __designPort: DesignPortClient }).__designPort = client;
