/**
 * Browser entry point for the DesignPort client script.
 * This file is bundled with esbuild and injected into the browser.
 */

import { ElementPicker } from './element-picker.js';
import { WebSocketClient } from './websocket-client.js';
import { multiSelect, type StagedElement } from './multi-select.js';

// Configuration injected at runtime
declare const __DESIGN_PORT_WS_URL__: string;

const WS_URL = typeof __DESIGN_PORT_WS_URL__ !== 'undefined'
  ? __DESIGN_PORT_WS_URL__
  : 'ws://localhost:9222';

class DesignPortClient {
  private ws: WebSocketClient;
  private picker: ElementPicker;
  private multiSelectMode: boolean = false;

  constructor() {
    this.ws = new WebSocketClient(WS_URL);
    this.picker = new ElementPicker();

    this.setupMessageHandlers();
    this.setupMultiSelectSync();
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
          if (this.multiSelectMode) {
            // Multi-select mode: toggle staging
            const element = document.querySelector(measurement.selector);
            if (element) {
              const added = multiSelect.toggle(element, measurement);
              const staged = multiSelect.getAll().find(s => s.element === element);
              if (added && staged) {
                this.ws.send({
                  type: 'element-staged',
                  payload: multiSelect.toWireFormat(staged),
                });
              } else if (!added && staged) {
                this.ws.send({
                  type: 'element-unstaged',
                  payload: { id: staged.id },
                });
              }
            }
          } else {
            // Single-select mode: send immediately
            this.ws.send({
              type: 'element-selected',
              payload: measurement,
            });
          }
        });
      } else {
        this.picker.disable();
      }
    });

    this.ws.on('set-multi-select', (msg) => {
      const data = msg as { enabled: boolean };
      this.multiSelectMode = data.enabled;
      console.log('[DesignPort] Multi-select mode:', data.enabled);
    });

    this.ws.on('clear-staged', () => {
      multiSelect.clear();
      this.ws.send({ type: 'selections-cleared' });
    });

    this.ws.on('highlight-staged', (msg) => {
      const data = msg as { ids: string[] };
      // Highlight specific staged elements
      data.ids.forEach(id => {
        const staged = multiSelect.get(id);
        if (staged) {
          this.picker.highlight(staged.selector);
        }
      });
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

  private setupMultiSelectSync(): void {
    // Subscribe to multi-select changes to keep terminal in sync
    multiSelect.subscribe((staged: StagedElement[]) => {
      // Optionally send full state sync here if needed
      console.log('[DesignPort] Staged elements:', staged.length);
    });

    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+K to clear staged selections
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        multiSelect.clear();
        this.ws.send({ type: 'selections-cleared' });
      }

      // Escape to clear (when in multi-select mode)
      if (e.key === 'Escape' && this.multiSelectMode && multiSelect.count > 0) {
        multiSelect.clear();
        this.ws.send({ type: 'selections-cleared' });
      }
    });
  }

  // Expose for external access
  get multiSelect() {
    return multiSelect;
  }

  setMultiSelectMode(enabled: boolean): void {
    this.multiSelectMode = enabled;
  }
}

// Auto-initialize when script loads
const client = new DesignPortClient();
client.init().catch(console.error);

// Export for debugging
(window as unknown as { __designPort: DesignPortClient }).__designPort = client;
