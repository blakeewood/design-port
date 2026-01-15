/**
 * Vite dev server adapter.
 */

import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { BaseDevServerAdapter } from './base.js';

const CONFIG_FILES = [
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mts',
  'vite.config.mjs',
];

export class ViteAdapter extends BaseDevServerAdapter {
  name = 'Vite';

  async detect(projectPath: string): Promise<boolean> {
    for (const file of CONFIG_FILES) {
      try {
        await access(join(projectPath, file));
        return true;
      } catch {
        // File doesn't exist
      }
    }

    // Also check package.json for vite dependency
    try {
      const { readFile } = await import('node:fs/promises');
      const packageJson = JSON.parse(
        await readFile(join(projectPath, 'package.json'), 'utf-8')
      ) as { devDependencies?: Record<string, string>; dependencies?: Record<string, string> };

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      return 'vite' in allDeps;
    } catch {
      return false;
    }
  }

  getStartCommand(_projectPath: string): string[] {
    return ['npx', 'vite', '--port', String(this.getDefaultPort())];
  }

  getDefaultPort(): number {
    return 5173;
  }

  getDevServerUrl(port: number): string {
    return `http://localhost:${port}`;
  }
}
