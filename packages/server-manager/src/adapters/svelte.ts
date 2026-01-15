/**
 * Svelte and SvelteKit dev server adapter.
 */

import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BaseDevServerAdapter } from './base.js';

const SVELTE_CONFIG_FILES = [
  'svelte.config.js',
  'svelte.config.ts',
  'svelte.config.mjs',
];

export class SvelteAdapter extends BaseDevServerAdapter {
  name = 'Svelte';
  private isSvelteKit = false;

  async detect(projectPath: string): Promise<boolean> {
    try {
      const packageJson = JSON.parse(
        await readFile(join(projectPath, 'package.json'), 'utf-8')
      ) as {
        devDependencies?: Record<string, string>;
        dependencies?: Record<string, string>;
      };

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Check for SvelteKit first (it's the most common)
      if ('@sveltejs/kit' in allDeps) {
        this.isSvelteKit = true;
        return true;
      }

      // Check for plain Svelte with Vite
      if ('svelte' in allDeps) {
        // Check for svelte config file
        for (const file of SVELTE_CONFIG_FILES) {
          try {
            await access(join(projectPath, file));
            return true;
          } catch {
            // File doesn't exist
          }
        }

        // Svelte without config is likely using Vite
        if ('@sveltejs/vite-plugin-svelte' in allDeps) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  getStartCommand(_projectPath: string): string[] {
    if (this.isSvelteKit) {
      // SvelteKit uses vite under the hood
      return ['npx', 'vite', 'dev', '--port', String(this.getDefaultPort())];
    }

    // Plain Svelte with Vite
    return ['npx', 'vite', '--port', String(this.getDefaultPort())];
  }

  override getDefaultPort(): number {
    return 5173; // Vite's default port
  }

  override getDevServerUrl(port: number): string {
    return `http://localhost:${port}`;
  }

  /**
   * Check if this is a SvelteKit project.
   */
  isSvelteKitProject(): boolean {
    return this.isSvelteKit;
  }
}
