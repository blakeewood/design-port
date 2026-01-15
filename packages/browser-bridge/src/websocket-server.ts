/**
 * WebSocket server for browser-terminal communication.
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { EventEmitter } from 'node:events';
import type { BrowserToTerminal, TerminalToBrowser } from './protocol.js';

export type BrowserMessage = BrowserToTerminal;
export type TerminalMessage = TerminalToBrowser;

export interface WebSocketServerEvents {
  connection: [];
  disconnection: [];
  message: [message: BrowserMessage];
  error: [error: Error];
}

export class WebSocketServer extends EventEmitter<WebSocketServerEvents> {
  private server: WSServer | null = null;
  private client: WebSocket | null = null;
  private port: number;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(port: number = 0) {
    super();
    this.port = port;
  }

  /**
   * Start the WebSocket server.
   */
  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = new WSServer({ port: this.port });

      this.server.on('listening', () => {
        const address = this.server?.address();
        if (typeof address === 'object' && address) {
          this.port = address.port;
          this.startPingInterval();
          resolve(this.port);
        }
      });

      this.server.on('connection', (socket) => {
        this.client = socket;
        this.emit('connection');

        socket.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as BrowserMessage;
            this.emit('message', message);
          } catch (error) {
            this.emit(
              'error',
              new Error(`Failed to parse message: ${String(error)}`)
            );
          }
        });

        socket.on('close', () => {
          this.client = null;
          this.emit('disconnection');
        });

        socket.on('error', (error) => {
          this.emit('error', error);
        });
      });

      this.server.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * Stop the WebSocket server.
   */
  async stop(): Promise<void> {
    this.stopPingInterval();

    if (this.client) {
      this.client.close();
      this.client = null;
    }

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Send a message to the connected browser.
   */
  send(message: TerminalMessage): void {
    if (this.client && this.client.readyState === WebSocket.OPEN) {
      this.client.send(JSON.stringify(message));
    }
  }

  /**
   * Check if a client is connected.
   */
  isConnected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  /**
   * Get the server port.
   */
  getPort(): number {
    return this.port;
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
