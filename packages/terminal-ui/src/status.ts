/**
 * Status line management for terminal display.
 * Provides real-time status updates with ANSI terminal control.
 */

import chalk from 'chalk';

export interface PluginStatus {
  devServer: 'starting' | 'running' | 'stopped' | 'error';
  browser: 'launching' | 'connected' | 'disconnected' | 'error';
  inspectMode: boolean;
  devServerUrl?: string;
  error?: string;
  /** Number of elements inspected this session */
  elementsInspected?: number;
  /** Framework detected */
  framework?: string;
}

export class StatusLine {
  private status: PluginStatus = {
    devServer: 'stopped',
    browser: 'disconnected',
    inspectMode: false,
  };

  private startTime: number | null = null;
  private lastRender: string = '';

  /**
   * Update the status.
   */
  update(partial: Partial<PluginStatus>): void {
    // Start timer when server starts running
    if (partial.devServer === 'running' && this.status.devServer !== 'running') {
      this.startTime = Date.now();
    }
    // Reset timer when stopped
    if (partial.devServer === 'stopped' || partial.devServer === 'error') {
      this.startTime = null;
    }

    this.status = { ...this.status, ...partial };
  }

  /**
   * Increment elements inspected counter.
   */
  incrementInspected(): void {
    this.status.elementsInspected = (this.status.elementsInspected || 0) + 1;
  }

  /**
   * Get uptime in human-readable format.
   */
  getUptime(): string | null {
    if (!this.startTime) return null;

    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
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

    this.lastRender = parts.join('  │  ');
    return this.lastRender;
  }

  /**
   * Get a detailed multi-line status display.
   */
  renderDetailed(): string {
    const lines: string[] = [];

    lines.push(chalk.bold('DesignPort Status'));
    lines.push('─'.repeat(40));

    // Server
    lines.push(`  ${this.getServerIcon()} Dev Server: ${this.formatServerStatus()}`);

    // Browser
    lines.push(`  ${this.getBrowserIcon()} Browser: ${this.formatBrowserStatus()}`);

    // Inspect mode
    const inspectIcon = this.status.inspectMode ? '🔍' : '⏸';
    const inspectStatus = this.status.inspectMode
      ? chalk.green('Active')
      : chalk.gray('Inactive');
    lines.push(`  ${inspectIcon} Inspect Mode: ${inspectStatus}`);

    // Framework
    if (this.status.framework) {
      lines.push(`  📦 Framework: ${this.status.framework}`);
    }

    // Stats
    if (this.status.elementsInspected) {
      lines.push(`  📊 Elements Inspected: ${this.status.elementsInspected}`);
    }

    // Uptime
    const uptime = this.getUptime();
    if (uptime) {
      lines.push(`  ⏱️  Uptime: ${uptime}`);
    }

    lines.push('─'.repeat(40));

    return lines.join('\n');
  }

  /**
   * Write status to terminal, updating in place if possible.
   * Uses ANSI escape codes to clear and rewrite the line.
   */
  writeToTerminal(stream: NodeJS.WriteStream = process.stdout): void {
    const status = this.renderCompact() + ' ' + this.render();

    if (stream.isTTY) {
      // Clear line and move cursor to beginning
      stream.write('\r\x1b[K' + status);
    } else {
      // Non-TTY: just write a new line
      stream.write(status + '\n');
    }
  }

  /**
   * Clear the status line from terminal.
   */
  clearFromTerminal(stream: NodeJS.WriteStream = process.stdout): void {
    if (stream.isTTY) {
      stream.write('\r\x1b[K');
    }
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
