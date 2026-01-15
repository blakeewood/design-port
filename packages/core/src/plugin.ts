/**
 * Main plugin class that orchestrates the DesignPort workflow.
 */

import type { DesignPortConfig } from './config.js';
import { createConfig } from './config.js';

export interface PluginState {
  status: 'idle' | 'starting' | 'running' | 'stopping' | 'error';
  devServerUrl?: string;
  browserConnected: boolean;
  error?: Error;
}

export class DesignPortPlugin {
  private config: Required<DesignPortConfig>;
  private state: PluginState = {
    status: 'idle',
    browserConnected: false,
  };

  constructor(userConfig: DesignPortConfig = {}) {
    this.config = createConfig(userConfig);
  }

  /**
   * Start the DesignPort plugin.
   * 1. Detect framework and start dev server
   * 2. Launch browser
   * 3. Establish WebSocket connection
   * 4. Inject client script
   */
  async start(): Promise<void> {
    this.state.status = 'starting';

    try {
      // TODO: Implement startup sequence
      // 1. Detect framework (server-manager)
      // 2. Start dev server (server-manager)
      // 3. Launch browser (browser-bridge)
      // 4. Establish WebSocket (browser-bridge)
      // 5. Parse design tokens (design-tokens)

      this.state.status = 'running';
    } catch (error) {
      this.state.status = 'error';
      this.state.error = error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  /**
   * Stop the DesignPort plugin and clean up resources.
   */
  async stop(): Promise<void> {
    this.state.status = 'stopping';

    try {
      // TODO: Implement cleanup
      // 1. Close browser
      // 2. Stop dev server
      // 3. Close WebSocket connections

      this.state.status = 'idle';
    } catch (error) {
      this.state.status = 'error';
      this.state.error = error instanceof Error ? error : new Error(String(error));
      throw error;
    }
  }

  /**
   * Get current plugin state.
   */
  getState(): Readonly<PluginState> {
    return { ...this.state };
  }

  /**
   * Get plugin configuration.
   */
  getConfig(): Readonly<Required<DesignPortConfig>> {
    return { ...this.config };
  }
}
