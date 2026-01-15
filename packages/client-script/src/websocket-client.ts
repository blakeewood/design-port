/**
 * WebSocket client for browser-to-terminal communication.
 * Handles reconnection on page reload and hot-module replacement.
 */

type MessageHandler = (message: unknown) => void;

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string;
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Increased for HMR scenarios
  private reconnectDelay = 500; // Faster initial reconnect
  private intentionalClose = false;
  private visibilityHandler: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.setupVisibilityHandler();
  }

  /**
   * Connect to the WebSocket server.
   */
  connect(): Promise<void> {
    // Reset intentional close flag
    this.intentionalClose = false;

    return new Promise((resolve, reject) => {
      try {
        // Close existing socket if any
        if (this.socket) {
          this.socket.onclose = null;
          this.socket.close();
        }

        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
          this.reconnectAttempts = 0;
          this.send({ type: 'ready' });
          console.log('[DesignPort] Connected to terminal');
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string) as { type: string };
            this.emit(message.type, message);
          } catch {
            console.error('[DesignPort] Failed to parse message');
          }
        };

        this.socket.onclose = (event) => {
          // Don't reconnect if intentionally closed
          if (!this.intentionalClose) {
            this.handleDisconnect(event.wasClean);
          }
        };

        this.socket.onerror = () => {
          // Error will trigger onclose, handle reconnect there
          if (this.reconnectAttempts === 0) {
            reject(new Error('WebSocket connection failed'));
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send a message to the server.
   */
  send(message: unknown): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Register a message handler.
   */
  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  /**
   * Remove a message handler.
   */
  off(type: string, handler: MessageHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  /**
   * Disconnect from the server.
   */
  disconnect(): void {
    this.intentionalClose = true;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Check if connected.
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private emit(type: string, message: unknown): void {
    this.handlers.get(type)?.forEach((handler) => handler(message));
    this.handlers.get('*')?.forEach((handler) => handler(message));
  }

  private handleDisconnect(wasClean: boolean): void {
    this.socket = null;

    // For clean closes during HMR, reconnect immediately
    const baseDelay = wasClean ? 100 : this.reconnectDelay;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      // Exponential backoff with jitter to avoid thundering herd
      const delay = baseDelay * Math.pow(1.5, this.reconnectAttempts - 1) + Math.random() * 100;
      console.log(`[DesignPort] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

      setTimeout(() => {
        this.connect().catch(() => {
          // Error handling triggers another reconnect via onclose
        });
      }, delay);
    } else {
      console.error('[DesignPort] Max reconnection attempts reached. Refresh page to reconnect.');
      this.emit('max-retries', {});
    }
  }

  /**
   * Handle page visibility changes to reconnect when tab becomes visible.
   */
  private setupVisibilityHandler(): void {
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && !this.isConnected()) {
        console.log('[DesignPort] Tab visible, attempting reconnect...');
        this.reconnectAttempts = 0; // Reset attempts when tab becomes visible
        this.connect().catch(() => {
          // Will retry via handleDisconnect
        });
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /**
   * Clean up event listeners.
   */
  destroy(): void {
    this.intentionalClose = true;

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}
