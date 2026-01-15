/**
 * Create React App (CRA) dev server adapter.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BaseDevServerAdapter } from './base.js';

export class CRAAdapter extends BaseDevServerAdapter {
  name = 'Create React App';

  async detect(projectPath: string): Promise<boolean> {
    try {
      const packageJson = JSON.parse(
        await readFile(join(projectPath, 'package.json'), 'utf-8')
      ) as {
        devDependencies?: Record<string, string>;
        dependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // CRA uses react-scripts
      if ('react-scripts' in allDeps) {
        return true;
      }

      // Also check for typical CRA script pattern
      if (packageJson.scripts?.['start']?.includes('react-scripts')) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  getStartCommand(_projectPath: string): string[] {
    // CRA uses react-scripts start
    // We set BROWSER=none to prevent auto-opening browser (we control that)
    return ['npx', 'react-scripts', 'start'];
  }

  override getDefaultPort(): number {
    return 3000;
  }

  override getDevServerUrl(port: number): string {
    return `http://localhost:${port}`;
  }

  /**
   * CRA doesn't support middleware injection easily.
   * We rely on Puppeteer script injection instead.
   */
  override async injectMiddleware(
    _configPath: string,
    _scriptUrl: string
  ): Promise<string | undefined> {
    // CRA doesn't expose webpack config without ejecting
    // Script injection happens via browser bridge
    return undefined;
  }
}
