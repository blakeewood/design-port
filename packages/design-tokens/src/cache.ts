/**
 * Token cache with file watching for invalidation.
 */

import { watch, type FSWatcher } from 'node:fs';
import { TailwindParser, type TailwindTokens } from './parsers/tailwind.js';
import { ChakraParser, type ChakraTokens } from './parsers/chakra.js';
import { CSSVarsParser, type CSSVarTokens } from './parsers/css-vars.js';
import { TokenResolver } from './resolver.js';

export interface CachedTokens {
  tailwind?: TailwindTokens;
  chakra?: ChakraTokens;
  cssVars?: CSSVarTokens;
  lastUpdated: Date;
}

export class TokenCache {
  private projectPath: string;
  private cache: CachedTokens | null = null;
  private resolver: TokenResolver;
  private watchers: FSWatcher[] = [];
  private onInvalidate?: () => void;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.resolver = new TokenResolver();
  }

  /**
   * Initialize the cache by parsing all design tokens.
   */
  async initialize(): Promise<CachedTokens> {
    await this.refresh();
    return this.cache!;
  }

  /**
   * Get the current cached tokens.
   */
  getTokens(): CachedTokens | null {
    return this.cache;
  }

  /**
   * Get the token resolver.
   */
  getResolver(): TokenResolver {
    return this.resolver;
  }

  /**
   * Refresh the cache by re-parsing all tokens.
   */
  async refresh(): Promise<void> {
    this.resolver.clear();

    const tailwindParser = new TailwindParser(this.projectPath);
    const chakraParser = new ChakraParser(this.projectPath);
    const cssVarsParser = new CSSVarsParser(this.projectPath);

    const cache: CachedTokens = {
      lastUpdated: new Date(),
    };

    // Parse Tailwind
    if (await tailwindParser.detect()) {
      cache.tailwind = await tailwindParser.parse();
      this.resolver.indexTailwind(cache.tailwind);
    }

    // Parse Chakra
    if (await chakraParser.detect()) {
      cache.chakra = await chakraParser.parse();
      this.resolver.indexChakra(cache.chakra);
    }

    // Parse CSS variables
    if (await cssVarsParser.detect()) {
      cache.cssVars = await cssVarsParser.parse();
      this.resolver.indexCSSVars(cache.cssVars);
    }

    this.cache = cache;
  }

  /**
   * Start watching config files for changes.
   */
  startWatching(onInvalidate?: () => void): void {
    this.onInvalidate = onInvalidate;
    this.stopWatching(); // Clear any existing watchers

    const filesToWatch = [
      'tailwind.config.ts',
      'tailwind.config.js',
      'tailwind.config.mjs',
      'tailwind.config.cjs',
      'src/theme.ts',
      'src/theme/index.ts',
      'src/theme.js',
      'src/styles/globals.css',
      'src/app/globals.css',
    ];

    for (const file of filesToWatch) {
      try {
        const watcher = watch(
          `${this.projectPath}/${file}`,
          { persistent: false },
          (eventType) => {
            if (eventType === 'change') {
              this.handleFileChange();
            }
          }
        );
        this.watchers.push(watcher);
      } catch {
        // File doesn't exist, skip
      }
    }
  }

  /**
   * Stop watching for file changes.
   */
  stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }

  /**
   * Get a summary of detected design systems.
   */
  getSummary(): string[] {
    const systems: string[] = [];

    if (this.cache?.tailwind) {
      const colorCount = Object.keys(this.cache.tailwind.colors).length;
      systems.push(`Tailwind CSS (${colorCount} color families)`);
    }

    if (this.cache?.chakra) {
      systems.push('Chakra UI');
    }

    if (this.cache?.cssVars) {
      const varCount = this.cache.cssVars.variables.size;
      systems.push(`CSS Variables (${varCount} custom properties)`);
    }

    return systems;
  }

  private handleFileChange(): void {
    // Debounce rapid changes
    setTimeout(async () => {
      await this.refresh();
      this.onInvalidate?.();
    }, 100);
  }
}
