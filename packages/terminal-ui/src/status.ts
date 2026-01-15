/**
 * Status line management for terminal display.
 */

import chalk from 'chalk';

export interface PluginStatus {
  devServer: 'starting' | 'running' | 'stopped' | 'error';
  browser: 'launching' | 'connected' | 'disconnected' | 'error';
  inspectMode: boolean;
  devServerUrl?: string;
  error?: string;
}

export class StatusLine {
  private status: PluginStatus = {
    devServer: 'stopped',
    browser: 'disconnected',
    inspectMode: false,
  };

  /**
   * Update the status.
   */
  update(partial: Partial<PluginStatus>): void {
    this.status = { ...this.status, ...partial };
  }

  /**
   * Get the formatted status line.
   */
  render(): string {
    const parts: string[] = [];

    // Dev server status
    const serverIcon = this.getServerIcon();
    parts.push(`${serverIcon} Server: ${this.formatServerStatus()}`);

    // Browser status
    const browserIcon = this.getBrowserIcon();
    parts.push(`${browserIcon} Browser: ${this.formatBrowserStatus()}`);

    // Inspect mode
    if (this.status.browser === 'connected') {
      const inspectIcon = this.status.inspectMode ? '🔍' : '⏸';
      parts.push(`${inspectIcon} Inspect: ${this.status.inspectMode ? 'ON' : 'OFF'}`);
    }

    return parts.join('  │  ');
  }

  /**
   * Get a compact status indicator.
   */
  renderCompact(): string {
    const server = this.status.devServer === 'running' ? chalk.green('●') :
                   this.status.devServer === 'starting' ? chalk.yellow('○') :
                   this.status.devServer === 'error' ? chalk.red('●') : chalk.gray('○');

    const browser = this.status.browser === 'connected' ? chalk.green('●') :
                    this.status.browser === 'launching' ? chalk.yellow('○') :
                    this.status.browser === 'error' ? chalk.red('●') : chalk.gray('○');

    return `[${server}${browser}]`;
  }

  /**
   * Get current status.
   */
  getStatus(): Readonly<PluginStatus> {
    return { ...this.status };
  }

  private getServerIcon(): string {
    switch (this.status.devServer) {
      case 'starting': return '🔄';
      case 'running': return '✅';
      case 'error': return '❌';
      default: return '⏹';
    }
  }

  private getBrowserIcon(): string {
    switch (this.status.browser) {
      case 'launching': return '🔄';
      case 'connected': return '✅';
      case 'error': return '❌';
      default: return '⏹';
    }
  }

  private formatServerStatus(): string {
    switch (this.status.devServer) {
      case 'starting':
        return chalk.yellow('Starting...');
      case 'running':
        return chalk.green('Running') +
          (this.status.devServerUrl ? chalk.dim(` (${this.status.devServerUrl})`) : '');
      case 'error':
        return chalk.red('Error') +
          (this.status.error ? chalk.dim(` - ${this.status.error}`) : '');
      default:
        return chalk.gray('Stopped');
    }
  }

  private formatBrowserStatus(): string {
    switch (this.status.browser) {
      case 'launching':
        return chalk.yellow('Launching...');
      case 'connected':
        return chalk.green('Connected');
      case 'error':
        return chalk.red('Error');
      default:
        return chalk.gray('Disconnected');
    }
  }
}
