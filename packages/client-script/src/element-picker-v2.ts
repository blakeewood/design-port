/**
 * Element Picker v2 - Updated for Phase 6.5 visual inspector.
 * Works with the inspector state manager for coordinated UI updates.
 */

import { inspectorState, type InspectorState } from './inspector-state.js';
import { measureElement, type ElementMeasurement } from './measurement.js';

/**
 * Element Picker that coordinates with the visual inspector overlay.
 */
export class ElementPickerV2 {
  private unsubscribe: (() => void) | null = null;
  private currentState: InspectorState;

  // Bound handlers
  private handleMouseMove: (e: MouseEvent) => void;
  private handleClick: (e: MouseEvent) => void;

  // Debounce timer
  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly HOVER_DEBOUNCE = 50; // ms

  constructor() {
    this.currentState = inspectorState.getState();

    this.handleMouseMove = this.onMouseMove.bind(this);
    this.handleClick = this.onClick.bind(this);
  }

  /**
   * Initialize the picker.
   */
  init(): void {
    // Subscribe to state changes
    this.unsubscribe = inspectorState.subscribe((state) => {
      const wasPicking = this.currentState.overlayState === 'picking';
      const isPicking = state.overlayState === 'picking';

      // Start/stop listening based on pick mode
      if (isPicking && !wasPicking) {
        this.startListening();
      } else if (!isPicking && wasPicking) {
        this.stopListening();
      }

      this.currentState = state;
    });
  }

  private startListening(): void {
    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('click', this.handleClick, true);
    document.body.style.cursor = 'crosshair';
  }

  private stopListening(): void {
    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.body.style.cursor = '';

    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    // Debounce hover detection
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }

    this.hoverTimeout = setTimeout(() => {
      const element = this.getElementFromPoint(e.clientX, e.clientY);
      if (element && element !== this.currentState.hoveredElement) {
        inspectorState.setHoveredElement(element);
      }
    }, this.HOVER_DEBOUNCE);
  }

  private onClick(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();

    const element = this.getElementFromPoint(e.clientX, e.clientY);
    if (element) {
      const measurement = measureElement(element);
      inspectorState.selectElement(element, measurement);

      // Also send to WebSocket for terminal output
      this.sendToTerminal(measurement);
    }
  }

  private getElementFromPoint(x: number, y: number): Element | null {
    // Hide our overlay elements to get the element underneath
    const overlays = document.querySelectorAll(
      '#design-port-visual-overlay, #design-port-panel, .dp-fab'
    );
    const originalDisplay: Map<Element, string> = new Map();

    overlays.forEach(el => {
      const htmlEl = el as HTMLElement;
      originalDisplay.set(el, htmlEl.style.display);
      htmlEl.style.display = 'none';
    });

    const element = document.elementFromPoint(x, y);

    // Restore overlays
    overlays.forEach(el => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.display = originalDisplay.get(el) || '';
    });

    // Skip our own elements
    if (element?.closest('#design-port-visual-overlay, #design-port-panel')) {
      return null;
    }

    return element;
  }

  /**
   * Send measurement data to terminal via WebSocket.
   */
  private sendToTerminal(measurement: ElementMeasurement): void {
    // Access the global WebSocket client if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (window as any).__designPort;
    if (client?.ws) {
      client.ws.send({
        type: 'element-selected',
        payload: measurement,
      });
    }
  }

  /**
   * Highlight an element by selector.
   */
  highlight(selector: string): void {
    try {
      const element = document.querySelector(selector);
      if (element) {
        const measurement = measureElement(element);
        inspectorState.selectElement(element, measurement);
      }
    } catch {
      // Invalid selector
    }
  }

  /**
   * Clean up.
   */
  destroy(): void {
    this.stopListening();

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
