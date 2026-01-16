/**
 * @design-port/client-script
 *
 * Browser-injected inspection script.
 * This module exports the script bundle path for injection.
 */

// Legacy exports (Phase 1-6)
export { ElementPicker } from './element-picker.js';
export { MeasurementOverlay } from './overlay.js';
export { WebSocketClient } from './websocket-client.js';
export { measureElement, type ElementMeasurement } from './measurement.js';
export {
  SourceMapLoader,
  getSourceMapLoader,
  type OriginalLocation,
} from './source-map-loader.js';

// Phase 6.5 Visual Inspector exports
export {
  inspectorState,
  InspectorStateManager,
  DEFAULT_BREAKPOINTS,
  type InspectorState,
  type OverlayState,
  type InspectorTab,
  type Breakpoint,
  type ComponentContext,
  type ComponentVariant,
  type ResponsiveValue,
} from './inspector-state.js';

export { InspectorPanel } from './inspector-panel.js';
export { VisualOverlay } from './visual-overlay.js';
export { ElementPickerV2 } from './element-picker-v2.js';
