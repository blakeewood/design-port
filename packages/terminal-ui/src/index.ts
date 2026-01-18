/**
 * @design-port/terminal-ui
 *
 * Terminal output formatting for DesignPort.
 */

export {
  Formatter,
  type FormatterOptions,
  type ElementSelection,
  type DesignToken,
  type CSSVariableUsage,
  type TailwindClassInfo,
  type AccessibilityInfo,
} from './formatter.js';
export { StatusLine, type PluginStatus } from './status.js';
export {
  SelectedElementsManager,
  stagedSelections,
  type SelectedElement,
  type SelectedElementsOptions,
} from './staged-selections.js';
