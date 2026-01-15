/**
 * Style extraction and CSS variable detection.
 */

export interface ExtractedStyles {
  /** Raw computed styles */
  computed: Record<string, string>;
  /** CSS custom properties used */
  cssVariables: Map<string, string>;
  /** Grouped by category */
  grouped: {
    typography: Record<string, string>;
    spacing: Record<string, string>;
    colors: Record<string, string>;
    layout: Record<string, string>;
    borders: Record<string, string>;
  };
}

export class StyleExtractor {
  /**
   * Extract all relevant styles from an element.
   * Note: This runs in the browser context.
   */
  static extract(element: Element): ExtractedStyles {
    const styles = window.getComputedStyle(element);
    const computed: Record<string, string> = {};
    const cssVariables = new Map<string, string>();

    // Extract computed styles
    for (let i = 0; i < styles.length; i++) {
      const prop = styles[i];
      if (prop) {
        computed[prop] = styles.getPropertyValue(prop);
      }
    }

    // Find CSS variables used in stylesheets for this element
    StyleExtractor.findCSSVariables(element, cssVariables);

    // Group styles by category
    const grouped = StyleExtractor.groupStyles(computed);

    return { computed, cssVariables, grouped };
  }

  /**
   * Find CSS custom properties applied to an element.
   */
  private static findCSSVariables(
    element: Element,
    variables: Map<string, string>
  ): void {
    try {
      for (const sheet of document.styleSheets) {
        try {
          const rules = sheet.cssRules;
          for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (
              rule instanceof CSSStyleRule &&
              element.matches(rule.selectorText)
            ) {
              const style = rule.style;
              for (let j = 0; j < style.length; j++) {
                const prop = style[j];
                if (prop) {
                  const value = style.getPropertyValue(prop);
                  // Check if value uses CSS variables
                  const matches = value.matchAll(/var\((--[\w-]+)\)/g);
                  for (const match of matches) {
                    const varName = match[1];
                    if (varName) {
                      const resolved = getComputedStyle(
                        document.documentElement
                      ).getPropertyValue(varName);
                      variables.set(varName, resolved.trim());
                    }
                  }
                }
              }
            }
          }
        } catch {
          // CORS restriction on external stylesheets
        }
      }
    } catch {
      // Failed to access stylesheets
    }
  }

  /**
   * Group computed styles by category.
   */
  private static groupStyles(computed: Record<string, string>): ExtractedStyles['grouped'] {
    return {
      typography: {
        'font-family': computed['font-family'] ?? '',
        'font-size': computed['font-size'] ?? '',
        'font-weight': computed['font-weight'] ?? '',
        'line-height': computed['line-height'] ?? '',
        'letter-spacing': computed['letter-spacing'] ?? '',
        'text-align': computed['text-align'] ?? '',
        color: computed['color'] ?? '',
      },
      spacing: {
        'padding-top': computed['padding-top'] ?? '',
        'padding-right': computed['padding-right'] ?? '',
        'padding-bottom': computed['padding-bottom'] ?? '',
        'padding-left': computed['padding-left'] ?? '',
        'margin-top': computed['margin-top'] ?? '',
        'margin-right': computed['margin-right'] ?? '',
        'margin-bottom': computed['margin-bottom'] ?? '',
        'margin-left': computed['margin-left'] ?? '',
        gap: computed['gap'] ?? '',
      },
      colors: {
        color: computed['color'] ?? '',
        'background-color': computed['background-color'] ?? '',
        'border-color': computed['border-color'] ?? '',
      },
      layout: {
        display: computed['display'] ?? '',
        'flex-direction': computed['flex-direction'] ?? '',
        'justify-content': computed['justify-content'] ?? '',
        'align-items': computed['align-items'] ?? '',
        width: computed['width'] ?? '',
        height: computed['height'] ?? '',
      },
      borders: {
        'border-width': computed['border-width'] ?? '',
        'border-style': computed['border-style'] ?? '',
        'border-color': computed['border-color'] ?? '',
        'border-radius': computed['border-radius'] ?? '',
      },
    };
  }
}
