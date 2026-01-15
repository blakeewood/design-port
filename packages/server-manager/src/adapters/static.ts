/**
 * Static HTML/CSS dev server adapter.
 * Uses a simple HTTP server for projects without a build system.
 */

import { access, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { BaseDevServerAdapter } from './base.js';

const HTML_EXTENSIONS = ['.html', '.htm'];

export class StaticAdapter extends BaseDevServerAdapter {
  name = 'Static HTML';
  private hasIndexHtml = false;

  async detect(projectPath: string): Promise<boolean> {
    try {
      // Check for index.html in root
      try {
        await access(join(projectPath, 'index.html'));
        this.hasIndexHtml = true;
        return true;
      } catch {
        // No index.html in root
      }

      // Check for any HTML files
      const files = await readdir(projectPath);
      const htmlFiles = files.filter(f =>
        HTML_EXTENSIONS.includes(extname(f).toLowerCase())
      );

      if (htmlFiles.length > 0) {
        this.hasIndexHtml = htmlFiles.includes('index.html');
        return true;
      }

      // Check for public/index.html
      try {
        await access(join(projectPath, 'public', 'index.html'));
        this.hasIndexHtml = true;
        return true;
      } catch {
        // No public/index.html
      }

      return false;
    } catch {
      return false;
    }
  }

  getStartCommand(_projectPath: string): string[] {
    // Use npx serve as a simple static file server
    // It's widely available and has good defaults
    const servePath = this.hasIndexHtml ? '.' : '.';
    return [
      'npx',
      'serve',
      servePath,
      '-l',
      String(this.getDefaultPort()),
      '--no-clipboard',
    ];
  }

  override getDefaultPort(): number {
    return 3000;
  }

  override getDevServerUrl(port: number): string {
    return `http://localhost:${port}`;
  }

  /**
   * Get alternative start command using Python's http.server (fallback).
   */
  getPythonCommand(projectPath: string): string[] {
    return [
      'python3',
      '-m',
      'http.server',
      String(this.getDefaultPort()),
      '--directory',
      projectPath,
    ];
  }

  /**
   * Get alternative start command using Node's http-server (fallback).
   */
  getHttpServerCommand(_projectPath: string): string[] {
    return [
      'npx',
      'http-server',
      '-p',
      String(this.getDefaultPort()),
      '-c-1', // Disable caching
    ];
  }
}
