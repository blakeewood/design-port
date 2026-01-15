/**
 * Message protocol definitions for browser-terminal communication.
 */

export interface ElementSelection {
  /** CSS selector path to the element */
  selector: string;
  /** Element tag name */
  tagName: string;
  /** Element class list */
  classList: string[];
  /** Element id if present */
  id?: string;
  /** Bounding rectangle */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Box model measurements */
  boxModel: {
    content: { width: number; height: number };
    padding: { top: number; right: number; bottom: number; left: number };
    border: { top: number; right: number; bottom: number; left: number };
    margin: { top: number; right: number; bottom: number; left: number };
  };
  /** Computed styles (subset of most relevant) */
  computedStyles: Record<string, string>;
  /** React/Vue component name if detected */
  componentName?: string;
  /** Source file location if available */
  sourceLocation?: {
    file: string;
    line: number;
    column?: number;
  };
}

export interface MeasurementData {
  element: ElementSelection;
  /** Design tokens used by this element */
  designTokens: Array<{
    property: string;
    token: string;
    value: string;
    system: 'tailwind' | 'chakra' | 'css-var' | 'custom';
  }>;
}

export interface ErrorInfo {
  message: string;
  code?: string;
  stack?: string;
}

export interface Protocol {
  /** Messages from browser to terminal */
  browser: BrowserToTerminal;
  /** Messages from terminal to browser */
  terminal: TerminalToBrowser;
}

export type BrowserToTerminal =
  | { type: 'ready' }
  | { type: 'pong' }
  | { type: 'element-selected'; payload: ElementSelection }
  | { type: 'measurement'; payload: MeasurementData }
  | { type: 'error'; payload: ErrorInfo };

export type TerminalToBrowser =
  | { type: 'ping' }
  | { type: 'inspect-mode'; enabled: boolean }
  | { type: 'highlight-element'; selector: string }
  | { type: 'clear-highlight' };
