/**
 * Next.js dev server adapter.
 */

import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BaseDevServerAdapter } from './base.js';

export class NextJSAdapter extends BaseDevServerAdapter {
  name = 'Next.js';
  private isAppRouter = false;

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

      if ('next' in allDeps) {
        // Check for App Router (Next.js 13+)
        await this.detectRouterType(projectPath);
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  private async detectRouterType(projectPath: string): Promise<void> {
    // Check for app directory (App Router)
    try {
      await access(join(projectPath, 'app'));
      this.isAppRouter = true;
    } catch {
      // Check for src/app
      try {
        await access(join(projectPath, 'src', 'app'));
        this.isAppRouter = true;
      } catch {
        this.isAppRouter = false;
      }
    }
  }

  getStartCommand(_projectPath: string): string[] {
    return ['npx', 'next', 'dev', '-p', String(this.getDefaultPort())];
  }

  override getDefaultPort(): number {
    return 3000;
  }

  override getDevServerUrl(port: number): string {
    return `http://localhost:${port}`;
  }

  /**
   * Check if this is using App Router (Next.js 13+).
   */
  isUsingAppRouter(): boolean {
    return this.isAppRouter;
  }

  /**
   * Next.js doesn't easily support middleware injection.
   * We rely on Puppeteer script injection instead.
   */
  override async injectMiddleware(
    _configPath: string,
    _scriptUrl: string
  ): Promise<string | undefined> {
    // Next.js middleware is different - it's edge runtime
    // Script injection happens via browser bridge
    return undefined;
  }
}
