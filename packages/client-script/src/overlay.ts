/**
 * Visual overlay for element measurement display.
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
}

const DEFAULT_OPTIONS: Required<OverlayOptions> = {
  contentColor: 'rgba(111, 168, 220, 0.66)',
  paddingColor: 'rgba(147, 196, 125, 0.55)',
  borderColor: 'rgba(255, 229, 153, 0.66)',
  marginColor: 'rgba(246, 178, 107, 0.66)',
};

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
   * Show overlay for an element.
   */
  show(element: Element): void {
    if (!this.container) {
      this.init();
    }

    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);

    const px = (v: string) => parseFloat(v.replace('px', '')) || 0;

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

    const margin = {
      top: px(styles.marginTop),
      right: px(styles.marginRight),
      bottom: px(styles.marginBottom),
      left: px(styles.marginLeft),
    };

    // Clear previous overlay
    this.clear();

    // Create overlay layers
    this.container!.innerHTML = `
      <!-- Margin -->
      <div style="
        position: absolute;
        left: ${rect.left - margin.left}px;
        top: ${rect.top - margin.top}px;
        width: ${rect.width + margin.left + margin.right}px;
        height: ${rect.height + margin.top + margin.bottom}px;
        background: ${this.options.marginColor};
      "></div>

      <!-- Border + Padding + Content (cutout for margin) -->
      <div style="
        position: absolute;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        background: ${this.options.borderColor};
      "></div>

      <!-- Padding + Content (cutout for border) -->
      <div style="
        position: absolute;
        left: ${rect.left + border.left}px;
        top: ${rect.top + border.top}px;
        width: ${rect.width - border.left - border.right}px;
        height: ${rect.height - border.top - border.bottom}px;
        background: ${this.options.paddingColor};
      "></div>

      <!-- Content (cutout for padding) -->
      <div style="
        position: absolute;
        left: ${rect.left + border.left + padding.left}px;
        top: ${rect.top + border.top + padding.top}px;
        width: ${rect.width - border.left - border.right - padding.left - padding.right}px;
        height: ${rect.height - border.top - border.bottom - padding.top - padding.bottom}px;
        background: ${this.options.contentColor};
      "></div>

      <!-- Dimension labels -->
      <div style="
        position: absolute;
        left: ${rect.left}px;
        top: ${rect.top - 20}px;
        background: #333;
        color: #fff;
        padding: 2px 6px;
        font-size: 11px;
        font-family: monospace;
        border-radius: 3px;
      ">${Math.round(rect.width)} × ${Math.round(rect.height)}</div>
    `;
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
}
