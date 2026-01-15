/**
 * DOM inspection utilities.
 */

export interface BoxModel {
  content: { width: number; height: number };
  padding: { top: number; right: number; bottom: number; left: number };
  border: { top: number; right: number; bottom: number; left: number };
  margin: { top: number; right: number; bottom: number; left: number };
}

export interface InspectionResult {
  selector: string;
  tagName: string;
  classList: string[];
  id?: string;
  bounds: DOMRect;
  boxModel: BoxModel;
  computedStyles: Record<string, string>;
  componentName?: string;
}

/**
 * Relevant CSS properties to extract for design inspection.
 */
export const RELEVANT_STYLE_PROPERTIES = [
  // Typography
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-align',
  'color',
  // Spacing
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  // Dimensions
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  // Background
  'background-color',
  'background-image',
  // Border
  'border-width',
  'border-style',
  'border-color',
  'border-radius',
  // Layout
  'display',
  'flex-direction',
  'justify-content',
  'align-items',
  'gap',
  // Positioning
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
] as const;

export class DOMInspector {
  /**
   * Generate a unique CSS selector for an element.
   * Note: This runs in the browser context.
   */
  static generateSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }

    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector = `#${current.id}`;
        parts.unshift(selector);
        break;
      }

      const parent: Element | null = current.parentElement;
      if (parent) {
        const currentTagName = current.tagName;
        const siblings = Array.from(parent.children).filter(
          (child: Element) => child.tagName === currentTagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      parts.unshift(selector);
      current = parent;
    }

    return parts.join(' > ');
  }

  /**
   * Extract box model from computed styles.
   */
  static extractBoxModel(styles: CSSStyleDeclaration): BoxModel {
    const parsePixels = (value: string): number =>
      parseFloat(value.replace('px', '')) || 0;

    return {
      content: {
        width: parsePixels(styles.width),
        height: parsePixels(styles.height),
      },
      padding: {
        top: parsePixels(styles.paddingTop),
        right: parsePixels(styles.paddingRight),
        bottom: parsePixels(styles.paddingBottom),
        left: parsePixels(styles.paddingLeft),
      },
      border: {
        top: parsePixels(styles.borderTopWidth),
        right: parsePixels(styles.borderRightWidth),
        bottom: parsePixels(styles.borderBottomWidth),
        left: parsePixels(styles.borderLeftWidth),
      },
      margin: {
        top: parsePixels(styles.marginTop),
        right: parsePixels(styles.marginRight),
        bottom: parsePixels(styles.marginBottom),
        left: parsePixels(styles.marginLeft),
      },
    };
  }

  /**
   * Extract relevant computed styles.
   */
  static extractRelevantStyles(
    styles: CSSStyleDeclaration
  ): Record<string, string> {
    const result: Record<string, string> = {};

    for (const prop of RELEVANT_STYLE_PROPERTIES) {
      const value = styles.getPropertyValue(prop);
      if (value) {
        result[prop] = value;
      }
    }

    return result;
  }
}
