/**
 * Visual Inspector Panel - Browser-first UI for design inspection.
 * Renders a Figma-like panel with measurements, tokens, and component info.
 */

import {
  inspectorState,
  type InspectorState,
  type InspectorTab,
  type ComponentContext,
  type ResponsiveValue,
  DEFAULT_BREAKPOINTS,
  type Breakpoint,
} from './inspector-state.js';

/**
 * CSS styles for the inspector panel (scoped with unique prefix).
 */
const PANEL_STYLES = `
  .dp-panel {
    position: fixed;
    background: #1a1a2e;
    color: #e4e4e7;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    z-index: 2147483646;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 80vh;
  }

  .dp-panel--right {
    top: 16px;
    right: 16px;
    width: 320px;
    bottom: 16px;
  }

  .dp-panel--bottom {
    left: 16px;
    right: 16px;
    bottom: 16px;
    height: 280px;
  }

  .dp-panel--floating {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 400px;
    max-height: 500px;
  }

  .dp-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #16162a;
    border-bottom: 1px solid #2d2d44;
  }

  .dp-panel__title {
    font-weight: 600;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dp-panel__title-icon {
    width: 16px;
    height: 16px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    border-radius: 4px;
  }

  .dp-panel__controls {
    display: flex;
    gap: 8px;
  }

  .dp-panel__btn {
    background: transparent;
    border: none;
    color: #a1a1aa;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    transition: all 0.15s;
  }

  .dp-panel__btn:hover {
    background: #2d2d44;
    color: #e4e4e7;
  }

  .dp-panel__btn--active {
    background: #6366f1;
    color: #fff;
  }

  .dp-panel__element-info {
    padding: 12px 16px;
    background: #1e1e36;
    border-bottom: 1px solid #2d2d44;
  }

  .dp-panel__element-tag {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    color: #f472b6;
    font-size: 11px;
  }

  .dp-panel__element-name {
    font-weight: 600;
    color: #a78bfa;
    font-size: 14px;
    margin-bottom: 4px;
  }

  .dp-panel__element-path {
    font-size: 10px;
    color: #71717a;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .dp-panel__element-path a {
    color: #60a5fa;
    text-decoration: none;
  }

  .dp-panel__element-path a:hover {
    text-decoration: underline;
  }

  .dp-panel__tabs {
    display: flex;
    border-bottom: 1px solid #2d2d44;
    background: #16162a;
    overflow-x: auto;
  }

  .dp-panel__tab {
    padding: 8px 16px;
    background: transparent;
    border: none;
    color: #71717a;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
  }

  .dp-panel__tab:hover {
    color: #e4e4e7;
    background: #1e1e36;
  }

  .dp-panel__tab--active {
    color: #a78bfa;
    border-bottom-color: #a78bfa;
  }

  .dp-panel__content {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
  }

  .dp-panel__section {
    margin-bottom: 16px;
  }

  .dp-panel__section-title {
    font-weight: 600;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #71717a;
    margin-bottom: 8px;
  }

  .dp-panel__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    border-bottom: 1px solid #2d2d44;
  }

  .dp-panel__row:last-child {
    border-bottom: none;
  }

  .dp-panel__label {
    color: #a1a1aa;
    font-size: 11px;
  }

  .dp-panel__value {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 11px;
    color: #e4e4e7;
  }

  .dp-panel__value--color {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dp-panel__color-swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1px solid #3d3d5c;
  }

  .dp-panel__token {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: #1e1e36;
    border-radius: 4px;
    margin-bottom: 4px;
  }

  .dp-panel__token-name {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 11px;
    color: #fbbf24;
  }

  .dp-panel__token-value {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 10px;
    color: #71717a;
  }

  .dp-panel__breakpoints {
    display: flex;
    gap: 4px;
    padding: 8px 0;
  }

  .dp-panel__breakpoint {
    padding: 6px 12px;
    background: #1e1e36;
    border: 1px solid #2d2d44;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    color: #a1a1aa;
    transition: all 0.15s;
  }

  .dp-panel__breakpoint:hover {
    border-color: #6366f1;
  }

  .dp-panel__breakpoint--active {
    background: #6366f1;
    border-color: #6366f1;
    color: #fff;
  }

  .dp-panel__responsive-value {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    background: #1e1e36;
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .dp-panel__responsive-prop {
    font-weight: 500;
    color: #e4e4e7;
    font-size: 11px;
  }

  .dp-panel__responsive-values {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .dp-panel__responsive-item {
    font-size: 10px;
    color: #71717a;
  }

  .dp-panel__responsive-item--current {
    color: #a78bfa;
    font-weight: 500;
  }

  .dp-panel__responsive-consistent {
    color: #22c55e;
    font-size: 10px;
  }

  .dp-panel__component {
    background: #1e1e36;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 8px;
  }

  .dp-panel__component-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .dp-panel__component-name {
    font-weight: 600;
    color: #a78bfa;
    font-size: 13px;
  }

  .dp-panel__component-badge {
    font-size: 9px;
    padding: 2px 6px;
    background: #6366f1;
    border-radius: 10px;
    color: #fff;
  }

  .dp-panel__props-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .dp-panel__prop {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
  }

  .dp-panel__prop-name {
    color: #f472b6;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  }

  .dp-panel__prop-value {
    color: #fbbf24;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  }

  .dp-panel__variants {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #2d2d44;
  }

  .dp-panel__variants-title {
    font-size: 10px;
    color: #71717a;
    margin-bottom: 6px;
  }

  .dp-panel__variants-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .dp-panel__variant {
    font-size: 10px;
    padding: 2px 8px;
    background: #2d2d44;
    border-radius: 4px;
    color: #a1a1aa;
  }

  .dp-panel__variant--current {
    background: #6366f1;
    color: #fff;
  }

  .dp-panel__box-model {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px;
  }

  .dp-panel__box-model-diagram {
    position: relative;
    width: 200px;
    height: 150px;
  }

  .dp-panel__box-layer {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  }

  .dp-panel__box-margin {
    inset: 0;
    background: rgba(246, 178, 107, 0.3);
    border: 1px dashed #f6b26b;
  }

  .dp-panel__box-border {
    inset: 15px;
    background: rgba(255, 229, 153, 0.3);
    border: 1px solid #ffe599;
  }

  .dp-panel__box-padding {
    inset: 30px;
    background: rgba(147, 196, 125, 0.3);
    border: 1px solid #93c47d;
  }

  .dp-panel__box-content {
    inset: 45px;
    background: rgba(111, 168, 220, 0.5);
    border: 1px solid #6fa8dc;
    color: #fff;
    font-weight: 600;
  }

  .dp-panel__box-label {
    position: absolute;
    font-size: 9px;
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
    padding: 1px 4px;
    border-radius: 2px;
  }

  .dp-panel__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    color: #71717a;
    text-align: center;
  }

  .dp-panel__empty-icon {
    font-size: 32px;
    margin-bottom: 12px;
  }

  .dp-panel__empty-text {
    font-size: 13px;
    margin-bottom: 8px;
  }

  .dp-panel__empty-hint {
    font-size: 11px;
    color: #52525b;
  }

  .dp-panel__kbd {
    display: inline-block;
    padding: 2px 6px;
    background: #2d2d44;
    border-radius: 4px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 10px;
  }

  .dp-panel__history {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 120px;
    overflow-y: auto;
  }

  .dp-panel__history-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: #1e1e36;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.15s;
  }

  .dp-panel__history-item:hover {
    background: #2d2d44;
  }

  .dp-panel__history-tag {
    color: #f472b6;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  }

  .dp-panel__history-name {
    color: #a78bfa;
  }
`;

/**
 * Inspector Panel component.
 * Renders the main inspection UI in the browser.
 */
export class InspectorPanel {
  private container: HTMLDivElement | null = null;
  private styleElement: HTMLStyleElement | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.render = this.render.bind(this);
  }

  /**
   * Initialize the panel.
   */
  init(): void {
    if (this.container) return;

    // Inject styles
    this.styleElement = document.createElement('style');
    this.styleElement.textContent = PANEL_STYLES;
    document.head.appendChild(this.styleElement);

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'design-port-panel';
    document.body.appendChild(this.container);

    // Subscribe to state changes
    this.unsubscribe = inspectorState.subscribe(this.render);

    // Initial render
    this.render(inspectorState.getState());
  }

  /**
   * Render the panel based on current state.
   */
  private render(state: InspectorState): void {
    if (!this.container) return;

    // Hide if not visible
    if (!state.panelVisible || state.overlayState === 'hidden') {
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'block';
    this.container.innerHTML = this.renderPanel(state);
    this.attachEventListeners(state);
  }

  private renderPanel(state: InspectorState): string {
    const positionClass = `dp-panel--${state.panelPosition}`;

    return `
      <div class="dp-panel ${positionClass}">
        ${this.renderHeader(state)}
        ${state.measurement ? this.renderElementInfo(state) : ''}
        ${this.renderTabs(state)}
        <div class="dp-panel__content">
          ${state.measurement
            ? this.renderTabContent(state)
            : this.renderEmptyState(state)}
        </div>
      </div>
    `;
  }

  private renderHeader(state: InspectorState): string {
    const isPickMode = state.overlayState === 'picking';

    return `
      <div class="dp-panel__header">
        <div class="dp-panel__title">
          <div class="dp-panel__title-icon"></div>
          DesignPort
        </div>
        <div class="dp-panel__controls">
          <button class="dp-panel__btn ${isPickMode ? 'dp-panel__btn--active' : ''}" data-action="toggle-pick">
            ${isPickMode ? '✓ Picking' : '◎ Pick'}
          </button>
          <button class="dp-panel__btn" data-action="close">✕</button>
        </div>
      </div>
    `;
  }

  private renderElementInfo(state: InspectorState): string {
    const m = state.measurement!;
    const hasSource = m.sourceLocation?.file;

    return `
      <div class="dp-panel__element-info">
        ${m.componentName
          ? `<div class="dp-panel__element-name">&lt;${m.componentName}&gt;</div>`
          : `<div class="dp-panel__element-tag">&lt;${m.tagName}&gt;</div>`}
        ${hasSource ? `
          <div class="dp-panel__element-path">
            📁 <a href="#" data-action="open-file" data-file="${m.sourceLocation!.file}" data-line="${m.sourceLocation!.line}">
              ${this.shortenPath(m.sourceLocation!.file)}:${m.sourceLocation!.line}
            </a>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderTabs(state: InspectorState): string {
    const tabs: Array<{ id: InspectorTab; label: string }> = [
      { id: 'styles', label: 'Styles' },
      { id: 'layout', label: 'Layout' },
      { id: 'tokens', label: 'Tokens' },
      { id: 'classes', label: 'Classes' },
      { id: 'computed', label: 'Computed' },
    ];

    return `
      <div class="dp-panel__tabs">
        ${tabs.map(tab => `
          <button
            class="dp-panel__tab ${state.activeTab === tab.id ? 'dp-panel__tab--active' : ''}"
            data-action="set-tab"
            data-tab="${tab.id}"
          >${tab.label}</button>
        `).join('')}
      </div>
    `;
  }

  private renderTabContent(state: InspectorState): string {
    switch (state.activeTab) {
      case 'styles':
        return this.renderStylesTab(state);
      case 'layout':
        return this.renderLayoutTab(state);
      case 'tokens':
        return this.renderTokensTab(state);
      case 'classes':
        return this.renderClassesTab(state);
      case 'computed':
        return this.renderComputedTab(state);
      default:
        return '';
    }
  }

  private renderStylesTab(state: InspectorState): string {
    const m = state.measurement!;
    let html = '';

    // Dimensions section
    html += `
      <div class="dp-panel__section">
        <div class="dp-panel__section-title">Dimensions</div>
        <div class="dp-panel__row">
          <span class="dp-panel__label">Size</span>
          <span class="dp-panel__value">${Math.round(m.bounds.width)} × ${Math.round(m.bounds.height)}</span>
        </div>
        <div class="dp-panel__row">
          <span class="dp-panel__label">Position</span>
          <span class="dp-panel__value">${Math.round(m.bounds.x)}, ${Math.round(m.bounds.y)}</span>
        </div>
      </div>
    `;

    // Spacing section
    html += `
      <div class="dp-panel__section">
        <div class="dp-panel__section-title">Spacing</div>
        <div class="dp-panel__row">
          <span class="dp-panel__label">Padding</span>
          <span class="dp-panel__value">${this.formatBoxValues(m.boxModel.padding)}</span>
        </div>
        <div class="dp-panel__row">
          <span class="dp-panel__label">Margin</span>
          <span class="dp-panel__value">${this.formatBoxValues(m.boxModel.margin)}</span>
        </div>
        <div class="dp-panel__row">
          <span class="dp-panel__label">Border</span>
          <span class="dp-panel__value">${this.formatBoxValues(m.boxModel.border)}</span>
        </div>
      </div>
    `;

    // Typography section
    const typoStyles = ['font-family', 'font-size', 'font-weight', 'line-height', 'color'];
    const hasTypo = typoStyles.some(p => m.computedStyles[p]);

    if (hasTypo) {
      html += `
        <div class="dp-panel__section">
          <div class="dp-panel__section-title">Typography</div>
          ${typoStyles.filter(p => m.computedStyles[p]).map(p => `
            <div class="dp-panel__row">
              <span class="dp-panel__label">${p}</span>
              <span class="dp-panel__value${p === 'color' ? ' dp-panel__value--color' : ''}">
                ${p === 'color' ? `<span class="dp-panel__color-swatch" style="background: ${m.computedStyles[p]}"></span>` : ''}
                ${m.computedStyles[p]}
              </span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Component context
    if (state.componentContext) {
      html += this.renderComponentContext(state.componentContext);
    }

    // Responsive breakpoints
    html += this.renderBreakpointSwitcher(state);

    return html;
  }

  private renderLayoutTab(state: InspectorState): string {
    const m = state.measurement!;

    return `
      <div class="dp-panel__box-model">
        <div class="dp-panel__box-model-diagram">
          <div class="dp-panel__box-layer dp-panel__box-margin">
            <span class="dp-panel__box-label" style="top: 2px; left: 50%; transform: translateX(-50%);">${m.boxModel.margin.top}</span>
            <span class="dp-panel__box-label" style="bottom: 2px; left: 50%; transform: translateX(-50%);">${m.boxModel.margin.bottom}</span>
            <span class="dp-panel__box-label" style="left: 2px; top: 50%; transform: translateY(-50%);">${m.boxModel.margin.left}</span>
            <span class="dp-panel__box-label" style="right: 2px; top: 50%; transform: translateY(-50%);">${m.boxModel.margin.right}</span>
          </div>
          <div class="dp-panel__box-layer dp-panel__box-border"></div>
          <div class="dp-panel__box-layer dp-panel__box-padding">
            <span class="dp-panel__box-label" style="top: 2px; left: 50%; transform: translateX(-50%);">${m.boxModel.padding.top}</span>
            <span class="dp-panel__box-label" style="bottom: 2px; left: 50%; transform: translateX(-50%);">${m.boxModel.padding.bottom}</span>
          </div>
          <div class="dp-panel__box-layer dp-panel__box-content">
            ${Math.round(m.boxModel.content.width)} × ${Math.round(m.boxModel.content.height)}
          </div>
        </div>
      </div>

      <div class="dp-panel__section">
        <div class="dp-panel__section-title">Layout Properties</div>
        ${['display', 'position', 'flex-direction', 'justify-content', 'align-items', 'gap']
          .filter(p => m.computedStyles[p])
          .map(p => `
            <div class="dp-panel__row">
              <span class="dp-panel__label">${p}</span>
              <span class="dp-panel__value">${m.computedStyles[p]}</span>
            </div>
          `).join('')}
      </div>
    `;
  }

  private renderTokensTab(state: InspectorState): string {
    const m = state.measurement!;
    let html = '';

    // CSS Variables
    if (m.cssVariables.length > 0) {
      html += `
        <div class="dp-panel__section">
          <div class="dp-panel__section-title">CSS Variables</div>
          ${m.cssVariables.map(v => `
            <div class="dp-panel__token">
              <span class="dp-panel__token-name">${v.variable}</span>
              <span class="dp-panel__token-value">${v.resolvedValue}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Tailwind tokens
    const tailwindTokens = m.tailwindClasses.filter(c => c.tokenPath);
    if (tailwindTokens.length > 0) {
      html += `
        <div class="dp-panel__section">
          <div class="dp-panel__section-title">Tailwind Tokens</div>
          ${tailwindTokens.map(t => `
            <div class="dp-panel__token">
              <span class="dp-panel__token-name">${t.className}</span>
              <span class="dp-panel__token-value">${t.tokenPath}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Responsive values
    if (state.responsiveValues.length > 0) {
      html += this.renderResponsiveValues(state.responsiveValues, state.currentBreakpoint);
    }

    if (!html) {
      html = `
        <div class="dp-panel__empty">
          <div class="dp-panel__empty-icon">🎨</div>
          <div class="dp-panel__empty-text">No design tokens detected</div>
          <div class="dp-panel__empty-hint">This element may use inline styles or custom CSS</div>
        </div>
      `;
    }

    return html;
  }

  private renderClassesTab(state: InspectorState): string {
    const m = state.measurement!;

    if (m.classList.length === 0) {
      return `
        <div class="dp-panel__empty">
          <div class="dp-panel__empty-icon">📝</div>
          <div class="dp-panel__empty-text">No classes applied</div>
        </div>
      `;
    }

    // Group by variant
    const baseClasses = m.tailwindClasses.filter(c => !c.variant);
    const variantClasses = m.tailwindClasses.filter(c => c.variant);

    let html = '';

    if (baseClasses.length > 0) {
      html += `
        <div class="dp-panel__section">
          <div class="dp-panel__section-title">Base Classes</div>
          ${baseClasses.map(c => `
            <div class="dp-panel__row">
              <span class="dp-panel__label dp-panel__token-name">${c.className}</span>
              <span class="dp-panel__value">${c.property}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (variantClasses.length > 0) {
      html += `
        <div class="dp-panel__section">
          <div class="dp-panel__section-title">Responsive/State Classes</div>
          ${variantClasses.map(c => `
            <div class="dp-panel__row">
              <span class="dp-panel__label"><span style="color: #60a5fa">${c.variant}:</span>${c.className.split(':').pop()}</span>
              <span class="dp-panel__value">${c.property}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Show raw class list
    html += `
      <div class="dp-panel__section">
        <div class="dp-panel__section-title">All Classes</div>
        <div style="font-family: monospace; font-size: 10px; color: #a1a1aa; word-break: break-all;">
          ${m.classList.join(' ')}
        </div>
      </div>
    `;

    return html;
  }

  private renderComputedTab(state: InspectorState): string {
    const m = state.measurement!;
    const styles = Object.entries(m.computedStyles);

    if (styles.length === 0) {
      return `
        <div class="dp-panel__empty">
          <div class="dp-panel__empty-text">No computed styles</div>
        </div>
      `;
    }

    return `
      <div class="dp-panel__section">
        ${styles.map(([prop, value]) => `
          <div class="dp-panel__row">
            <span class="dp-panel__label">${prop}</span>
            <span class="dp-panel__value">${value}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderComponentContext(context: ComponentContext): string {
    let html = `
      <div class="dp-panel__section">
        <div class="dp-panel__section-title">Component</div>
        <div class="dp-panel__component">
          <div class="dp-panel__component-header">
            <span class="dp-panel__component-name">${context.name}</span>
            ${context.isReusable ? '<span class="dp-panel__component-badge">Reusable</span>' : ''}
          </div>
    `;

    // Props
    if (context.props.length > 0) {
      html += `
        <div class="dp-panel__props-list">
          ${context.props.slice(0, 5).map(p => `
            <div class="dp-panel__prop">
              <span class="dp-panel__prop-name">${p.name}</span>
              <span class="dp-panel__prop-value">${this.formatPropValue(p.currentValue)}</span>
            </div>
          `).join('')}
          ${context.props.length > 5 ? `<div style="color: #71717a; font-size: 10px;">+${context.props.length - 5} more props</div>` : ''}
        </div>
      `;

      // Variants for specific props
      const variantProps = context.props.filter(p => p.possibleValues && p.possibleValues.length > 0);
      if (variantProps.length > 0) {
        html += `
          <div class="dp-panel__variants">
            <div class="dp-panel__variants-title">Available Variants</div>
            ${variantProps.map(p => `
              <div style="margin-bottom: 6px;">
                <span style="color: #71717a; font-size: 10px;">${p.name}:</span>
                <div class="dp-panel__variants-list">
                  ${p.possibleValues!.map(v => `
                    <span class="dp-panel__variant ${v === p.currentValue ? 'dp-panel__variant--current' : ''}">${v}</span>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    }

    html += '</div></div>';
    return html;
  }

  private renderBreakpointSwitcher(state: InspectorState): string {
    return `
      <div class="dp-panel__section">
        <div class="dp-panel__section-title">Breakpoints</div>
        <div class="dp-panel__breakpoints">
          ${DEFAULT_BREAKPOINTS.map(bp => `
            <button
              class="dp-panel__breakpoint ${state.currentBreakpoint.width === bp.width ? 'dp-panel__breakpoint--active' : ''}"
              data-action="set-breakpoint"
              data-width="${bp.width}"
            >${bp.icon} ${bp.width}px</button>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderResponsiveValues(values: ResponsiveValue[], currentBp: Breakpoint): string {
    if (values.length === 0) return '';

    return `
      <div class="dp-panel__section">
        <div class="dp-panel__section-title">Responsive Values</div>
        ${values.map(rv => `
          <div class="dp-panel__responsive-value">
            <div class="dp-panel__responsive-prop">${rv.property}</div>
            <div class="dp-panel__responsive-values">
              ${Array.from(rv.values.entries()).map(([width, value]) => `
                <span class="dp-panel__responsive-item ${width <= currentBp.width ? 'dp-panel__responsive-item--current' : ''}">
                  ${width}px: ${value}
                </span>
              `).join(' → ')}
            </div>
            ${rv.isConsistent ? '<span class="dp-panel__responsive-consistent">✓ Consistent</span>' : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderEmptyState(state: InspectorState): string {
    const isPicking = state.overlayState === 'picking';

    if (isPicking) {
      return `
        <div class="dp-panel__empty">
          <div class="dp-panel__empty-icon">👆</div>
          <div class="dp-panel__empty-text">Click an element to inspect</div>
          <div class="dp-panel__empty-hint">Press <span class="dp-panel__kbd">ESC</span> to exit pick mode</div>
        </div>
      `;
    }

    return `
      <div class="dp-panel__empty">
        <div class="dp-panel__empty-icon">🔍</div>
        <div class="dp-panel__empty-text">No element selected</div>
        <div class="dp-panel__empty-hint">
          Press <span class="dp-panel__kbd">Ctrl+Shift+P</span> to start picking
        </div>
      </div>

      ${state.selectionHistory.length > 0 ? `
        <div class="dp-panel__section">
          <div class="dp-panel__section-title">Recent Selections</div>
          <div class="dp-panel__history">
            ${state.selectionHistory.slice(0, 5).map((item, i) => `
              <div class="dp-panel__history-item" data-action="select-history" data-index="${i}">
                <span class="dp-panel__history-tag">&lt;${item.measurement.tagName}&gt;</span>
                ${item.measurement.componentName ? `<span class="dp-panel__history-name">${item.measurement.componentName}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  // ==================== Helpers ====================

  private formatBoxValues(box: { top: number; right: number; bottom: number; left: number }): string {
    const { top, right, bottom, left } = box;
    if (top === right && right === bottom && bottom === left) {
      return `${top}px`;
    }
    if (top === bottom && left === right) {
      return `${top}px ${right}px`;
    }
    return `${top}px ${right}px ${bottom}px ${left}px`;
  }

  private formatPropValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'function') return '[function]';
    if (typeof value === 'object') return JSON.stringify(value).slice(0, 30);
    if (typeof value === 'string') return `"${value}"`;
    return String(value);
  }

  private shortenPath(path: string): string {
    const parts = path.split('/');
    if (parts.length <= 3) return path;
    return '.../' + parts.slice(-2).join('/');
  }

  // ==================== Event Handling ====================

  private attachEventListeners(_state: InspectorState): void {
    if (!this.container) return;

    // Toggle pick mode
    this.container.querySelectorAll('[data-action="toggle-pick"]').forEach(el => {
      el.addEventListener('click', () => inspectorState.togglePickMode());
    });

    // Close panel
    this.container.querySelectorAll('[data-action="close"]').forEach(el => {
      el.addEventListener('click', () => inspectorState.hide());
    });

    // Tab switching
    this.container.querySelectorAll('[data-action="set-tab"]').forEach(el => {
      el.addEventListener('click', () => {
        const tab = (el as HTMLElement).dataset['tab'] as InspectorTab;
        inspectorState.setActiveTab(tab);
      });
    });

    // Breakpoint switching
    this.container.querySelectorAll('[data-action="set-breakpoint"]').forEach(el => {
      el.addEventListener('click', () => {
        const width = parseInt((el as HTMLElement).dataset['width'] || '0', 10);
        const bp = DEFAULT_BREAKPOINTS.find(b => b.width === width);
        if (bp) inspectorState.setBreakpoint(bp);
      });
    });

    // History selection
    this.container.querySelectorAll('[data-action="select-history"]').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt((el as HTMLElement).dataset['index'] || '0', 10);
        inspectorState.selectFromHistory(index);
      });
    });
  }

  /**
   * Destroy the panel.
   */
  destroy(): void {
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
  }
}
