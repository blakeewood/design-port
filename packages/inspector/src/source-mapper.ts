/**
 * Source code mapping utilities.
 */

import { SourceMapConsumer, type RawSourceMap } from 'source-map';

export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
}

export class SourceMapper {
  private sourceMapCache = new Map<string, SourceMapConsumer>();

  /**
   * Load and cache a source map.
   */
  async loadSourceMap(url: string, sourceMap: RawSourceMap): Promise<void> {
    const consumer = await new SourceMapConsumer(sourceMap);
    this.sourceMapCache.set(url, consumer);
  }

  /**
   * Map a generated position to original source.
   */
  getOriginalLocation(
    generatedUrl: string,
    line: number,
    column: number
  ): SourceLocation | null {
    const consumer = this.sourceMapCache.get(generatedUrl);
    if (!consumer) {
      return null;
    }

    const original = consumer.originalPositionFor({ line, column });
    if (!original.source) {
      return null;
    }

    const result: SourceLocation = {
      file: original.source,
      line: original.line ?? 1,
    };
    if (original.column != null) {
      result.column = original.column;
    }
    return result;
  }

  /**
   * Clean up source map consumers.
   */
  destroy(): void {
    for (const consumer of this.sourceMapCache.values()) {
      consumer.destroy();
    }
    this.sourceMapCache.clear();
  }
}

/**
 * Extract React component name from an element using React DevTools internals.
 * Note: This runs in the browser context.
 */
export function getReactComponentName(element: Element): string | null {
  // Look for React fiber
  const fiberKey = Object.keys(element).find(
    (key) =>
      key.startsWith('__reactFiber$') ||
      key.startsWith('__reactInternalInstance$')
  );

  if (!fiberKey) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fiber = (element as any)[fiberKey];

  while (fiber) {
    const type = fiber.type;
    if (type) {
      const name = type.displayName || type.name;
      if (name && typeof name === 'string') {
        return name;
      }
    }
    fiber = fiber.return;
  }

  return null;
}

/**
 * Extract Vue component name from an element.
 * Note: This runs in the browser context.
 */
export function getVueComponentName(element: Element): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vueInstance = (element as any).__vue__;
  if (!vueInstance) {
    return null;
  }

  return (
    vueInstance.$options?.name ||
    vueInstance.$options?._componentTag ||
    null
  );
}

/**
 * Try to get component name from any supported framework.
 */
export function getComponentName(element: Element): string | null {
  return getReactComponentName(element) || getVueComponentName(element);
}
