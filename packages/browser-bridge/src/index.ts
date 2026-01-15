/**
 * @design-port/browser-bridge
 *
 * Browser communication layer and WebSocket server.
 */

export { BrowserBridge } from './bridge.js';
export { WebSocketServer, type BrowserMessage, type TerminalMessage } from './websocket-server.js';
export { BrowserLauncher } from './browser-launcher.js';
export { ScriptServer } from './script-server.js';
export type { Protocol } from './protocol.js';
export type {
  ElementSelection,
  MeasurementData,
  ErrorInfo,
  BrowserToTerminal,
  TerminalToBrowser,
} from './protocol.js';
