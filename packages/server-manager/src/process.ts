/**
 * Dev server process lifecycle management.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { DevServerAdapter } from './adapters/base.js';

export interface DevServerEvents {
  start: [url: string];
  ready: [url: string];
  error: [error: Error];
  exit: [code: number | null];
  output: [data: string];
}

export class DevServerManager extends EventEmitter<DevServerEvents> {
  private process: ChildProcess | null = null;
  private adapter: DevServerAdapter;
  private projectPath: string;
  private port: number;

  constructor(
    adapter: DevServerAdapter,
    projectPath: string,
    port: number = 0
  ) {
    super();
    this.adapter = adapter;
    this.projectPath = projectPath;
    this.port = port || adapter.getDefaultPort?.() || 3000;
  }

  /**
   * Start the dev server.
   */
  async start(): Promise<string> {
    if (this.process) {
      throw new Error('Dev server is already running');
    }

    const [command, ...args] = this.adapter.getStartCommand(this.projectPath);

    if (!command) {
      throw new Error('No start command available for this adapter');
    }

    return new Promise((resolve, reject) => {
      this.process = spawn(command, args, {
        cwd: this.projectPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PORT: String(this.port),
        },
        shell: true,
      });

      const url = this.adapter.getDevServerUrl(this.port);
      let resolved = false;

      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.emit('output', output);

        // Look for common "ready" indicators
        if (!resolved && this.isServerReady(output)) {
          resolved = true;
          this.emit('ready', url);
          resolve(url);
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.emit('output', output);
      });

      this.process.on('error', (error) => {
        this.emit('error', error);
        if (!resolved) {
          reject(error);
        }
      });

      this.process.on('exit', (code) => {
        this.emit('exit', code);
        this.process = null;
        if (!resolved) {
          reject(new Error(`Dev server exited with code ${code}`));
        }
      });

      this.emit('start', url);

      // Fallback timeout - assume ready after 10 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.emit('ready', url);
          resolve(url);
        }
      }, 10000);
    });
  }

  /**
   * Stop the dev server.
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      this.process.on('exit', () => {
        this.process = null;
        resolve();
      });

      this.process.kill('SIGTERM');

      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    });
  }

  /**
   * Check if the server is currently running.
   */
  isRunning(): boolean {
    return this.process !== null;
  }

  /**
   * Get the server URL.
   */
  getUrl(): string {
    return this.adapter.getDevServerUrl(this.port);
  }

  private isServerReady(output: string): boolean {
    const readyIndicators = [
      'ready in',
      'ready on',
      'listening on',
      'started server',
      'Local:',
      'localhost:',
      '127.0.0.1:',
    ];

    const lowerOutput = output.toLowerCase();
    return readyIndicators.some((indicator) =>
      lowerOutput.includes(indicator.toLowerCase())
    );
  }
}
