/**
 * Configuration handling for DesignPort plugin.
 * Supports loading from .designportrc, .designportrc.json, or package.json
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

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

  /** Run browser in headless mode (for CI/testing) */
  headless?: boolean;

  /** Skip launching browser (useful when attaching to existing browser) */
  skipBrowser?: boolean;

  /** Custom script to inject alongside the inspector */
  customScript?: string;
}

const defaultConfig: Required<DesignPortConfig> = {
  browser: 'chrome',
  devServerPort: 0, // 0 = auto-detect
  inspectorPort: 0, // 0 = auto-assign
  projectPath: process.cwd(),
  verbose: false,
  headless: false,
  skipBrowser: false,
  customScript: '',
};

/**
 * Load configuration from project files.
 */
export async function loadConfig(projectPath: string): Promise<DesignPortConfig> {
  const configFiles = [
    '.designportrc',
    '.designportrc.json',
    'designport.config.json',
  ];

  // Try dedicated config files first
  for (const file of configFiles) {
    try {
      const content = await readFile(join(projectPath, file), 'utf-8');
      const config = JSON.parse(content) as DesignPortConfig;
      return config;
    } catch {
      // File doesn't exist or isn't valid JSON
    }
  }

  // Try package.json
  try {
    const pkgPath = join(projectPath, 'package.json');
    const content = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as { designPort?: DesignPortConfig };
    if (pkg.designPort) {
      return pkg.designPort;
    }
  } catch {
    // No package.json or no designPort key
  }

  return {};
}

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

/**
 * Create config by loading from files and applying user overrides.
 */
export async function createConfigFromProject(
  projectPath: string,
  overrides: DesignPortConfig = {}
): Promise<Required<DesignPortConfig>> {
  const fileConfig = await loadConfig(projectPath);
  return createConfig({
    projectPath,
    ...fileConfig,
    ...overrides,
  });
}
