/**
 * Visual overlay for element measurement display.
 * Provides comprehensive box model visualization with rulers and measurements.
 */

export interface OverlayOptions {
  /** Color for content box */
  contentColor?: string;
  /** Color for padding */
  paddingColor?: string;
  /** Color for border */
  borderColor?: string;
  /** Color for margin */
  marginColor?: string;
  /** Show spacing value labels */
  showSpacingLabels?: boolean;
  /** Show guide lines to edges */
  showGuideLines?: boolean;
  /** Show component name if available */
  showComponentName?: boolean;
}

const DEFAULT_OPTIONS: Required<OverlayOptions> = {
  contentColor: 'rgba(111, 168, 220, 0.66)',
  paddingColor: 'rgba(147, 196, 125, 0.55)',
  borderColor: 'rgba(255, 229, 153, 0.66)',
  marginColor: 'rgba(246, 178, 107, 0.66)',
  showSpacingLabels: true,
  showGuideLines: true,
  showComponentName: true,
};

interface BoxModelMeasurements {
  rect: DOMRect;
  padding: { top: number; right: number; bottom: number; left: number };
  border: { top: number; right: number; bottom: number; left: number };
  margin: { top: number; right: number; bottom: number; left: number };
}

export class MeasurementOverlay {
  private container: HTMLDivElement | null = null;
  private options: Required<OverlayOptions>;

  constructor(options: OverlayOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Initialize the overlay container.
   */
  init(): void {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'design-port-overlay';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483647;
    `;
    document.body.appendChild(this.container);
  }

  /**
   * Show overlay for an element with optional component name.
   */
  show(element: Element, componentName?: string): void {
    if (!this.container) {
      this.init();
    }

    const measurements = this.getMeasurements(element);

    // Clear previous overlay
    this.clear();

    // Build overlay HTML
    let html = '';

    // Guide lines
    if (this.options.showGuideLines) {
      html += this.renderGuideLines(measurements.rect);
    }

    // Box model layers
    html += this.renderBoxModel(measurements);

    // Spacing labels
    if (this.options.showSpacingLabels) {
      html += this.renderSpacingLabels(measurements);
    }

    // Dimension label
    html += this.renderDimensionLabel(measurements.rect, componentName);

    this.container!.innerHTML = html;
  }

  /**
   * Clear the overlay.
   */
  clear(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  /**
   * Remove the overlay from DOM.
   */
  destroy(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  private getMeasurements(element: Element): BoxModelMeasurements {
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const px = (v: string) => parseFloat(v.replace('px', '')) || 0;

    return {
      rect,
      padding: {
        top: px(styles.paddingTop),
        right: px(styles.paddingRight),
        bottom: px(styles.paddingBottom),
        left: px(styles.paddingLeft),
      },
      border: {
        top: px(styles.borderTopWidth),
        right: px(styles.borderRightWidth),
        bottom: px(styles.borderBottomWidth),
        left: px(styles.borderLeftWidth),
      },
      margin: {
        top: px(styles.marginTop),
        right: px(styles.marginRight),
        bottom: px(styles.marginBottom),
        left: px(styles.marginLeft),
      },
    };
  }

  private renderGuideLines(rect: DOMRect): string {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    return `
      <!-- Horizontal guide line -->
      <div style="
        position: absolute;
        left: 0;
        top: ${centerY}px;
        width: 100%;
        height: 1px;
        background: rgba(255, 0, 128, 0.3);
        border-top: 1px dashed rgba(255, 0, 128, 0.5);
      "></div>

      <!-- Vertical guide line -->
      <div style="
        position: absolute;
        left: ${centerX}px;
        top: 0;
        width: 1px;
        height: 100%;
        background: rgba(255, 0, 128, 0.3);
        border-left: 1px dashed rgba(255, 0, 128, 0.5);
      "></div>

      <!-- Distance to left edge -->
      <div style="
        position: absolute;
        left: 0;
        top: ${centerY - 10}px;
        width: ${rect.left}px;
        height: 1px;
        background: rgba(59, 130, 246, 0.5);
      "></div>
      <div style="
        position: absolute;
        left: ${rect.left / 2 - 15}px;
        top: ${centerY - 22}px;
        background: rgba(59, 130, 246, 0.9);
        color: #fff;
        padding: 1px 4px;
        font-size: 10px;
        font-family: monospace;
        border-radius: 2px;
      ">${Math.round(rect.left)}</div>

      <!-- Distance to top edge -->
      <div style="
        position: absolute;
        left: ${centerX - 1}px;
        top: 0;
        width: 1px;
        height: ${rect.top}px;
        background: rgba(59, 130, 246, 0.5);
      "></div>
      <div style="
        position: absolute;
        left: ${centerX + 4}px;
        top: ${rect.top / 2 - 7}px;
        background: rgba(59, 130, 246, 0.9);
        color: #fff;
        padding: 1px 4px;
        font-size: 10px;
        font-family: monospace;
        border-radius: 2px;
      ">${Math.round(rect.top)}</div>

      <!-- Distance to right edge -->
      <div style="
        position: absolute;
        left: ${rect.right}px;
        top: ${centerY - 10}px;
        width: ${viewportWidth - rect.right}px;
        height: 1px;
        background: rgba(59, 130, 246, 0.5);
      "></div>
      <div style="
        position: absolute;
        left: ${rect.right + (viewportWidth - rect.right) / 2 - 15}px;
        top: ${centerY - 22}px;
        background: rgba(59, 130, 246, 0.9);
        color: #fff;
        padding: 1px 4px;
        font-size: 10px;
        font-family: monospace;
        border-radius: 2px;
      ">${Math.round(viewportWidth - rect.right)}</div>

      <!-- Distance to bottom edge -->
      <div style="
        position: absolute;
        left: ${centerX - 1}px;
        top: ${rect.bottom}px;
        width: 1px;
        height: ${viewportHeight - rect.bottom}px;
        background: rgba(59, 130, 246, 0.5);
      "></div>
      <div style="
        position: absolute;
        left: ${centerX + 4}px;
        top: ${rect.bottom + (viewportHeight - rect.bottom) / 2 - 7}px;
        background: rgba(59, 130, 246, 0.9);
        color: #fff;
        padding: 1px 4px;
        font-size: 10px;
        font-family: monospace;
        border-radius: 2px;
      ">${Math.round(viewportHeight - rect.bottom)}</div>
    `;
  }

  private renderBoxModel(m: BoxModelMeasurements): string {
    const { rect, padding, border, margin } = m;

    return `
      <!-- Margin layer -->
      <div style="
        position: absolute;
        left: ${rect.left - margin.left}px;
        top: ${rect.top - margin.top}px;
        width: ${rect.width + margin.left + margin.right}px;
        height: ${rect.height + margin.top + margin.bottom}px;
        background: ${this.options.marginColor};
      "></div>

      <!-- Border layer (cutout for margin) -->
      <div style="
        position: absolute;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background: ${this.options.borderColor};
      "></div>

      <!-- Padding layer (cutout for border) -->
      <div style="
        position: absolute;
        left: ${rect.left + border.left}px;
        top: ${rect.top + border.top}px;
        width: ${rect.width - border.left - border.right}px;
        height: ${rect.height - border.top - border.bottom}px;
        background: ${this.options.paddingColor};
      "></div>

      <!-- Content layer (cutout for padding) -->
      <div style="
        position: absolute;
        left: ${rect.left + border.left + padding.left}px;
        top: ${rect.top + border.top + padding.top}px;
        width: ${rect.width - border.left - border.right - padding.left - padding.right}px;
        height: ${rect.height - border.top - border.bottom - padding.top - padding.bottom}px;
        background: ${this.options.contentColor};
      "></div>
    `;
  }

  private renderSpacingLabels(m: BoxModelMeasurements): string {
    const { rect, padding, border, margin } = m;
    let html = '';

    const labelStyle = `
      position: absolute;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      padding: 1px 3px;
      font-size: 9px;
      font-family: monospace;
      border-radius: 2px;
      white-space: nowrap;
    `;

    // Padding labels (only show if > 0)
    if (padding.top > 4) {
      html += `<div style="${labelStyle} left: ${rect.left + rect.width / 2 - 10}px; top: ${rect.top + border.top + padding.top / 2 - 6}px;">p:${Math.round(padding.top)}</div>`;
    }
    if (padding.bottom > 4) {
      html += `<div style="${labelStyle} left: ${rect.left + rect.width / 2 - 10}px; top: ${rect.bottom - border.bottom - padding.bottom / 2 - 6}px;">p:${Math.round(padding.bottom)}</div>`;
    }
    if (padding.left > 8) {
      html += `<div style="${labelStyle} left: ${rect.left + border.left + padding.left / 2 - 12}px; top: ${rect.top + rect.height / 2 - 6}px;">p:${Math.round(padding.left)}</div>`;
    }
    if (padding.right > 8) {
      html += `<div style="${labelStyle} left: ${rect.right - border.right - padding.right / 2 - 12}px; top: ${rect.top + rect.height / 2 - 6}px;">p:${Math.round(padding.right)}</div>`;
    }

    // Margin labels (only show if > 0)
    if (margin.top > 4) {
      html += `<div style="${labelStyle} left: ${rect.left + rect.width / 2 - 10}px; top: ${rect.top - margin.top / 2 - 6}px; color: #fbbf24;">m:${Math.round(margin.top)}</div>`;
    }
    if (margin.bottom > 4) {
      html += `<div style="${labelStyle} left: ${rect.left + rect.width / 2 - 10}px; top: ${rect.bottom + margin.bottom / 2 - 6}px; color: #fbbf24;">m:${Math.round(margin.bottom)}</div>`;
    }
    if (margin.left > 8) {
      html += `<div style="${labelStyle} left: ${rect.left - margin.left / 2 - 12}px; top: ${rect.top + rect.height / 2 - 6}px; color: #fbbf24;">m:${Math.round(margin.left)}</div>`;
    }
    if (margin.right > 8) {
      html += `<div style="${labelStyle} left: ${rect.right + margin.right / 2 - 12}px; top: ${rect.top + rect.height / 2 - 6}px; color: #fbbf24;">m:${Math.round(margin.right)}</div>`;
    }

    return html;
  }

  private renderDimensionLabel(rect: DOMRect, componentName?: string): string {
    const labelTop = rect.top > 28 ? rect.top - 24 : rect.bottom + 4;
    const showComponent = this.options.showComponentName && componentName;

    return `
      <div style="
        position: absolute;
        left: ${rect.left}px;
        top: ${labelTop}px;
        display: flex;
        gap: 6px;
        align-items: center;
      ">
        <!-- Dimensions -->
        <div style="
          background: #1f2937;
          color: #fff;
          padding: 3px 8px;
          font-size: 11px;
          font-family: monospace;
          border-radius: 3px;
          font-weight: 500;
        ">${Math.round(rect.width)} × ${Math.round(rect.height)}</div>

        ${showComponent ? `
        <!-- Component name -->
        <div style="
          background: #7c3aed;
          color: #fff;
          padding: 3px 8px;
          font-size: 11px;
          font-family: monospace;
          border-radius: 3px;
        ">&lt;${componentName}&gt;</div>
        ` : ''}
      </div>
    `;
  }
}
