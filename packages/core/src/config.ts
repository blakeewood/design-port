/**
 * Configuration handling for DesignPort plugin.
 */

export interface DesignPortConfig {
  /** Browser to use for preview (default: 'chrome') */
  browser?: 'chrome' | 'chromium' | 'edge';

  /** Port for the dev server (default: auto-detect) */
  devServerPort?: number;

  /** Port for the WebSocket inspector connection */
  inspectorPort?: number;

  /** Path to project root (default: cwd) */
  projectPath?: string;

  /** Enable verbose logging */
  verbose?: boolean;
}

const defaultConfig: Required<DesignPortConfig> = {
  browser: 'chrome',
  devServerPort: 0, // 0 = auto-detect
  inspectorPort: 0, // 0 = auto-assign
  projectPath: process.cwd(),
  verbose: false,
};

/**
 * Create a DesignPort configuration with defaults applied.
 */
export function createConfig(
  userConfig: DesignPortConfig = {}
): Required<DesignPortConfig> {
  return {
    ...defaultConfig,
    ...userConfig,
  };
}
