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
        const componentName = this.getComponentName(element);
        this.overlay.show(element, componentName);
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
      // Get component name for display in overlay
      const componentName = this.getComponentName(element);
      this.overlay.show(element, componentName);
    }
  }

  /**
   * Extract React/Vue/Svelte component name from an element.
   */
  private getComponentName(element: Element): string | undefined {
    // Try React (multiple fiber key formats for different React versions)
    const reactKeys = Object.keys(element).filter(
      (k) => k.startsWith('__reactFiber$') ||
             k.startsWith('__reactInternalInstance$')
    );

    for (const key of reactKeys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fiber = (element as any)[key];
      while (fiber) {
        const type = fiber.type;
        if (type) {
          const name = type.displayName || type.name;
          if (name && typeof name === 'string' && !name.startsWith('_')) {
            return name;
          }
        }
        fiber = fiber.return;
      }
    }

    // Try Vue 3
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vue3 = (element as any).__vueParentComponent;
    if (vue3?.type?.name) {
      return vue3.type.name;
    }

    // Try Vue 2
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vue2 = (element as any).__vue__;
    if (vue2) {
      return vue2.$options?.name || vue2.$options?._componentTag;
    }

    // Try Svelte
    const svelteKeys = Object.keys(element).filter(k => k.startsWith('__svelte'));
    if (svelteKeys.length > 0) {
      return 'SvelteComponent';
    }

    return undefined;
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
