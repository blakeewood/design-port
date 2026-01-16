/**
 * Visual Overlay - Renders element highlights and inline measurements in the browser.
 * This is the browser-first visual feedback layer for Phase 6.5.
 */

import { inspectorState, type InspectorState } from './inspector-state.js';
import type { ElementMeasurement } from './measurement.js';

/**
 * CSS styles for the visual overlay (box model visualization).
 */
const OVERLAY_STYLES = `
  .dp-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2147483647;
  }

  .dp-highlight {
    position: absolute;
    pointer-events: none;
  }

  .dp-highlight__margin {
    background: rgba(246, 178, 107, 0.25);
  }

  .dp-highlight__border {
    background: rgba(255, 229, 153, 0.35);
  }

  .dp-highlight__padding {
    background: rgba(147, 196, 125, 0.35);
  }

  .dp-highlight__content {
    background: rgba(111, 168, 220, 0.4);
    border: 2px solid rgba(99, 102, 241, 0.8);
  }

  .dp-highlight--hover .dp-highlight__content {
    border: 2px dashed rgba(99, 102, 241, 0.6);
  }

  .dp-highlight--locked .dp-highlight__content {
    border: 2px solid #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  }

  .dp-info-badge {
    position: absolute;
    display: flex;
    gap: 6px;
    align-items: center;
    pointer-events: none;
  }

  .dp-info-badge__dimensions {
    background: #1a1a2e;
    color: #fff;
    padding: 4px 10px;
    font-size: 11px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    border-radius: 4px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .dp-info-badge__component {
    background: #7c3aed;
    color: #fff;
    padding: 4px 10px;
    font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border-radius: 4px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .dp-info-badge__source {
    background: #059669;
    color: #fff;
    padding: 4px 10px;
    font-size: 10px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .dp-spacing-label {
    position: absolute;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    padding: 2px 5px;
    font-size: 9px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    border-radius: 2px;
    pointer-events: none;
  }

  .dp-spacing-label--padding {
    color: #93c47d;
  }

  .dp-spacing-label--margin {
    color: #f6b26b;
  }

  .dp-guide-line {
    position: absolute;
    pointer-events: none;
  }

  .dp-guide-line--h {
    height: 1px;
    background: linear-gradient(to right, transparent, rgba(99, 102, 241, 0.5), transparent);
  }

  .dp-guide-line--v {
    width: 1px;
    background: linear-gradient(to bottom, transparent, rgba(99, 102, 241, 0.5), transparent);
  }

  .dp-distance-label {
    position: absolute;
    background: rgba(59, 130, 246, 0.9);
    color: #fff;
    padding: 2px 6px;
    font-size: 9px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    border-radius: 2px;
    pointer-events: none;
  }

  .dp-quick-info {
    position: absolute;
    background: #1a1a2e;
    border: 1px solid #2d2d44;
    border-radius: 8px;
    padding: 12px;
    min-width: 200px;
    max-width: 300px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11px;
    color: #e4e4e7;
  }

  .dp-quick-info__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid #2d2d44;
  }

  .dp-quick-info__name {
    font-weight: 600;
    color: #a78bfa;
  }

  .dp-quick-info__dims {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    color: #71717a;
    font-size: 10px;
  }

  .dp-quick-info__row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
  }

  .dp-quick-info__label {
    color: #71717a;
  }

  .dp-quick-info__value {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    color: #e4e4e7;
  }

  .dp-quick-info__tokens {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #2d2d44;
  }

  .dp-quick-info__token {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
    font-size: 10px;
  }

  .dp-quick-info__token-name {
    color: #fbbf24;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  }

  .dp-quick-info__token-value {
    color: #71717a;
  }

  .dp-pick-indicator {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: #6366f1;
    color: #fff;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    z-index: 2147483647;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dp-pick-indicator__icon {
    animation: dp-pulse 1.5s infinite;
  }

  @keyframes dp-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .dp-fab {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border: none;
    border-radius: 50%;
    color: #fff;
    font-size: 20px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
    z-index: 2147483645;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .dp-fab:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 24px rgba(99, 102, 241, 0.5);
  }

  .dp-fab--active {
    background: linear-gradient(135deg, #22c55e, #16a34a);
  }
`;

/**
 * Visual Overlay component.
 * Renders element highlights, measurements, and quick info popups.
 */
export class VisualOverlay {
  private container: HTMLDivElement | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private fabButton: HTMLButtonElement | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.render = this.render.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Initialize the overlay.
   */
  init(): void {
    if (this.container) return;

    // Inject styles
    this.styleElement = document.createElement('style');
    this.styleElement.textContent = OVERLAY_STYLES;
    document.head.appendChild(this.styleElement);

    // Create overlay container
    this.container = document.createElement('div');
    this.container.id = 'design-port-visual-overlay';
    this.container.className = 'dp-overlay';
    document.body.appendChild(this.container);

    // Create FAB button
    this.fabButton = document.createElement('button');
    this.fabButton.className = 'dp-fab';
    this.fabButton.innerHTML = '◎';
    this.fabButton.title = 'Toggle DesignPort (Ctrl+Shift+P)';
    this.fabButton.addEventListener('click', () => inspectorState.togglePickMode());
    document.body.appendChild(this.fabButton);

    // Keyboard shortcut
    document.addEventListener('keydown', this.handleKeyDown, true);

    // Subscribe to state changes
    this.unsubscribe = inspectorState.subscribe(this.render);

    // Initial render
    this.render(inspectorState.getState());
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Ctrl+Shift+P or Cmd+Shift+P to toggle pick mode
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      e.stopPropagation();
      inspectorState.togglePickMode();
    }

    // ESC to deselect or exit pick mode
    if (e.key === 'Escape') {
      const state = inspectorState.getState();
      if (state.overlayState === 'locked') {
        inspectorState.deselectElement();
      } else if (state.overlayState === 'picking') {
        inspectorState.exitPickMode();
      }
    }
  }

  /**
   * Render the overlay based on current state.
   */
  private render(state: InspectorState): void {
    if (!this.container) return;

    // Update FAB button state
    if (this.fabButton) {
      const isPicking = state.overlayState === 'picking';
      this.fabButton.className = `dp-fab ${isPicking ? 'dp-fab--active' : ''}`;
      this.fabButton.innerHTML = isPicking ? '✓' : '◎';
    }

    // Clear previous content
    this.container.innerHTML = '';

    // Render based on state
    if (state.overlayState === 'hidden') {
      return;
    }

    // Pick mode indicator
    if (state.overlayState === 'picking') {
      this.container.innerHTML += `
        <div class="dp-pick-indicator">
          <span class="dp-pick-indicator__icon">◎</span>
          Click to inspect • ESC to cancel
        </div>
      `;
    }

    // Hover highlight
    if (state.hoveredElement && state.overlayState === 'picking') {
      this.container.innerHTML += this.renderHighlight(state.hoveredElement, 'hover');
    }

    // Selected element highlight
    if (state.selectedElement && state.overlayState === 'locked') {
      this.container.innerHTML += this.renderHighlight(state.selectedElement, 'locked', state.measurement);
    }
  }

  /**
   * Render element highlight with box model visualization.
   */
  private renderHighlight(
    element: Element,
    mode: 'hover' | 'locked',
    measurement?: ElementMeasurement | null
  ): string {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const px = (v: string) => parseFloat(v.replace('px', '')) || 0;

    const margin = {
      top: px(styles.marginTop),
      right: px(styles.marginRight),
      bottom: px(styles.marginBottom),
      left: px(styles.marginLeft),
    };

    const padding = {
      top: px(styles.paddingTop),
      right: px(styles.paddingRight),
      bottom: px(styles.paddingBottom),
      left: px(styles.paddingLeft),
    };

    const border = {
      top: px(styles.borderTopWidth),
      right: px(styles.borderRightWidth),
      bottom: px(styles.borderBottomWidth),
      left: px(styles.borderLeftWidth),
    };

    let html = `<div class="dp-highlight dp-highlight--${mode}">`;

    // Margin layer
    html += `
      <div class="dp-highlight__margin" style="
        left: ${rect.left - margin.left}px;
        top: ${rect.top - margin.top}px;
        width: ${rect.width + margin.left + margin.right}px;
        height: ${rect.height + margin.top + margin.bottom}px;
      "></div>
    `;

    // Border layer
    html += `
      <div class="dp-highlight__border" style="
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
      "></div>
    `;

    // Padding layer
    html += `
      <div class="dp-highlight__padding" style="
        left: ${rect.left + border.left}px;
        top: ${rect.top + border.top}px;
        width: ${rect.width - border.left - border.right}px;
        height: ${rect.height - border.top - border.bottom}px;
      "></div>
    `;

    // Content layer
    html += `
      <div class="dp-highlight__content" style="
        left: ${rect.left + border.left + padding.left}px;
        top: ${rect.top + border.top + padding.top}px;
        width: ${rect.width - border.left - border.right - padding.left - padding.right}px;
        height: ${rect.height - border.top - border.bottom - padding.top - padding.bottom}px;
      "></div>
    `;

    // Spacing labels (only for locked mode)
    if (mode === 'locked') {
      html += this.renderSpacingLabels(rect, padding, margin);
    }

    html += '</div>';

    // Info badge
    const badgeTop = rect.top > 36 ? rect.top - 32 : rect.bottom + 8;
    const componentName = measurement?.componentName || this.getComponentName(element);

    html += `
      <div class="dp-info-badge" style="left: ${rect.left}px; top: ${badgeTop}px;">
        <span class="dp-info-badge__dimensions">${Math.round(rect.width)} × ${Math.round(rect.height)}</span>
        ${componentName ? `<span class="dp-info-badge__component">&lt;${componentName}&gt;</span>` : ''}
        ${measurement?.sourceLocation ? `
          <span class="dp-info-badge__source">${this.shortenPath(measurement.sourceLocation.file)}:${measurement.sourceLocation.line}</span>
        ` : ''}
      </div>
    `;

    // Quick info popup for locked mode
    if (mode === 'locked' && measurement) {
      html += this.renderQuickInfo(rect, measurement);
    }

    // Guide lines for locked mode
    if (mode === 'locked') {
      html += this.renderGuideLines(rect);
    }

    return html;
  }

  private renderSpacingLabels(
    rect: DOMRect,
    padding: { top: number; right: number; bottom: number; left: number },
    margin: { top: number; right: number; bottom: number; left: number }
  ): string {
    let html = '';

    // Padding labels
    if (padding.top > 6) {
      html += `<span class="dp-spacing-label dp-spacing-label--padding" style="
        left: ${rect.left + rect.width / 2 - 15}px;
        top: ${rect.top + padding.top / 2 - 8}px;
      ">p: ${Math.round(padding.top)}</span>`;
    }
    if (padding.bottom > 6) {
      html += `<span class="dp-spacing-label dp-spacing-label--padding" style="
        left: ${rect.left + rect.width / 2 - 15}px;
        top: ${rect.bottom - padding.bottom / 2 - 8}px;
      ">p: ${Math.round(padding.bottom)}</span>`;
    }
    if (padding.left > 12) {
      html += `<span class="dp-spacing-label dp-spacing-label--padding" style="
        left: ${rect.left + padding.left / 2 - 15}px;
        top: ${rect.top + rect.height / 2 - 8}px;
      ">p: ${Math.round(padding.left)}</span>`;
    }
    if (padding.right > 12) {
      html += `<span class="dp-spacing-label dp-spacing-label--padding" style="
        left: ${rect.right - padding.right / 2 - 15}px;
        top: ${rect.top + rect.height / 2 - 8}px;
      ">p: ${Math.round(padding.right)}</span>`;
    }

    // Margin labels
    if (margin.top > 6) {
      html += `<span class="dp-spacing-label dp-spacing-label--margin" style="
        left: ${rect.left + rect.width / 2 - 15}px;
        top: ${rect.top - margin.top / 2 - 8}px;
      ">m: ${Math.round(margin.top)}</span>`;
    }
    if (margin.bottom > 6) {
      html += `<span class="dp-spacing-label dp-spacing-label--margin" style="
        left: ${rect.left + rect.width / 2 - 15}px;
        top: ${rect.bottom + margin.bottom / 2 - 8}px;
      ">m: ${Math.round(margin.bottom)}</span>`;
    }

    return html;
  }

  private renderGuideLines(rect: DOMRect): string {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    return `
      <div class="dp-guide-line dp-guide-line--h" style="
        left: 0;
        top: ${centerY}px;
        width: 100%;
      "></div>
      <div class="dp-guide-line dp-guide-line--v" style="
        left: ${centerX}px;
        top: 0;
        height: 100%;
      "></div>
      <span class="dp-distance-label" style="
        left: ${rect.left / 2 - 15}px;
        top: ${centerY - 12}px;
      ">${Math.round(rect.left)}</span>
      <span class="dp-distance-label" style="
        left: ${centerX + 4}px;
        top: ${rect.top / 2 - 8}px;
      ">${Math.round(rect.top)}</span>
      <span class="dp-distance-label" style="
        left: ${rect.right + (vw - rect.right) / 2 - 15}px;
        top: ${centerY - 12}px;
      ">${Math.round(vw - rect.right)}</span>
      <span class="dp-distance-label" style="
        left: ${centerX + 4}px;
        top: ${rect.bottom + (vh - rect.bottom) / 2 - 8}px;
      ">${Math.round(vh - rect.bottom)}</span>
    `;
  }

  private renderQuickInfo(rect: DOMRect, m: ElementMeasurement): string {
    // Position the info popup
    const popupWidth = 240;
    const popupHeight = 200;
    let left = rect.right + 16;
    let top = rect.top;

    // Adjust if off-screen
    if (left + popupWidth > window.innerWidth - 16) {
      left = rect.left - popupWidth - 16;
    }
    if (left < 16) {
      left = rect.left;
      top = rect.bottom + 16;
    }
    if (top + popupHeight > window.innerHeight - 16) {
      top = window.innerHeight - popupHeight - 16;
    }

    const tokens = m.tailwindClasses.filter(c => c.tokenPath).slice(0, 4);

    return `
      <div class="dp-quick-info" style="left: ${left}px; top: ${top}px;">
        <div class="dp-quick-info__header">
          <span class="dp-quick-info__name">${m.componentName || `<${m.tagName}>`}</span>
          <span class="dp-quick-info__dims">${Math.round(m.bounds.width)} × ${Math.round(m.bounds.height)}</span>
        </div>

        <div class="dp-quick-info__row">
          <span class="dp-quick-info__label">Padding</span>
          <span class="dp-quick-info__value">${this.formatBox(m.boxModel.padding)}</span>
        </div>
        <div class="dp-quick-info__row">
          <span class="dp-quick-info__label">Margin</span>
          <span class="dp-quick-info__value">${this.formatBox(m.boxModel.margin)}</span>
        </div>
        ${m.computedStyles['font-size'] ? `
        <div class="dp-quick-info__row">
          <span class="dp-quick-info__label">Font</span>
          <span class="dp-quick-info__value">${m.computedStyles['font-size']}</span>
        </div>
        ` : ''}

        ${tokens.length > 0 ? `
        <div class="dp-quick-info__tokens">
          ${tokens.map(t => `
            <div class="dp-quick-info__token">
              <span class="dp-quick-info__token-name">${t.className}</span>
              <span class="dp-quick-info__token-value">${t.tokenPath}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
    `;
  }

  private formatBox(box: { top: number; right: number; bottom: number; left: number }): string {
    const { top, right, bottom, left } = box;
    if (top === right && right === bottom && bottom === left) {
      return `${Math.round(top)}`;
    }
    if (top === bottom && left === right) {
      return `${Math.round(top)} ${Math.round(right)}`;
    }
    return `${Math.round(top)} ${Math.round(right)} ${Math.round(bottom)} ${Math.round(left)}`;
  }

  private shortenPath(path: string): string {
    const parts = path.split('/');
    if (parts.length <= 2) return path;
    return parts.slice(-2).join('/');
  }

  private getComponentName(element: Element): string | undefined {
    // Quick check for React component
    const reactKey = Object.keys(element).find(
      k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
    );

    if (reactKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let fiber = (element as any)[reactKey];
      while (fiber) {
        const type = fiber.type;
        if (type && typeof type !== 'string') {
          const name = type.displayName || type.name;
          if (name && !name.startsWith('_')) return name;
        }
        fiber = fiber.return;
      }
    }

    // Vue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vue = (element as any).__vueParentComponent || (element as any).__vue__;
    if (vue?.type?.name) return vue.type.name;
    if (vue?.$options?.name) return vue.$options.name;

    // Svelte
    const svelteKeys = Object.keys(element).filter(k => k.startsWith('__svelte'));
    if (svelteKeys.length > 0) return 'SvelteComponent';

    return undefined;
  }

  /**
   * Destroy the overlay.
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown, true);

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    if (this.fabButton) {
      this.fabButton.remove();
      this.fabButton = null;
    }
  }
}
