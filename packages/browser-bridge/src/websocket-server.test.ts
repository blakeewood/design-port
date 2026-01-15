import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer } from './websocket-server.js';
import WebSocket from 'ws';

describe('WebSocketServer', () => {
  let server: WebSocketServer;

  beforeEach(() => {
    server = new WebSocketServer(0); // Use random available port
  });

  afterEach(async () => {
    await server.stop();
  });

  it('starts on a dynamic port', async () => {
    const port = await server.start();
    expect(port).toBeGreaterThan(0);
    expect(server.getPort()).toBe(port);
  });

  it('accepts client connections', async () => {
    const port = await server.start();

    const connectionPromise = new Promise<void>((resolve) => {
      server.on('connection', () => resolve());
    });

    const client = new WebSocket(`ws://localhost:${port}`);

    await connectionPromise;
    expect(server.isConnected()).toBe(true);

    client.close();
  });

  it('receives messages from client', async () => {
    const port = await server.start();

    const messagePromise = new Promise<unknown>((resolve) => {
      server.on('message', (msg) => resolve(msg));
    });

    const client = new WebSocket(`ws://localhost:${port}`);

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        client.send(JSON.stringify({ type: 'ready' }));
        resolve();
      });
    });

    const message = await messagePromise;
    expect(message).toEqual({ type: 'ready' });

    client.close();
  });

  it('sends messages to client', async () => {
    const port = await server.start();

    const client = new WebSocket(`ws://localhost:${port}`);

    const messagePromise = new Promise<unknown>((resolve) => {
      client.on('message', (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    await new Promise<void>((resolve) => {
      client.on('open', () => resolve());
    });

    server.send({ type: 'inspect-mode', enabled: true });

    const message = await messagePromise;
    expect(message).toEqual({ type: 'inspect-mode', enabled: true });

    client.close();
  });

  it('emits disconnection event when client closes', async () => {
    const port = await server.start();

    const disconnectPromise = new Promise<void>((resolve) => {
      server.on('disconnection', () => resolve());
    });

    const client = new WebSocket(`ws://localhost:${port}`);

    await new Promise<void>((resolve) => {
      client.on('open', () => resolve());
    });

    expect(server.isConnected()).toBe(true);

    client.close();

    await disconnectPromise;
    expect(server.isConnected()).toBe(false);
  });

  it('handles invalid JSON messages gracefully', async () => {
    const port = await server.start();

    const errorPromise = new Promise<Error>((resolve) => {
      server.on('error', (err) => resolve(err));
    });

    const client = new WebSocket(`ws://localhost:${port}`);

    await new Promise<void>((resolve) => {
      client.on('open', () => {
        client.send('not valid json');
        resolve();
      });
    });

    const error = await errorPromise;
    expect(error.message).toContain('Failed to parse message');

    client.close();
  });
});
