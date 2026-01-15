# Framework Adapters

This document describes how to create custom dev server adapters for DesignPort to support additional frameworks and build tools.

## Adapter Interface

All adapters must implement the `DevServerAdapter` interface:

```typescript
interface DevServerAdapter {
  /** Adapter name for logging */
  name: string;

  /**
   * Check if this adapter can handle the given project.
   * Return true if this adapter should be used.
   */
  detect(projectPath: string): Promise<boolean>;

  /**
   * Get the command to start the dev server.
   * Returns [command, ...args]
   */
  getStartCommand(projectPath: string): string[];

  /**
   * Get the dev server URL once running.
   */
  getDevServerUrl(port: number): string;

  /**
   * Optional: Get the default port for this dev server.
   */
  getDefaultPort?(): number;

  /**
   * Optional: Inject middleware or plugin for script injection.
   * Returns the modified config content or undefined if not supported.
   */
  injectMiddleware?(
    configPath: string,
    scriptUrl: string
  ): Promise<string | undefined>;
}
```

## Using BaseDevServerAdapter

Extend `BaseDevServerAdapter` for common functionality:

```typescript
import { BaseDevServerAdapter } from '@design-port/server-manager';

export class MyAdapter extends BaseDevServerAdapter {
  name = 'My Framework';

  async detect(projectPath: string): Promise<boolean> {
    // Check if this framework is used
  }

  getStartCommand(projectPath: string): string[] {
    // Return the dev server command
  }
}
```

## Built-in Adapters

| Adapter | Framework | Detection |
|---------|-----------|-----------|
| `ViteAdapter` | Vite (React, Vue, etc.) | `vite.config.*` or vite in deps |
| `CRAAdapter` | Create React App | `react-scripts` in deps |
| `NextJSAdapter` | Next.js | `next` in deps |
| `SvelteAdapter` | Svelte/SvelteKit | `svelte` or `@sveltejs/kit` in deps |
| `StaticAdapter` | Plain HTML/CSS | Fallback when no framework detected |

## Creating a Custom Adapter

### Step 1: Create the Adapter Class

```typescript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BaseDevServerAdapter } from '@design-port/server-manager';

export class AstroAdapter extends BaseDevServerAdapter {
  name = 'Astro';

  async detect(projectPath: string): Promise<boolean> {
    try {
      const packageJson = JSON.parse(
        await readFile(join(projectPath, 'package.json'), 'utf-8')
      );

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      return 'astro' in allDeps;
    } catch {
      return false;
    }
  }

  getStartCommand(_projectPath: string): string[] {
    return ['npx', 'astro', 'dev', '--port', String(this.getDefaultPort())];
  }

  override getDefaultPort(): number {
    return 4321; // Astro's default port
  }
}
```

### Step 2: Register the Adapter

In your plugin configuration or by modifying `selectAdapter()` in the core plugin:

```typescript
import { AstroAdapter } from './adapters/astro.js';

// In selectAdapter method:
if (framework.buildTool === 'astro') {
  return new AstroAdapter();
}
```

### Step 3: Add Framework Detection

Update the detector to recognize your framework:

```typescript
// In packages/server-manager/src/detector.ts
if (allDeps['astro']) {
  return {
    framework: 'astro',
    buildTool: 'astro',
    packageManager,
    version: allDeps['astro'],
  };
}
```

## Middleware Injection (Optional)

Some frameworks support injecting the DesignPort client script via middleware. Override `injectMiddleware` if your framework supports this:

```typescript
async injectMiddleware(
  configPath: string,
  scriptUrl: string
): Promise<string | undefined> {
  const config = await readFile(configPath, 'utf-8');

  // Modify config to inject script
  const modified = config.replace(
    'export default',
    `// DesignPort injection
import designPort from '@design-port/vite-plugin';

export default`
  );

  return modified;
}
```

If middleware injection is not supported, DesignPort falls back to Puppeteer-based script injection.

## Component Detection

For framework-specific component detection, add support in `packages/inspector/src/component-detector.ts`:

```typescript
function detectAstroComponent(element: Element): ComponentInfo | null {
  // Check for Astro-specific properties
  const astroId = element.getAttribute('data-astro-cid');
  if (!astroId) return null;

  // Extract component info from Astro's island hydration
  const islandScript = element.querySelector('astro-island');
  if (islandScript) {
    const componentUrl = islandScript.getAttribute('component-url');
    if (componentUrl) {
      const name = componentUrl.split('/').pop()?.replace('.astro', '');
      return {
        name: name || 'AstroComponent',
        framework: 'astro' as const,
        filePath: componentUrl,
      };
    }
  }

  return {
    name: 'AstroComponent',
    framework: 'unknown',
  };
}
```

## Testing Your Adapter

1. Create a test project using your framework
2. Run DesignPort against it:
   ```bash
   cd my-astro-project
   npx design-port --verbose
   ```
3. Verify:
   - Framework is detected correctly
   - Dev server starts without errors
   - Browser connects and loads the page
   - Element inspection works
   - Component detection shows correct names

## Full Example: Astro Adapter

Here's a complete Astro adapter implementation:

```typescript
// packages/server-manager/src/adapters/astro.ts

import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BaseDevServerAdapter } from './base.js';

export class AstroAdapter extends BaseDevServerAdapter {
  name = 'Astro';

  async detect(projectPath: string): Promise<boolean> {
    try {
      // Check for astro in dependencies
      const packageJson = JSON.parse(
        await readFile(join(projectPath, 'package.json'), 'utf-8')
      ) as {
        devDependencies?: Record<string, string>;
        dependencies?: Record<string, string>;
      };

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      if ('astro' in allDeps) {
        return true;
      }

      // Also check for astro.config.* file
      const configFiles = ['astro.config.mjs', 'astro.config.js', 'astro.config.ts'];
      for (const file of configFiles) {
        try {
          await access(join(projectPath, file));
          return true;
        } catch {
          // File doesn't exist, continue
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  getStartCommand(_projectPath: string): string[] {
    return ['npx', 'astro', 'dev', '--port', String(this.getDefaultPort())];
  }

  override getDefaultPort(): number {
    return 4321;
  }

  override getDevServerUrl(port: number): string {
    return `http://localhost:${port}`;
  }

  override async injectMiddleware(
    _configPath: string,
    _scriptUrl: string
  ): Promise<string | undefined> {
    // Astro supports integrations, but we'll use Puppeteer injection
    // for simplicity. Override this if you want native integration.
    return undefined;
  }
}
```

## Contributing

To contribute a new adapter to DesignPort:

1. Fork the repository
2. Create your adapter in `packages/server-manager/src/adapters/`
3. Export it from `packages/server-manager/src/index.ts`
4. Update the detector if needed
5. Add component detection support if applicable
6. Write tests
7. Submit a pull request

Please ensure your adapter:
- Handles missing/invalid configuration gracefully
- Uses reasonable default ports
- Documents any framework-specific behavior
- Includes detection for common project structures
