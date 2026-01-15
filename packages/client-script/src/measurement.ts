/**
 * Element measurement utilities for the browser context.
 */

export interface BoxModel {
  content: { width: number; height: number };
  padding: { top: number; right: number; bottom: number; left: number };
  border: { top: number; right: number; bottom: number; left: number };
  margin: { top: number; right: number; bottom: number; left: number };
}

export interface ElementMeasurement {
  selector: string;
  tagName: string;
  classList: string[];
  id?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  boxModel: BoxModel;
  computedStyles: Record<string, string>;
  componentName?: string;
}

/**
 * Relevant CSS properties to extract.
 */
const RELEVANT_PROPERTIES = [
  'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
  'color', 'background-color', 'border-color', 'border-width', 'border-radius',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'width', 'height', 'display', 'flex-direction', 'gap',
];

/**
 * Measure an element and extract all relevant data.
 */
export function measureElement(element: Element): ElementMeasurement {
  const styles = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  return {
    selector: generateSelector(element),
    tagName: element.tagName.toLowerCase(),
    classList: Array.from(element.classList),
    id: element.id || undefined,
    bounds: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    boxModel: extractBoxModel(styles),
    computedStyles: extractStyles(styles),
    componentName: getComponentName(element),
  };
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

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === current!.tagName
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
    if (value) {
      result[prop] = value;
    }
  }
  return result;
}

function getComponentName(element: Element): string | undefined {
  // Try React
  const fiberKey = Object.keys(element).find(
    (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
  );

  if (fiberKey) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fiber = (element as any)[fiberKey];
    while (fiber) {
      const name = fiber.type?.displayName || fiber.type?.name;
      if (name && typeof name === 'string') {
        return name;
      }
      fiber = fiber.return;
    }
  }

  // Try Vue
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vue = (element as any).__vue__;
  if (vue) {
    return vue.$options?.name || vue.$options?._componentTag;
  }

  return undefined;
}
