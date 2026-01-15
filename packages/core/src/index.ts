/**
 * @design-port/core
 *
 * Main entry point for the DesignPort Claude Code plugin.
 * Orchestrates dev server, browser, and inspection lifecycle.
 */

export { DesignPortPlugin, type PluginState, type PluginEvents } from './plugin.js';
export { createConfig, type DesignPortConfig } from './config.js';
