/**
 * Component detection using framework DevTools hooks.
 * Extracts component names, file paths, and source locations.
 *
 * This module runs in the browser context.
 */

export interface ComponentInfo {
  /** Component name */
  name: string;
  /** Framework that owns this component */
  framework: 'react' | 'vue' | 'svelte' | 'unknown';
  /** Source file path (if available) */
  filePath?: string;
  /** Line number in source file */
  line?: number;
  /** Column number in source file */
  column?: number;
  /** Props passed to the component (if accessible) */
  props?: Record<string, unknown>;
}

/** React DevTools global hook shape */
interface ReactDevToolsHook {
  renderers: Map<number, {
    findFiberByHostInstance?: (instance: Element) => ReactFiber | null;
    getCurrentFiber?: () => ReactFiber | null;
  }>;
  onCommitFiberRoot?: (rendererID: number, root: unknown) => void;
}

/** React Fiber node shape */
interface ReactFiber {
  type: {
    name?: string;
    displayName?: string;
    $$typeof?: symbol;
  } | string | null;
  return: ReactFiber | null;
  memoizedProps?: Record<string, unknown>;
  _debugSource?: {
    fileName: string;
    lineNumber: number;
    columnNumber?: number;
  };
  _debugOwner?: ReactFiber;
}

/** Vue DevTools global hook shape */
interface VueDevToolsHook {
  apps: Map<number, VueApp>;
  getAppRecord?: (app: VueApp) => VueAppRecord | undefined;
}

interface VueApp {
  _instance?: VueComponentInstance;
  config?: { globalProperties?: Record<string, unknown> };
}

interface VueAppRecord {
  componentDetails?: (uid: number) => unknown;
}

interface VueComponentInstance {
  $options?: {
    name?: string;
    _componentTag?: string;
    __file?: string;
  };
  type?: {
    name?: string;
    __file?: string;
  };
  $parent?: VueComponentInstance;
}

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: ReactDevToolsHook;
    __VUE_DEVTOOLS_GLOBAL_HOOK__?: VueDevToolsHook;
  }
}

/**
 * Detect component information for a DOM element.
 */
export function detectComponent(element: Element): ComponentInfo | null {
  // Try React first
  const reactInfo = detectReactComponent(element);
  if (reactInfo) return reactInfo;

  // Try Vue
  const vueInfo = detectVueComponent(element);
  if (vueInfo) return vueInfo;

  // Try Svelte
  const svelteInfo = detectSvelteComponent(element);
  if (svelteInfo) return svelteInfo;

  return null;
}

/**
 * Detect React component from element using DevTools hook or fiber properties.
 */
function detectReactComponent(element: Element): ComponentInfo | null {
  // Method 1: Try DevTools global hook first (most reliable)
  const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook?.renderers) {
    for (const [, renderer] of hook.renderers) {
      if (renderer.findFiberByHostInstance) {
        const fiber = renderer.findFiberByHostInstance(element);
        if (fiber) {
          const info = extractReactFiberInfo(fiber);
          if (info) return info;
        }
      }
    }
  }

  // Method 2: Direct fiber property access (fallback)
  const fiberKey = Object.keys(element).find(
    (key) =>
      key.startsWith('__reactFiber$') ||
      key.startsWith('__reactInternalInstance$')
  );

  if (!fiberKey) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fiber = (element as any)[fiberKey] as ReactFiber | undefined;
  if (!fiber) return null;

  return extractReactFiberInfo(fiber);
}

/**
 * Extract component info from a React fiber.
 */
function extractReactFiberInfo(startFiber: ReactFiber): ComponentInfo | null {
  let fiber: ReactFiber | null = startFiber;

  while (fiber) {
    const type = fiber.type;

    // Skip host components (DOM elements)
    if (typeof type === 'string' || type === null) {
      fiber = fiber.return;
      continue;
    }

    // Found a component
    const name = type.displayName || type.name;
    if (name && typeof name === 'string' && !name.startsWith('_')) {
      const info: ComponentInfo = {
        name,
        framework: 'react',
      };

      // Extract debug source if available (React dev mode)
      const debugSource = fiber._debugSource;
      if (debugSource?.fileName) {
        info.filePath = debugSource.fileName;
        info.line = debugSource.lineNumber;
        if (debugSource.columnNumber != null) {
          info.column = debugSource.columnNumber;
        }
      }

      // Extract props
      if (fiber.memoizedProps) {
        info.props = sanitizeProps(fiber.memoizedProps);
      }

      return info;
    }

    fiber = fiber.return;
  }

  return null;
}

/**
 * Detect Vue component from element.
 */
function detectVueComponent(element: Element): ComponentInfo | null {
  // Method 1: Vue 3 component instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vue3Instance = (element as any).__vueParentComponent as VueComponentInstance | undefined;
  if (vue3Instance) {
    return extractVue3ComponentInfo(vue3Instance);
  }

  // Method 2: Vue 2 instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vue2Instance = (element as any).__vue__ as VueComponentInstance | undefined;
  if (vue2Instance) {
    return extractVue2ComponentInfo(vue2Instance);
  }

  // Method 3: Try DevTools hook
  const hook = window.__VUE_DEVTOOLS_GLOBAL_HOOK__;
  if (hook?.apps) {
    for (const [, app] of hook.apps) {
      const instance = app._instance;
      if (instance) {
        // Try to find component owning this element
        const found = findVueComponentForElement(instance, element);
        if (found) {
          return extractVue3ComponentInfo(found);
        }
      }
    }
  }

  return null;
}

/**
 * Extract component info from Vue 3 instance.
 */
function extractVue3ComponentInfo(instance: VueComponentInstance): ComponentInfo | null {
  const name = instance.type?.name || instance.$options?.name;
  if (!name) return null;

  const info: ComponentInfo = {
    name,
    framework: 'vue',
  };

  // Extract file path from __file property
  const filePath = instance.type?.__file || instance.$options?.__file;
  if (filePath) {
    info.filePath = filePath;
  }

  return info;
}

/**
 * Extract component info from Vue 2 instance.
 */
function extractVue2ComponentInfo(instance: VueComponentInstance): ComponentInfo | null {
  const name = instance.$options?.name || instance.$options?._componentTag;
  if (!name) return null;

  const info: ComponentInfo = {
    name,
    framework: 'vue',
  };

  // Extract file path from __file property
  const filePath = instance.$options?.__file;
  if (filePath) {
    info.filePath = filePath;
  }

  return info;
}

/**
 * Find Vue component instance that owns the given element.
 */
function findVueComponentForElement(
  instance: VueComponentInstance,
  _element: Element
): VueComponentInstance | null {
  // Simple implementation - in practice you'd walk the component tree
  // and match against $el or refs
  if (instance.$options?.name) {
    return instance;
  }
  return null;
}

/**
 * Detect Svelte component from element.
 */
function detectSvelteComponent(element: Element): ComponentInfo | null {
  // Svelte attaches __svelte_component and similar properties
  const svelteKeys = Object.keys(element).filter(k =>
    k.startsWith('__svelte') || k.startsWith('$$')
  );

  if (svelteKeys.length === 0) return null;

  // Try to extract component info
  for (const key of svelteKeys) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (element as any)[key];
    if (value && typeof value === 'object') {
      // Check for component constructor
      const ctor = value.constructor;
      if (ctor && ctor.name && ctor.name !== 'Object') {
        return {
          name: ctor.name,
          framework: 'svelte',
        };
      }
    }
  }

  // Check for Svelte 5's $$ property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svelte5 = (element as any).$$;
  if (svelte5) {
    // Try to get component name from the component's metadata
    const name = svelte5.ctx?.[0]?.constructor?.name;
    if (name && name !== 'Object') {
      return {
        name,
        framework: 'svelte',
      };
    }
  }

  // Fallback: we know it's Svelte but can't get the name
  return {
    name: 'SvelteComponent',
    framework: 'svelte',
  };
}

/**
 * Sanitize props for display (remove functions, circular refs, etc.)
 */
function sanitizeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const maxProps = 10;
  let count = 0;

  for (const [key, value] of Object.entries(props)) {
    if (count >= maxProps) break;

    // Skip children, internal props, and functions
    if (key === 'children' || key.startsWith('_') || typeof value === 'function') {
      continue;
    }

    // Serialize simple values
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = `Array(${value.length})`;
    } else if (typeof value === 'object') {
      result[key] = '{...}';
    }

    count++;
  }

  return result;
}

/**
 * Try to detect component from data attributes (fallback).
 */
export function detectFromDataAttributes(element: Element): ComponentInfo | null {
  // Check for common patterns
  const dataComponent = element.getAttribute('data-component');
  const dataTestId = element.getAttribute('data-testid');
  const dataName = element.getAttribute('data-name');

  const name = dataComponent || extractComponentFromTestId(dataTestId) || dataName;
  if (!name) return null;

  return {
    name,
    framework: 'unknown',
  };
}

/**
 * Extract component name from test ID patterns.
 */
function extractComponentFromTestId(testId: string | null): string | null {
  if (!testId) return null;

  // Common patterns: "Button-submit", "header-nav", "UserProfile"
  const parts = testId.split(/[-_]/);
  const first = parts[0];
  if (first && first.length > 0) {
    const firstChar = first.charAt(0);
    if (firstChar === firstChar.toUpperCase()) {
      return first;
    }
  }

  return null;
}

/**
 * Get all component ancestors for an element.
 */
export function getComponentAncestors(element: Element): ComponentInfo[] {
  const ancestors: ComponentInfo[] = [];
  let current: Element | null = element;

  while (current) {
    const info = detectComponent(current);
    if (info) {
      ancestors.push(info);
    }
    current = current.parentElement;
  }

  return ancestors;
}
