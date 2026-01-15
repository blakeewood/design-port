/**
 * @design-port/inspector
 *
 * Component inspection and source mapping.
 */

export { DOMInspector, type InspectionResult } from './dom-inspector.js';
export { SourceMapper, type SourceLocation } from './source-mapper.js';
export { StyleExtractor, type ExtractedStyles } from './style-extractor.js';
export {
  detectComponent,
  detectFromDataAttributes,
  getComponentAncestors,
  type ComponentInfo,
} from './component-detector.js';
