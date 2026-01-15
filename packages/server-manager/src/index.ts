/**
 * @design-port/server-manager
 *
 * Dev server detection and lifecycle management.
 */

export { detectFramework, type FrameworkInfo } from './detector.js';
export { DevServerManager } from './process.js';
export type { DevServerAdapter } from './adapters/base.js';
