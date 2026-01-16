/**
 * Multi-Select Manager for browser-side element staging.
 * Handles selecting multiple elements and syncing with terminal.
 */

import type { ElementMeasurement } from './measurement.js';

export interface StagedElement {
  id: string;
  selector: string;
  summary: string;
  tagName: string;
  componentName?: string;
  dimensions?: { width: number; height: number };
  classes?: string[];
  sourceLocation?: { file: string; line: number };
  element: Element;
  measurement?: ElementMeasurement;
}

type StagedChangeListener = (staged: StagedElement[]) => void;

let idCounter = 0;

function generateId(): string {
  return `staged-${Date.now()}-${++idCounter}`;
}

function getSelector(el: Element): string {
  if (el.id) return '#' + el.id;

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    let sel = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift('#' + current.id);
      break;
    }

    const parent: Element | null = current.parentElement;
    if (parent) {
      const currentTag = current.tagName;
      const siblings = Array.from(parent.children).filter((c: Element) => c.tagName === currentTag);
      if (siblings.length > 1) {
        sel += ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')';
      }
    }

    parts.unshift(sel);
    current = parent;
  }

  return parts.join(' > ');
}

function getComponentName(el: Element): string | undefined {
  // React
  const elRecord = el as unknown as Record<string, unknown>;
  const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
  if (fiberKey) {
    let fiber = elRecord[fiberKey] as { type?: { displayName?: string; name?: string }; return?: unknown } | null;
    while (fiber) {
      const name = fiber.type?.displayName || fiber.type?.name;
      if (name && typeof name === 'string' && /^[A-Z]/.test(name)) {
        return name;
      }
      fiber = fiber.return as typeof fiber;
    }
  }

  // Vue
  const vueInstance = elRecord['__vue__'] as { $options?: { name?: string } } | undefined;
  if (vueInstance?.$options?.name) {
    return vueInstance.$options.name;
  }

  // Svelte (check for component context)
  const svelteKey = Object.keys(el).find(k => k.startsWith('__svelte'));
  if (svelteKey) {
    return 'SvelteComponent';
  }

  return undefined;
}

function createSummary(el: Element, componentName?: string): string {
  if (componentName) {
    return componentName;
  }

  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const firstClass = el.classList[0] ? `.${el.classList[0]}` : '';

  return `${tag}${id}${firstClass}`;
}

export class MultiSelectManager {
  private staged: Map<string, StagedElement> = new Map();
  private listeners: Set<StagedChangeListener> = new Set();
  private maxSelections: number = 5;
  private highlights: Map<string, HTMLElement> = new Map();

  constructor(maxSelections: number = 5) {
    this.maxSelections = maxSelections;
  }

  /**
   * Toggle element selection. Returns true if added, false if removed.
   */
  toggle(element: Element, measurement?: ElementMeasurement): boolean {
    // Check if element is already staged (by checking the actual element)
    const existingEntry = Array.from(this.staged.entries()).find(
      ([, staged]) => staged.element === element
    );

    if (existingEntry) {
      // Remove it
      this.remove(existingEntry[0]);
      return false;
    } else {
      // Add it
      this.add(element, measurement);
      return true;
    }
  }

  /**
   * Add an element to the staged list.
   */
  add(element: Element, measurement?: ElementMeasurement): StagedElement {
    const id = generateId();
    const selector = getSelector(element);
    const componentName = getComponentName(element);
    const rect = element.getBoundingClientRect();

    const staged: StagedElement = {
      id,
      selector,
      summary: createSummary(element, componentName),
      tagName: element.tagName.toLowerCase(),
      dimensions: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      classes: Array.from(element.classList).slice(0, 5),
      element,
    };

    // Conditionally assign optional properties (exactOptionalPropertyTypes)
    if (componentName) {
      staged.componentName = componentName;
    }
    if (measurement) {
      staged.measurement = measurement;
    }

    // Remove oldest if at max
    if (this.staged.size >= this.maxSelections) {
      const oldestKey = this.staged.keys().next().value;
      if (oldestKey) {
        this.remove(oldestKey);
      }
    }

    this.staged.set(id, staged);
    this.showStagedHighlight(staged);
    this.notifyListeners();

    return staged;
  }

  /**
   * Remove a staged element by ID.
   */
  remove(id: string): boolean {
    if (this.staged.has(id)) {
      this.staged.delete(id);
      this.removeStagedHighlight(id);
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Clear all staged elements.
   */
  clear(): void {
    // Remove all highlights
    this.highlights.forEach((el, id) => {
      el.remove();
      this.highlights.delete(id);
    });

    this.staged.clear();
    this.notifyListeners();
  }

  /**
   * Check if an element is currently staged.
   */
  isStaged(element: Element): boolean {
    return Array.from(this.staged.values()).some(s => s.element === element);
  }

  /**
   * Get staged element by ID.
   */
  get(id: string): StagedElement | undefined {
    return this.staged.get(id);
  }

  /**
   * Get all staged elements.
   */
  getAll(): StagedElement[] {
    return Array.from(this.staged.values());
  }

  /**
   * Get IDs of all staged elements.
   */
  getIds(): string[] {
    return Array.from(this.staged.keys());
  }

  /**
   * Get staged element count.
   */
  get count(): number {
    return this.staged.size;
  }

  /**
   * Subscribe to changes.
   */
  subscribe(listener: StagedChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Convert staged element to wire format for WebSocket.
   */
  toWireFormat(staged: StagedElement): Record<string, unknown> {
    return {
      id: staged.id,
      selector: staged.selector,
      summary: staged.summary,
      tagName: staged.tagName,
      componentName: staged.componentName,
      dimensions: staged.dimensions,
      classes: staged.classes,
      sourceLocation: staged.sourceLocation,
    };
  }

  /**
   * Show persistent highlight for a staged element.
   */
  private showStagedHighlight(staged: StagedElement): void {
    const rect = staged.element.getBoundingClientRect();

    const highlight = document.createElement('div');
    highlight.id = `__design-port-staged-${staged.id}`;
    highlight.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483646;
      border: 2px solid #10b981;
      background: rgba(16, 185, 129, 0.1);
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      transition: all 0.15s ease;
    `;

    // Add badge showing selection number
    const badge = document.createElement('div');
    const index = Array.from(this.staged.keys()).indexOf(staged.id) + 1;
    badge.style.cssText = `
      position: absolute;
      top: -10px;
      left: -10px;
      width: 20px;
      height: 20px;
      background: #10b981;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font: bold 11px system-ui, sans-serif;
    `;
    badge.textContent = String(index);
    highlight.appendChild(badge);

    document.body.appendChild(highlight);
    this.highlights.set(staged.id, highlight);

    // Update highlight position on scroll/resize
    this.updateHighlightPositions();
  }

  /**
   * Remove highlight for a staged element.
   */
  private removeStagedHighlight(id: string): void {
    const highlight = this.highlights.get(id);
    if (highlight) {
      highlight.remove();
      this.highlights.delete(id);
    }

    // Re-number remaining badges
    this.updateBadgeNumbers();
  }

  /**
   * Update badge numbers after removal.
   */
  private updateBadgeNumbers(): void {
    const ids = Array.from(this.staged.keys());
    ids.forEach((id, index) => {
      const highlight = this.highlights.get(id);
      if (highlight) {
        const badge = highlight.querySelector('div');
        if (badge) {
          badge.textContent = String(index + 1);
        }
      }
    });
  }

  /**
   * Update all highlight positions (call on scroll/resize).
   */
  updateHighlightPositions(): void {
    this.staged.forEach((staged, id) => {
      const highlight = this.highlights.get(id);
      if (highlight && staged.element.isConnected) {
        const rect = staged.element.getBoundingClientRect();
        highlight.style.left = `${rect.left}px`;
        highlight.style.top = `${rect.top}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
      }
    });
  }

  private notifyListeners(): void {
    const staged = this.getAll();
    this.listeners.forEach(listener => listener(staged));
  }
}

// Singleton instance
export const multiSelect = new MultiSelectManager();

// Update positions on scroll/resize
if (typeof window !== 'undefined') {
  let rafId: number | null = null;

  const updatePositions = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      multiSelect.updateHighlightPositions();
      rafId = null;
    });
  };

  window.addEventListener('scroll', updatePositions, true);
  window.addEventListener('resize', updatePositions);
}
