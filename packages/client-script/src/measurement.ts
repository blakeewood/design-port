/**
 * Element measurement utilities for the browser context.
 * Extracts comprehensive design information from DOM elements.
 */

export interface BoxModel {
  content: { width: number; height: number };
  padding: { top: number; right: number; bottom: number; left: number };
  border: { top: number; right: number; bottom: number; left: number };
  margin: { top: number; right: number; bottom: number; left: number };
}

export interface CSSVariableUsage {
  /** CSS property using the variable */
  property: string;
  /** Variable name (e.g., --primary-500) */
  variable: string;
  /** Resolved value */
  resolvedValue: string;
}

export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
}

export interface ElementMeasurement {
  selector: string;
  tagName: string;
  classList: string[];
  id?: string;
  /** Element attributes (data-*, aria-*, etc.) */
  attributes: Record<string, string>;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  boxModel: BoxModel;
  computedStyles: Record<string, string>;
  /** CSS variables used by this element */
  cssVariables: CSSVariableUsage[];
  /** Tailwind classes parsed into tokens */
  tailwindClasses: TailwindClassInfo[];
  componentName?: string;
  /** React/Vue source location if available */
  sourceLocation?: SourceLocation;
  /** Accessibility information */
  accessibility: {
    role?: string;
    label?: string;
    description?: string;
  };
}

export interface TailwindClassInfo {
  /** Original class name */
  className: string;
  /** CSS property it affects */
  property: string;
  /** Variant prefix (hover:, md:, etc.) */
  variant?: string;
  /** Token path (e.g., colors.blue.500) */
  tokenPath?: string;
  /** Whether it's an arbitrary value */
  isArbitrary: boolean;
}

/**
 * CSS properties to extract for design inspection.
 */
const RELEVANT_PROPERTIES = [
  // Typography
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'text-align', 'text-decoration', 'text-transform',
  // Colors
  'color', 'background-color', 'border-color', 'outline-color',
  // Spacing
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  // Dimensions
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  // Border
  'border-width', 'border-style', 'border-radius',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-left-radius', 'border-bottom-right-radius',
  // Layout
  'display', 'position', 'flex-direction', 'justify-content', 'align-items',
  'gap', 'row-gap', 'column-gap', 'grid-template-columns', 'grid-template-rows',
  // Effects
  'opacity', 'box-shadow', 'transform', 'transition',
  // Overflow
  'overflow', 'overflow-x', 'overflow-y',
  // Z-index
  'z-index',
];

/**
 * Tailwind class patterns for parsing.
 */
const TAILWIND_PATTERNS: Array<{
  pattern: RegExp;
  property: string;
  tokenPrefix: string;
}> = [
  // Spacing
  { pattern: /^p-(\[.+\]|\d+(?:\.\d+)?|px)$/, property: 'padding', tokenPrefix: 'spacing' },
  { pattern: /^px-(\[.+\]|\d+(?:\.\d+)?|px)$/, property: 'padding-inline', tokenPrefix: 'spacing' },
  { pattern: /^py-(\[.+\]|\d+(?:\.\d+)?|px)$/, property: 'padding-block', tokenPrefix: 'spacing' },
  { pattern: /^pt-(\[.+\]|\d+(?:\.\d+)?|px)$/, property: 'padding-top', tokenPrefix: 'spacing' },
  { pattern: /^pr-(\[.+\]|\d+(?:\.\d+)?|px)$/, property: 'padding-right', tokenPrefix: 'spacing' },
  { pattern: /^pb-(\[.+\]|\d+(?:\.\d+)?|px)$/, property: 'padding-bottom', tokenPrefix: 'spacing' },
  { pattern: /^pl-(\[.+\]|\d+(?:\.\d+)?|px)$/, property: 'padding-left', tokenPrefix: 'spacing' },
  { pattern: /^m-(\[.+\]|\d+(?:\.\d+)?|px|auto)$/, property: 'margin', tokenPrefix: 'spacing' },
  { pattern: /^mx-(\[.+\]|\d+(?:\.\d+)?|px|auto)$/, property: 'margin-inline', tokenPrefix: 'spacing' },
  { pattern: /^my-(\[.+\]|\d+(?:\.\d+)?|px|auto)$/, property: 'margin-block', tokenPrefix: 'spacing' },
  { pattern: /^mt-(\[.+\]|\d+(?:\.\d+)?|px|auto)$/, property: 'margin-top', tokenPrefix: 'spacing' },
  { pattern: /^mr-(\[.+\]|\d+(?:\.\d+)?|px|auto)$/, property: 'margin-right', tokenPrefix: 'spacing' },
  { pattern: /^mb-(\[.+\]|\d+(?:\.\d+)?|px|auto)$/, property: 'margin-bottom', tokenPrefix: 'spacing' },
  { pattern: /^ml-(\[.+\]|\d+(?:\.\d+)?|px|auto)$/, property: 'margin-left', tokenPrefix: 'spacing' },
  { pattern: /^gap-(\[.+\]|\d+(?:\.\d+)?|px)$/, property: 'gap', tokenPrefix: 'spacing' },
  { pattern: /^space-x-(\[.+\]|\d+(?:\.\d+)?|px)$/, property: 'column-gap', tokenPrefix: 'spacing' },
  { pattern: /^space-y-(\[.+\]|\d+(?:\.\d+)?|px)$/, property: 'row-gap', tokenPrefix: 'spacing' },
  // Sizing
  { pattern: /^w-(\[.+\]|\d+(?:\/\d+)?|full|screen|auto|min|max|fit)$/, property: 'width', tokenPrefix: 'spacing' },
  { pattern: /^h-(\[.+\]|\d+(?:\/\d+)?|full|screen|auto|min|max|fit)$/, property: 'height', tokenPrefix: 'spacing' },
  { pattern: /^min-w-(\[.+\]|\d+|full|min|max|fit)$/, property: 'min-width', tokenPrefix: 'spacing' },
  { pattern: /^min-h-(\[.+\]|\d+|full|screen|min|max|fit)$/, property: 'min-height', tokenPrefix: 'spacing' },
  { pattern: /^max-w-(\[.+\]|\d+|full|screen|none|xs|sm|md|lg|xl|.+)$/, property: 'max-width', tokenPrefix: 'maxWidth' },
  { pattern: /^max-h-(\[.+\]|\d+|full|screen|none)$/, property: 'max-height', tokenPrefix: 'spacing' },
  // Colors
  { pattern: /^bg-(\[.+\]|[a-z]+-\d+|[a-z]+|transparent|current)$/, property: 'background-color', tokenPrefix: 'colors' },
  { pattern: /^text-(\[.+\]|[a-z]+-\d+|[a-z]+|transparent|current)$/, property: 'color', tokenPrefix: 'colors' },
  { pattern: /^border-(\[.+\]|[a-z]+-\d+|[a-z]+|transparent|current)$/, property: 'border-color', tokenPrefix: 'colors' },
  // Typography
  { pattern: /^text-(xs|sm|base|lg|xl|\d+xl)$/, property: 'font-size', tokenPrefix: 'fontSize' },
  { pattern: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\d+)$/, property: 'font-weight', tokenPrefix: 'fontWeight' },
  { pattern: /^font-(sans|serif|mono)$/, property: 'font-family', tokenPrefix: 'fontFamily' },
  { pattern: /^leading-(\[.+\]|\d+|none|tight|snug|normal|relaxed|loose)$/, property: 'line-height', tokenPrefix: 'lineHeight' },
  { pattern: /^tracking-(\[.+\]|tighter|tight|normal|wide|wider|widest)$/, property: 'letter-spacing', tokenPrefix: 'letterSpacing' },
  // Border
  { pattern: /^rounded(-[a-z]+)?(-\[.+\]|-none|-sm|-md|-lg|-xl|-2xl|-3xl|-full)?$/, property: 'border-radius', tokenPrefix: 'borderRadius' },
  { pattern: /^border(-\d+)?$/, property: 'border-width', tokenPrefix: 'borderWidth' },
  // Layout
  { pattern: /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden)$/, property: 'display', tokenPrefix: 'display' },
  { pattern: /^(static|fixed|absolute|relative|sticky)$/, property: 'position', tokenPrefix: 'position' },
  { pattern: /^(flex-row|flex-row-reverse|flex-col|flex-col-reverse)$/, property: 'flex-direction', tokenPrefix: 'flexDirection' },
  { pattern: /^justify-(start|end|center|between|around|evenly)$/, property: 'justify-content', tokenPrefix: 'justifyContent' },
  { pattern: /^items-(start|end|center|baseline|stretch)$/, property: 'align-items', tokenPrefix: 'alignItems' },
  // Effects
  { pattern: /^opacity-(\[.+\]|\d+)$/, property: 'opacity', tokenPrefix: 'opacity' },
  { pattern: /^shadow(-\[.+\]|-sm|-md|-lg|-xl|-2xl|-inner|-none)?$/, property: 'box-shadow', tokenPrefix: 'boxShadow' },
  // Z-index
  { pattern: /^z-(\[.+\]|\d+|auto)$/, property: 'z-index', tokenPrefix: 'zIndex' },
];

/**
 * Measure an element and extract all relevant design data.
 */
export function measureElement(element: Element): ElementMeasurement {
  const styles = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const classList = Array.from(element.classList);

  const result: ElementMeasurement = {
    selector: generateSelector(element),
    tagName: element.tagName.toLowerCase(),
    classList,
    attributes: extractAttributes(element),
    bounds: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    boxModel: extractBoxModel(styles),
    computedStyles: extractStyles(styles),
    cssVariables: extractCSSVariables(element),
    tailwindClasses: parseTailwindClasses(classList),
    accessibility: extractAccessibility(element),
  };

  // Add optional properties conditionally
  if (element.id) {
    result.id = element.id;
  }
  const componentName = getComponentName(element);
  if (componentName) {
    result.componentName = componentName;
  }
  const sourceLocation = getSourceLocation(element);
  if (sourceLocation) {
    result.sourceLocation = sourceLocation;
  }

  return result;
}

function generateSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift(`#${current.id}`);
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

function extractAttributes(element: Element): Record<string, string> {
  const result: Record<string, string> = {};
  const attrs = element.attributes;

  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr && (
      attr.name.startsWith('data-') ||
      attr.name.startsWith('aria-') ||
      attr.name === 'role' ||
      attr.name === 'title' ||
      attr.name === 'alt'
    )) {
      result[attr.name] = attr.value;
    }
  }

  return result;
}

function extractBoxModel(styles: CSSStyleDeclaration): BoxModel {
  const px = (v: string) => parseFloat(v.replace('px', '')) || 0;

  return {
    content: {
      width: px(styles.width),
      height: px(styles.height),
    },
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

function extractStyles(styles: CSSStyleDeclaration): Record<string, string> {
  const result: Record<string, string> = {};
  for (const prop of RELEVANT_PROPERTIES) {
    const value = styles.getPropertyValue(prop);
    if (value && value !== 'none' && value !== 'normal' && value !== 'auto') {
      result[prop] = value;
    }
  }
  return result;
}

function extractCSSVariables(element: Element): CSSVariableUsage[] {
  const variables: CSSVariableUsage[] = [];

  try {
    for (const sheet of document.styleSheets) {
      try {
        const rules = sheet.cssRules;
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          if (rule instanceof CSSStyleRule && element.matches(rule.selectorText)) {
            const style = rule.style;
            for (let j = 0; j < style.length; j++) {
              const prop = style[j];
              if (prop) {
                const value = style.getPropertyValue(prop);
                // Find CSS variable references
                const varMatches = value.matchAll(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g);
                for (const match of varMatches) {
                  const varName = match[1];
                  if (varName) {
                    const resolvedValue = getComputedStyle(document.documentElement)
                      .getPropertyValue(varName)
                      .trim();
                    variables.push({
                      property: prop,
                      variable: varName,
                      resolvedValue: resolvedValue || match[2] || 'unset',
                    });
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

  return variables;
}

function parseTailwindClasses(classList: string[]): TailwindClassInfo[] {
  const results: TailwindClassInfo[] = [];

  for (const className of classList) {
    // Handle variants (hover:, md:, dark:, etc.)
    let variant: string | undefined;
    let baseClass = className;

    if (className.includes(':')) {
      const parts = className.split(':');
      variant = parts.slice(0, -1).join(':');
      baseClass = parts[parts.length - 1] || className;
    }

    // Check if it's an arbitrary value
    const isArbitrary = baseClass.includes('[') && baseClass.includes(']');

    // Try to match against known patterns
    let matched = false;
    for (const { pattern, property, tokenPrefix } of TAILWIND_PATTERNS) {
      const match = baseClass.match(pattern);
      if (match) {
        const tokenValue = match[1] || match[2] || baseClass;
        const info: TailwindClassInfo = {
          className,
          property,
          isArbitrary,
        };
        if (variant) {
          info.variant = variant;
        }
        if (!isArbitrary) {
          info.tokenPath = `${tokenPrefix}.${tokenValue}`;
        }
        results.push(info);
        matched = true;
        break;
      }
    }

    // If no pattern matched but looks like a Tailwind class, still include it
    if (!matched && (baseClass.includes('-') || ['flex', 'grid', 'block', 'hidden', 'relative', 'absolute'].includes(baseClass))) {
      const info: TailwindClassInfo = {
        className,
        property: 'unknown',
        isArbitrary,
      };
      if (variant) {
        info.variant = variant;
      }
      results.push(info);
    }
  }

  return results;
}

function getComponentName(element: Element): string | undefined {
  // Try React (multiple fiber key formats for different React versions)
  const reactKeys = Object.keys(element).filter(
    (k) => k.startsWith('__reactFiber$') ||
           k.startsWith('__reactInternalInstance$') ||
           k.startsWith('__reactProps$')
  );

  for (const key of reactKeys) {
    if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
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

  // Try Svelte (check for $$)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svelteKeys = Object.keys(element).filter(k => k.startsWith('__svelte'));
  if (svelteKeys.length > 0) {
    // Svelte doesn't expose component names easily, return generic marker
    return 'SvelteComponent';
  }

  return undefined;
}

function getSourceLocation(element: Element): SourceLocation | undefined {
  // Try React _debugSource (available in development builds)
  const fiberKey = Object.keys(element).find(
    (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
  );

  if (fiberKey) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fiber = (element as any)[fiberKey];
    while (fiber) {
      const source = fiber._debugSource;
      if (source?.fileName) {
        const result: SourceLocation = {
          file: source.fileName,
          line: source.lineNumber || 1,
        };
        if (source.columnNumber != null) {
          result.column = source.columnNumber;
        }
        return result;
      }
      fiber = fiber.return;
    }
  }

  // Check for data-source attribute (some dev tools add this)
  const sourceAttr = element.getAttribute('data-source');
  if (sourceAttr) {
    const [file, line, column] = sourceAttr.split(':');
    if (file) {
      const result: SourceLocation = {
        file,
        line: parseInt(line || '1', 10),
      };
      if (column) {
        result.column = parseInt(column, 10);
      }
      return result;
    }
  }

  return undefined;
}

function extractAccessibility(element: Element): ElementMeasurement['accessibility'] {
  const result: ElementMeasurement['accessibility'] = {};

  const role = element.getAttribute('role') || getImplicitRole(element);
  if (role) {
    result.role = role;
  }

  const label = element.getAttribute('aria-label') ||
                element.getAttribute('aria-labelledby') ||
                (element as HTMLElement).title;
  if (label) {
    result.label = label;
  }

  const description = element.getAttribute('aria-description') ||
                      element.getAttribute('aria-describedby');
  if (description) {
    result.description = description;
  }

  return result;
}

function getImplicitRole(element: Element): string | undefined {
  const tag = element.tagName.toLowerCase();
  const roleMap: Record<string, string> = {
    'a': 'link',
    'button': 'button',
    'h1': 'heading',
    'h2': 'heading',
    'h3': 'heading',
    'h4': 'heading',
    'h5': 'heading',
    'h6': 'heading',
    'img': 'img',
    'input': 'textbox',
    'nav': 'navigation',
    'main': 'main',
    'header': 'banner',
    'footer': 'contentinfo',
    'aside': 'complementary',
    'section': 'region',
    'article': 'article',
    'form': 'form',
    'ul': 'list',
    'ol': 'list',
    'li': 'listitem',
    'table': 'table',
    'tr': 'row',
    'td': 'cell',
    'th': 'columnheader',
  };
  return roleMap[tag];
}
