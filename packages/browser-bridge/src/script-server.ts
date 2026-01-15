/**
 * HTTP server for serving the client script and Vite plugin.
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ScriptServerOptions {
  /** Port to serve on (0 = auto) */
  port?: number;
  /** WebSocket server URL for the client to connect to */
  wsUrl: string;
}

export class ScriptServer {
  private server: Server | null = null;
  private port: number;
  private wsUrl: string;
  private clientScript: string | null = null;

  constructor(options: ScriptServerOptions) {
    this.port = options.port ?? 0;
    this.wsUrl = options.wsUrl;
  }

  /**
   * Start the HTTP server.
   */
  async start(): Promise<number> {
    // Pre-load and prepare the client script
    await this.loadClientScript();

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', reject);

      this.server.listen(this.port, () => {
        const address = this.server?.address();
        if (typeof address === 'object' && address) {
          this.port = address.port;
          resolve(this.port);
        }
      });
    });
  }

  /**
   * Stop the server.
   */
  async stop(): Promise<void> {
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
   * Get the URL for the client script.
   */
  getScriptUrl(): string {
    return `http://localhost:${this.port}/__design-port.js`;
  }

  /**
   * Get the port.
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Generate a Vite plugin configuration snippet.
   */
  getVitePluginCode(): string {
    return `
// DesignPort Vite Plugin - Auto-generated
export default function designPortPlugin() {
  return {
    name: 'design-port',
    transformIndexHtml(html) {
      return html.replace(
        '</body>',
        '<script src="${this.getScriptUrl()}"></script></body>'
      );
    }
  };
}
`.trim();
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    // CORS headers for dev server access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/__design-port.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(this.clientScript);
      return;
    }

    if (req.url === '/__design-port/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', wsUrl: this.wsUrl }));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  }

  private async loadClientScript(): Promise<void> {
    try {
      // Try to load the bundled script
      const bundlePath = join(__dirname, '../../client-script/dist/bundle.js');
      const bundle = await readFile(bundlePath, 'utf-8');
      this.clientScript = this.injectConfig(bundle);
    } catch {
      // Fall back to inline script if bundle not available
      this.clientScript = this.getInlineClientScript();
    }
  }

  private injectConfig(script: string): string {
    // Replace the placeholder with actual WebSocket URL
    return script.replace(/__DESIGN_PORT_WS_URL__/g, `"${this.wsUrl}"`);
  }

  private getInlineClientScript(): string {
    // Minimal inline script for development/fallback
    return `
(function() {
  const WS_URL = "${this.wsUrl}";
  let socket = null;
  let inspectMode = false;
  let overlay = null;

  function connect() {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('[DesignPort] Connected');
      socket.send(JSON.stringify({ type: 'ready' }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      } catch (e) {
        console.error('[DesignPort] Parse error:', e);
      }
    };

    socket.onclose = () => {
      console.log('[DesignPort] Disconnected, reconnecting...');
      setTimeout(connect, 1000);
    };

    socket.onerror = (e) => {
      console.error('[DesignPort] WebSocket error:', e);
    };
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case 'ping':
        socket.send(JSON.stringify({ type: 'pong' }));
        break;
      case 'inspect-mode':
        setInspectMode(msg.enabled);
        break;
      case 'highlight-element':
        highlightElement(msg.selector);
        break;
      case 'clear-highlight':
        clearHighlight();
        break;
    }
  }

  function setInspectMode(enabled) {
    inspectMode = enabled;
    document.body.style.cursor = enabled ? 'crosshair' : '';

    if (enabled) {
      document.addEventListener('mousemove', onMouseMove, true);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKeyDown, true);
    } else {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
      clearHighlight();
    }
  }

  function onMouseMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && !el.closest('#__design-port-overlay')) {
      showOverlay(el);
    }
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (el && !el.closest('#__design-port-overlay')) {
      const data = measureElement(el);
      socket.send(JSON.stringify({ type: 'element-selected', payload: data }));
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      setInspectMode(false);
    }
  }

  function measureElement(el) {
    const rect = el.getBoundingClientRect();
    const styles = getComputedStyle(el);
    const px = (v) => parseFloat(v) || 0;

    return {
      selector: getSelector(el),
      tagName: el.tagName.toLowerCase(),
      classList: Array.from(el.classList),
      id: el.id || undefined,
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      boxModel: {
        content: { width: px(styles.width), height: px(styles.height) },
        padding: { top: px(styles.paddingTop), right: px(styles.paddingRight), bottom: px(styles.paddingBottom), left: px(styles.paddingLeft) },
        border: { top: px(styles.borderTopWidth), right: px(styles.borderRightWidth), bottom: px(styles.borderBottomWidth), left: px(styles.borderLeftWidth) },
        margin: { top: px(styles.marginTop), right: px(styles.marginRight), bottom: px(styles.marginBottom), left: px(styles.marginLeft) }
      },
      computedStyles: extractStyles(styles),
      componentName: getComponentName(el)
    };
  }

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    const parts = [];
    while (el && el !== document.body) {
      let sel = el.tagName.toLowerCase();
      if (el.id) { parts.unshift('#' + el.id); break; }
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
        if (siblings.length > 1) sel += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
      }
      parts.unshift(sel);
      el = parent;
    }
    return parts.join(' > ');
  }

  function extractStyles(styles) {
    const props = ['font-family','font-size','font-weight','line-height','color','background-color','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left','border-radius','display','gap'];
    const result = {};
    props.forEach(p => { if (styles.getPropertyValue(p)) result[p] = styles.getPropertyValue(p); });
    return result;
  }

  function getComponentName(el) {
    // React
    const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
    if (fiberKey) {
      let fiber = el[fiberKey];
      while (fiber) {
        const name = fiber.type?.displayName || fiber.type?.name;
        if (name) return name;
        fiber = fiber.return;
      }
    }
    // Vue
    if (el.__vue__) return el.__vue__.$options?.name;
    return undefined;
  }

  function showOverlay(el) {
    clearHighlight();
    const rect = el.getBoundingClientRect();
    overlay = document.createElement('div');
    overlay.id = '__design-port-overlay';
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);';
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    const label = document.createElement('div');
    label.style.cssText = 'position:absolute;top:-22px;left:0;background:#3b82f6;color:#fff;padding:2px 6px;font:11px monospace;border-radius:3px;white-space:nowrap;';
    label.textContent = Math.round(rect.width) + ' × ' + Math.round(rect.height);
    overlay.appendChild(label);

    document.body.appendChild(overlay);
  }

  function highlightElement(selector) {
    try {
      const el = document.querySelector(selector);
      if (el) showOverlay(el);
    } catch {}
  }

  function clearHighlight() {
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  // Auto-connect on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
`;
  }
}
