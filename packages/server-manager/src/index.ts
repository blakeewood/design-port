/**
 * @design-port/server-manager
 *
 * Dev server detection and lifecycle management.
 */

export { detectFramework, type FrameworkInfo } from './detector.js';
export { DevServerManager } from './process.js';
export { BaseDevServerAdapter, type DevServerAdapter } from './adapters/base.js';
export { ViteAdapter } from './adapters/vite.js';
export { designPortPlugin, generateVitePluginCode } from './adapters/vite-plugin.js';
