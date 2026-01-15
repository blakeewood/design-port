/**
 * Element picker for click-to-select inspection.
 */

import { MeasurementOverlay } from './overlay.js';
import { measureElement, type ElementMeasurement } from './measurement.js';

export type SelectionHandler = (measurement: ElementMeasurement) => void;

export class ElementPicker {
  private overlay: MeasurementOverlay;
  private enabled = false;
  private hoveredElement: Element | null = null;
  private onSelect: SelectionHandler | null = null;

  // Bound handlers for event listener cleanup
  private handleMouseMove: (e: MouseEvent) => void;
  private handleClick: (e: MouseEvent) => void;
  private handleKeyDown: (e: KeyboardEvent) => void;

  constructor() {
    this.overlay = new MeasurementOverlay();

    this.handleMouseMove = this.onMouseMove.bind(this);
    this.handleClick = this.onClick.bind(this);
    this.handleKeyDown = this.onKeyDown.bind(this);
  }

  /**
   * Enable element picking mode.
   */
  enable(onSelect: SelectionHandler): void {
    if (this.enabled) return;

    this.enabled = true;
    this.onSelect = onSelect;
    this.overlay.init();

    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeyDown, true);

    // Change cursor
    document.body.style.cursor = 'crosshair';
  }

  /**
   * Disable element picking mode.
   */
  disable(): void {
    if (!this.enabled) return;

    this.enabled = false;
    this.onSelect = null;
    this.hoveredElement = null;

    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeyDown, true);

    this.overlay.clear();
    document.body.style.cursor = '';
  }

  /**
   * Highlight a specific element by selector.
   */
  highlight(selector: string): void {
    try {
      const element = document.querySelector(selector);
      if (element) {
        this.overlay.show(element);
      }
    } catch {
      // Invalid selector
    }
  }

  /**
   * Clear highlighting.
   */
  clearHighlight(): void {
    this.overlay.clear();
  }

  /**
   * Check if picker is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.disable();
    this.overlay.destroy();
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.enabled) return;

    const element = this.getElementFromPoint(e.clientX, e.clientY);
    if (element && element !== this.hoveredElement) {
      this.hoveredElement = element;
      this.overlay.show(element);
    }
  }

  private onClick(e: MouseEvent): void {
    if (!this.enabled) return;

    e.preventDefault();
    e.stopPropagation();

    const element = this.getElementFromPoint(e.clientX, e.clientY);
    if (element && this.onSelect) {
      const measurement = measureElement(element);
      this.onSelect(measurement);
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;

    // ESC to disable
    if (e.key === 'Escape') {
      this.disable();
    }
  }

  private getElementFromPoint(x: number, y: number): Element | null {
    // Temporarily hide overlay to get element underneath
    const overlayEl = document.getElementById('design-port-overlay');
    if (overlayEl) {
      overlayEl.style.display = 'none';
    }

    const element = document.elementFromPoint(x, y);

    if (overlayEl) {
      overlayEl.style.display = '';
    }

    // Skip our own overlay elements
    if (element?.closest('#design-port-overlay')) {
      return null;
    }

    return element;
  }
}
