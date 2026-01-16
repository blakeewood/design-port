/**
 * State management for the visual inspector overlay.
 * Implements a simple state machine for the Figma-like inspection experience.
 */

import type { ElementMeasurement } from './measurement.js';

export type OverlayState = 'hidden' | 'observing' | 'picking' | 'locked';

export type InspectorTab = 'styles' | 'layout' | 'tokens' | 'classes' | 'computed';

export interface Breakpoint {
  name: string;
  width: number;
  icon: string;
}

export const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { name: 'Mobile', width: 375, icon: '📱' },
  { name: 'Tablet', width: 768, icon: '📱' },
  { name: 'Desktop', width: 1280, icon: '🖥️' },
];

export interface ComponentVariant {
  name: string;
  type: string;
  currentValue: unknown;
  possibleValues?: string[];
  defaultValue?: unknown;
}

export interface ComponentContext {
  name: string;
  filePath?: string;
  lineNumber?: number;
  props: ComponentVariant[];
  isReusable: boolean;
}

export interface ResponsiveValue {
  property: string;
  values: Map<number, string>; // breakpoint width -> value
  isConsistent: boolean;
}

export interface InspectorState {
  overlayState: OverlayState;
  selectedElement: Element | null;
  hoveredElement: Element | null;
  measurement: ElementMeasurement | null;
  activeTab: InspectorTab;
  panelPosition: 'right' | 'bottom' | 'floating';
  panelVisible: boolean;
  currentBreakpoint: Breakpoint;
  responsiveValues: ResponsiveValue[];
  componentContext: ComponentContext | null;
  selectionHistory: Array<{ element: Element; measurement: ElementMeasurement }>;
}

type StateListener = (state: InspectorState) => void;

/**
 * Global inspector state manager.
 * Provides reactive state updates for all overlay components.
 */
export class InspectorStateManager {
  private state: InspectorState;
  private listeners: Set<StateListener> = new Set();

  constructor() {
    this.state = this.getInitialState();
  }

  private getInitialState(): InspectorState {
    return {
      overlayState: 'hidden',
      selectedElement: null,
      hoveredElement: null,
      measurement: null,
      activeTab: 'styles',
      panelPosition: 'right',
      panelVisible: false,
      currentBreakpoint: DEFAULT_BREAKPOINTS[2]!, // Desktop
      responsiveValues: [],
      componentContext: null,
      selectionHistory: [],
    };
  }

  /**
   * Get current state.
   */
  getState(): Readonly<InspectorState> {
    return this.state;
  }

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Update state and notify listeners.
   */
  private setState(updates: Partial<InspectorState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  // ==================== State Actions ====================

  /**
   * Enter pick mode (Ctrl+Shift+P).
   */
  enterPickMode(): void {
    this.setState({
      overlayState: 'picking',
      panelVisible: true,
    });
  }

  /**
   * Exit pick mode.
   */
  exitPickMode(): void {
    this.setState({
      overlayState: 'observing',
      hoveredElement: null,
    });
  }

  /**
   * Toggle pick mode.
   */
  togglePickMode(): void {
    if (this.state.overlayState === 'picking') {
      this.exitPickMode();
    } else {
      this.enterPickMode();
    }
  }

  /**
   * Set hovered element during pick mode.
   */
  setHoveredElement(element: Element | null): void {
    if (this.state.overlayState !== 'picking') return;
    this.setState({ hoveredElement: element });
  }

  /**
   * Select an element (lock selection).
   */
  selectElement(element: Element, measurement: ElementMeasurement): void {
    // Add to history
    const history = [...this.state.selectionHistory];
    history.unshift({ element, measurement });
    // Keep last 10 selections
    if (history.length > 10) {
      history.pop();
    }

    this.setState({
      overlayState: 'locked',
      selectedElement: element,
      measurement,
      selectionHistory: history,
      panelVisible: true,
    });

    // Extract component context
    this.extractComponentContext(element);
  }

  /**
   * Deselect current element (ESC).
   */
  deselectElement(): void {
    this.setState({
      overlayState: this.state.panelVisible ? 'observing' : 'hidden',
      selectedElement: null,
      measurement: null,
      componentContext: null,
    });
  }

  /**
   * Hide the inspector completely.
   */
  hide(): void {
    this.setState({
      overlayState: 'hidden',
      selectedElement: null,
      hoveredElement: null,
      measurement: null,
      panelVisible: false,
      componentContext: null,
    });
  }

  /**
   * Show the inspector (observing mode).
   */
  show(): void {
    this.setState({
      overlayState: 'observing',
      panelVisible: true,
    });
  }

  /**
   * Switch active tab.
   */
  setActiveTab(tab: InspectorTab): void {
    this.setState({ activeTab: tab });
  }

  /**
   * Toggle panel visibility.
   */
  togglePanel(): void {
    this.setState({ panelVisible: !this.state.panelVisible });
  }

  /**
   * Set panel position.
   */
  setPanelPosition(position: 'right' | 'bottom' | 'floating'): void {
    this.setState({ panelPosition: position });
  }

  /**
   * Set current breakpoint.
   */
  setBreakpoint(breakpoint: Breakpoint): void {
    this.setState({ currentBreakpoint: breakpoint });
    // Trigger responsive value calculation
    if (this.state.selectedElement) {
      this.calculateResponsiveValues(this.state.selectedElement);
    }
  }

  /**
   * Navigate selection history.
   */
  selectFromHistory(index: number): void {
    const item = this.state.selectionHistory[index];
    if (item) {
      this.selectElement(item.element, item.measurement);
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Extract component context from element.
   */
  private extractComponentContext(element: Element): void {
    const context = this.getComponentContext(element);
    this.setState({ componentContext: context });
  }

  /**
   * Get component context (props, variants) from element.
   */
  private getComponentContext(element: Element): ComponentContext | null {
    // Try React
    const reactContext = this.getReactComponentContext(element);
    if (reactContext) return reactContext;

    // Try Vue
    const vueContext = this.getVueComponentContext(element);
    if (vueContext) return vueContext;

    // Try Svelte
    const svelteContext = this.getSvelteComponentContext(element);
    if (svelteContext) return svelteContext;

    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getReactComponentContext(element: Element): ComponentContext | null {
    // Try React DevTools global hook first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reactHook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (reactHook?.renderers) {
      for (const [, renderer] of reactHook.renderers) {
        if (renderer.findFiberByHostInstance) {
          const fiber = renderer.findFiberByHostInstance(element);
          if (fiber) {
            return this.extractReactFiberContext(fiber);
          }
        }
      }
    }

    // Fallback to direct fiber access
    const fiberKey = Object.keys(element).find(
      (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
    );

    if (fiberKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fiber = (element as any)[fiberKey];
      return this.extractReactFiberContext(fiber);
    }

    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractReactFiberContext(startFiber: any): ComponentContext | null {
    let fiber = startFiber;
    while (fiber) {
      const type = fiber.type;
      if (type && typeof type !== 'string') {
        const name = type.displayName || type.name;
        if (name && !name.startsWith('_')) {
          const props = this.extractReactProps(fiber);
          const source = fiber._debugSource;

          const context: ComponentContext = {
            name,
            props,
            isReusable: true,
          };

          if (source?.fileName) {
            context.filePath = source.fileName;
            context.lineNumber = source.lineNumber;
          }

          return context;
        }
      }
      fiber = fiber.return;
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractReactProps(fiber: any): ComponentVariant[] {
    const props: ComponentVariant[] = [];
    const fiberProps = fiber.memoizedProps || fiber.pendingProps || {};

    for (const [key, value] of Object.entries(fiberProps)) {
      if (key === 'children' || key.startsWith('__')) continue;

      const variant: ComponentVariant = {
        name: key,
        type: typeof value,
        currentValue: value,
      };

      // Try to infer possible values for common props
      if (key === 'variant' || key === 'size' || key === 'color') {
        const possibleValues = this.inferPossibleValues(key, value);
        if (possibleValues) {
          variant.possibleValues = possibleValues;
        }
      }

      props.push(variant);
    }

    return props;
  }

  private inferPossibleValues(propName: string, currentValue: unknown): string[] | undefined {
    // Common variant patterns
    const commonVariants: Record<string, string[]> = {
      variant: ['primary', 'secondary', 'danger', 'outline', 'ghost'],
      size: ['xs', 'sm', 'md', 'lg', 'xl'],
      color: ['primary', 'secondary', 'success', 'warning', 'danger', 'info'],
    };

    const values = commonVariants[propName];
    if (values && typeof currentValue === 'string') {
      // Include current value if not in list
      if (!values.includes(currentValue)) {
        return [currentValue, ...values];
      }
      return values;
    }

    return undefined;
  }

  private getVueComponentContext(element: Element): ComponentContext | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vue3 = (element as any).__vueParentComponent;
    if (vue3) {
      const name = vue3.type?.name || 'VueComponent';
      const props: ComponentVariant[] = [];

      // Extract props from Vue 3 component
      const propsData = vue3.props || {};
      for (const [key, value] of Object.entries(propsData)) {
        props.push({
          name: key,
          type: typeof value,
          currentValue: value,
        });
      }

      const context: ComponentContext = {
        name,
        props,
        isReusable: true,
      };

      if (vue3.type?.__file) {
        context.filePath = vue3.type.__file;
      }

      return context;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vue2 = (element as any).__vue__;
    if (vue2) {
      const name = vue2.$options?.name || 'VueComponent';
      const props: ComponentVariant[] = [];

      // Extract props from Vue 2 component
      const propsData = vue2.$props || {};
      for (const [key, value] of Object.entries(propsData)) {
        props.push({
          name: key,
          type: typeof value,
          currentValue: value,
        });
      }

      const context: ComponentContext = {
        name,
        props,
        isReusable: true,
      };

      if (vue2.$options?.__file) {
        context.filePath = vue2.$options.__file;
      }

      return context;
    }

    return null;
  }

  private getSvelteComponentContext(element: Element): ComponentContext | null {
    const svelteKeys = Object.keys(element).filter(k => k.startsWith('__svelte'));
    if (svelteKeys.length === 0) return null;

    const props: ComponentVariant[] = [];
    let name = 'SvelteComponent';

    for (const key of svelteKeys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = (element as any)[key];
      if (val?.constructor?.name && val.constructor.name !== 'Object') {
        name = val.constructor.name;
      }

      // Try to extract props from Svelte component
      if (val?.$$?.props) {
        for (const [propKey, propValue] of Object.entries(val.$$.props)) {
          props.push({
            name: propKey,
            type: typeof propValue,
            currentValue: propValue,
          });
        }
      }
    }

    return {
      name,
      props,
      isReusable: true,
    };
  }

  /**
   * Calculate responsive values for element across breakpoints.
   */
  private calculateResponsiveValues(element: Element): void {
    // This would need to actually measure at different viewport sizes
    // For now, we'll parse Tailwind responsive classes
    const classList = Array.from(element.classList);
    const responsiveValues: ResponsiveValue[] = [];

    // Group classes by property and breakpoint
    const propertyBreakpoints: Map<string, Map<number, string>> = new Map();

    for (const className of classList) {
      const match = className.match(/^(sm:|md:|lg:|xl:|2xl:)?(.+)$/);
      if (!match) continue;

      const [, prefix, baseClass] = match;
      const breakpointWidth = this.getBreakpointWidth(prefix || '');

      // Parse the class to get property
      const propertyInfo = this.parseClassProperty(baseClass || className);
      if (!propertyInfo) continue;

      if (!propertyBreakpoints.has(propertyInfo.property)) {
        propertyBreakpoints.set(propertyInfo.property, new Map());
      }
      propertyBreakpoints.get(propertyInfo.property)!.set(breakpointWidth, propertyInfo.value);
    }

    // Convert to ResponsiveValue array
    for (const [property, values] of propertyBreakpoints) {
      const uniqueValues = new Set(values.values());
      responsiveValues.push({
        property,
        values,
        isConsistent: uniqueValues.size === 1,
      });
    }

    this.setState({ responsiveValues });
  }

  private getBreakpointWidth(prefix: string): number {
    const breakpoints: Record<string, number> = {
      '': 0, // base (mobile-first)
      'sm:': 640,
      'md:': 768,
      'lg:': 1024,
      'xl:': 1280,
      '2xl:': 1536,
    };
    return breakpoints[prefix] || 0;
  }

  private parseClassProperty(className: string): { property: string; value: string } | null {
    // Simplified parsing - in reality would use full Tailwind parser
    const patterns: Array<{ pattern: RegExp; property: string }> = [
      { pattern: /^p[xytblr]?-(.+)$/, property: 'padding' },
      { pattern: /^m[xytblr]?-(.+)$/, property: 'margin' },
      { pattern: /^text-(.+)$/, property: 'font-size' },
      { pattern: /^bg-(.+)$/, property: 'background' },
      { pattern: /^w-(.+)$/, property: 'width' },
      { pattern: /^h-(.+)$/, property: 'height' },
      { pattern: /^gap-(.+)$/, property: 'gap' },
    ];

    for (const { pattern, property } of patterns) {
      const match = className.match(pattern);
      if (match) {
        return { property, value: match[1] || className };
      }
    }

    return null;
  }
}

// Global singleton instance
export const inspectorState = new InspectorStateManager();
