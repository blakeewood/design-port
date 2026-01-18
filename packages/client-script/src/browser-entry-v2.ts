/**
 * Browser Entry Point v2 - Phase 6.5 Visual Inspector
 *
 * This is the main entry point for the DesignPort client script.
 * It integrates the visual overlay, inspector panel, and element picker
 * to provide a Figma-like inspection experience.
 */

import { inspectorState } from './inspector-state.js';
import { InspectorPanel } from './inspector-panel.js';
import { VisualOverlay } from './visual-overlay.js';
import { ElementPickerV2 } from './element-picker-v2.js';
import { WebSocketClient } from './websocket-client.js';
import { MultiSelectManager } from './multi-select.js';

// Configuration injected at runtime
declare const __DESIGN_PORT_WS_URL__: string;
declare const __DESIGN_PORT_CONFIG__: {
  wsPort?: number;
  autoStart?: boolean;
};

/**
 * Get WebSocket URL from config or default.
 */
function getWebSocketUrl(): string {
  if (typeof __DESIGN_PORT_WS_URL__ !== 'undefined') {
    return __DESIGN_PORT_WS_URL__;
  }

  if (typeof __DESIGN_PORT_CONFIG__ !== 'undefined' && __DESIGN_PORT_CONFIG__.wsPort) {
    return `ws://localhost:${__DESIGN_PORT_CONFIG__.wsPort}`;
  }

  return 'ws://localhost:9222';
}

/**
 * Main DesignPort Client - Phase 6.5
 */
class DesignPortClient {
  private ws: WebSocketClient;
  private panel: InspectorPanel;
  private overlay: VisualOverlay;
  private picker: ElementPickerV2;
  private multiSelectManager: MultiSelectManager;
  private initialized = false;

  constructor() {
    this.ws = new WebSocketClient(getWebSocketUrl());
    this.panel = new InspectorPanel();
    this.multiSelectManager = new MultiSelectManager();
    this.overlay = new VisualOverlay(this.multiSelectManager, this.ws);
    this.picker = new ElementPickerV2(this.multiSelectManager, this.ws);

    // Expose WebSocket for element picker to use
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).wsClient = this.ws;
  }

  /**
   * Initialize all components.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    console.log('[DesignPort] Initializing Phase 6.5 Visual Inspector...');

    // Initialize UI components
    this.overlay.init();
    this.panel.init();
    this.picker.init();

    // Set up message handlers
    this.setupMessageHandlers();

    // Connect to terminal
    try {
      await this.ws.connect();
      console.log('[DesignPort] Connected to terminal');

      // Notify terminal that we're ready
      this.ws.send({ type: 'ready' });
    } catch (error) {
      console.warn('[DesignPort] Terminal connection not available, running standalone');
    }

    // Auto-start pick mode if configured
    if (typeof __DESIGN_PORT_CONFIG__ !== 'undefined' && __DESIGN_PORT_CONFIG__.autoStart) {
      inspectorState.enterPickMode();
    }

    // Subscribe to state changes for terminal sync
    inspectorState.subscribe((state) => {
      // Mirror selection state to terminal
      if (state.overlayState === 'locked' && state.measurement) {
        this.ws.send({
          type: 'element-selected',
          payload: state.measurement,
        });
      }
    });

    this.initialized = true;
    console.log('[DesignPort] Visual Inspector ready! Press Ctrl+Shift+P to start inspecting.');
  }

  /**
   * Set up WebSocket message handlers.
   */
  private setupMessageHandlers(): void {
    // Terminal requests to enter/exit inspect mode
    this.ws.on('inspect-mode', (msg) => {
      const data = msg as { enabled: boolean };
      if (data.enabled) {
        inspectorState.enterPickMode();
      } else {
        inspectorState.exitPickMode();
      }
    });

    // Terminal requests to highlight specific element
    this.ws.on('highlight-element', (msg) => {
      const data = msg as { selector: string };
      this.picker.highlight(data.selector);
    });

    // Terminal requests to clear selection
    this.ws.on('clear-highlight', () => {
      inspectorState.deselectElement();
    });

    // Terminal ping
    this.ws.on('ping', () => {
      this.ws.send({ type: 'pong' });
    });

    // Terminal requests current state
    this.ws.on('get-state', () => {
      const state = inspectorState.getState();
      this.ws.send({
        type: 'state',
        payload: {
          overlayState: state.overlayState,
          hasSelection: !!state.selectedElement,
          measurement: state.measurement,
        },
      });
    });
  }

  /**
   * Toggle pick mode (can be called from console).
   */
  togglePickMode(): void {
    inspectorState.togglePickMode();
  }

  /**
   * Show the inspector.
   */
  show(): void {
    inspectorState.show();
  }

  /**
   * Hide the inspector.
   */
  hide(): void {
    inspectorState.hide();
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    this.picker.destroy();
    this.overlay.destroy();
    this.panel.destroy();
    this.ws.disconnect();
    this.initialized = false;
  }
}

// ============================================================
// Auto-initialization
// ============================================================

// Create and initialize the client
const client = new DesignPortClient();

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    client.init().catch(console.error);
  });
} else {
  client.init().catch(console.error);
}

// Expose for debugging and external access
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__designPort = client;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__designPortState = inspectorState;

// Export for module usage
export { client as designPortClient };
export { inspectorState };
