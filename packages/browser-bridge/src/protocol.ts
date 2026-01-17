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

/** Staged element selection for multi-select mode */
export interface StagedElement {
  /** Unique ID for this selection */
  id: string;
  /** CSS selector for the element */
  selector: string;
  /** Short display text (e.g., "Button.primary") */
  summary: string;
  /** Element tag name */
  tagName: string;
  /** React/Vue/Svelte component name if detected */
  componentName?: string;
  /** Element dimensions */
  dimensions?: { width: number; height: number };
  /** Key CSS classes (first few) */
  classes?: string[];
  /** Source file location */
  sourceLocation?: { file: string; line: number };
  /** Full element selection data */
  element?: ElementSelection;
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
  | { type: 'error'; payload: ErrorInfo }
  // Staging messages (Phase 7.1)
  | { type: 'element-staged'; payload: StagedElement }
  | { type: 'element-unstaged'; payload: { id: string } }
  | { type: 'selections-cleared' };

export type TerminalToBrowser =
  | { type: 'ping' }
  | { type: 'inspect-mode'; enabled: boolean }
  | { type: 'highlight-element'; selector: string }
  | { type: 'clear-highlight' }
  // Staging messages (Phase 7.1)
  | { type: 'clear-staged' }
  | { type: 'highlight-staged'; ids: string[] }
  | { type: 'set-multi-select'; enabled: boolean };
