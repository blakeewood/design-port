/**
 * Vite plugin for DesignPort script injection.
 *
 * This plugin can be added to a project's vite.config.ts to inject
 * the DesignPort client script automatically.
 */

export interface DesignPortVitePluginOptions {
  /** URL where the DesignPort script server is running */
  scriptUrl: string;
}

/**
 * Create a Vite plugin that injects the DesignPort client script.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from 'vite';
 * import { designPortPlugin } from '@design-port/server-manager/vite-plugin';
 *
 * export default defineConfig({
 *   plugins: [
 *     designPortPlugin({ scriptUrl: 'http://localhost:9222/__design-port.js' })
 *   ]
 * });
 * ```
 */
export function designPortPlugin(options: DesignPortVitePluginOptions) {
  return {
    name: 'design-port',
    enforce: 'post' as const,

    transformIndexHtml(html: string) {
      // Don't inject if already present
      if (html.includes('__design-port')) {
        return html;
      }

      // Inject script before closing body tag
      return html.replace(
        '</body>',
        `<script src="${options.scriptUrl}"></script>\n</body>`
      );
    },

    configureServer(server: { middlewares: { use: (handler: unknown) => void } }) {
      // Add a middleware to serve a status endpoint
      server.middlewares.use((req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (d: string) => void }, next: () => void) => {
        if (req.url === '/__design-port/status') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            enabled: true,
            scriptUrl: options.scriptUrl,
          }));
          return;
        }
        next();
      });
    },
  };
}

/**
 * Generate Vite plugin code as a string for dynamic injection.
 * Useful when DesignPort needs to modify an existing vite.config.
 */
export function generateVitePluginCode(scriptUrl: string): string {
  return `
// DesignPort Plugin - Auto-injected
// Remove this when DesignPort is not running
function designPortPlugin() {
  return {
    name: 'design-port',
    enforce: 'post',
    transformIndexHtml(html) {
      if (html.includes('__design-port')) return html;
      return html.replace('</body>', '<script src="${scriptUrl}"></script>\\n</body>');
    }
  };
}
`.trim();
}
