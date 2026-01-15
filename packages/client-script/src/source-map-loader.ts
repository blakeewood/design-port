/**
 * Source map loader for mapping transpiled locations to original source.
 * Fetches and parses source maps from the dev server.
 */

export interface OriginalLocation {
  file: string;
  line: number;
  column?: number;
}

interface SourceMapData {
  version: number;
  file?: string;
  sourceRoot?: string;
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
}

interface SourceMapCache {
  map: SourceMapData;
  decoded: DecodedMapping[];
}

interface DecodedMapping {
  generatedLine: number;
  generatedColumn: number;
  originalLine?: number;
  originalColumn?: number;
  sourceIndex?: number;
  nameIndex?: number;
}

/**
 * Loads and caches source maps for transpiled files.
 */
export class SourceMapLoader {
  private cache = new Map<string, SourceMapCache | null>();
  private pending = new Map<string, Promise<SourceMapCache | null>>();

  /**
   * Get original source location for a generated location.
   */
  async getOriginalLocation(
    generatedUrl: string,
    line: number,
    column: number
  ): Promise<OriginalLocation | null> {
    const sourceMap = await this.loadSourceMap(generatedUrl);
    if (!sourceMap) return null;

    return this.findOriginalPosition(sourceMap, line, column);
  }

  /**
   * Load and cache source map for a URL.
   */
  private async loadSourceMap(url: string): Promise<SourceMapCache | null> {
    // Check cache first
    if (this.cache.has(url)) {
      return this.cache.get(url) ?? null;
    }

    // Check if already loading
    const pending = this.pending.get(url);
    if (pending) {
      return pending;
    }

    // Start loading
    const promise = this.fetchSourceMap(url);
    this.pending.set(url, promise);

    try {
      const result = await promise;
      this.cache.set(url, result);
      return result;
    } finally {
      this.pending.delete(url);
    }
  }

  /**
   * Fetch source map from URL.
   */
  private async fetchSourceMap(url: string): Promise<SourceMapCache | null> {
    try {
      // Try inline source map first
      const inlineMap = await this.extractInlineSourceMap(url);
      if (inlineMap) {
        return {
          map: inlineMap,
          decoded: this.decodeMappings(inlineMap.mappings),
        };
      }

      // Try external source map
      const mapUrl = await this.findSourceMapUrl(url);
      if (!mapUrl) return null;

      const response = await fetch(mapUrl);
      if (!response.ok) return null;

      const map = await response.json() as SourceMapData;
      return {
        map,
        decoded: this.decodeMappings(map.mappings),
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract inline source map from script content.
   */
  private async extractInlineSourceMap(url: string): Promise<SourceMapData | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const content = await response.text();

      // Look for inline source map comment
      const inlineMatch = content.match(
        /\/\/[#@]\s*sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)/
      );

      if (inlineMatch?.[1]) {
        const decoded = atob(inlineMatch[1]);
        return JSON.parse(decoded) as SourceMapData;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Find external source map URL from script.
   */
  private async findSourceMapUrl(url: string): Promise<string | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const content = await response.text();

      // Look for sourceMappingURL comment
      const match = content.match(/\/\/[#@]\s*sourceMappingURL=([^\s'"]+)/);
      if (match?.[1]) {
        const mapPath = match[1];
        // Handle relative URLs
        if (mapPath.startsWith('http')) {
          return mapPath;
        }
        return new URL(mapPath, url).href;
      }

      // Convention: try .map suffix
      return `${url}.map`;
    } catch {
      return null;
    }
  }

  /**
   * Decode VLQ-encoded source map mappings.
   */
  private decodeMappings(mappings: string): DecodedMapping[] {
    const decoded: DecodedMapping[] = [];

    // State variables for relative decoding
    let generatedLine = 1;
    let generatedColumn = 0;
    let sourceIndex = 0;
    let originalLine = 0;
    let originalColumn = 0;
    let nameIndex = 0;

    const lines = mappings.split(';');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (!line) {
        generatedLine++;
        generatedColumn = 0;
        continue;
      }

      generatedColumn = 0;
      const segments = line.split(',');

      for (const segment of segments) {
        if (!segment) continue;

        const values = this.decodeVLQ(segment);
        if (values.length === 0) continue;

        generatedColumn += values[0] ?? 0;

        const mapping: DecodedMapping = {
          generatedLine,
          generatedColumn,
        };

        if (values.length >= 4) {
          sourceIndex += values[1] ?? 0;
          originalLine += values[2] ?? 0;
          originalColumn += values[3] ?? 0;

          mapping.sourceIndex = sourceIndex;
          mapping.originalLine = originalLine + 1; // 1-indexed
          mapping.originalColumn = originalColumn;

          if (values.length >= 5) {
            nameIndex += values[4] ?? 0;
            mapping.nameIndex = nameIndex;
          }
        }

        decoded.push(mapping);
      }

      generatedLine++;
    }

    return decoded;
  }

  /**
   * Decode a VLQ-encoded segment.
   */
  private decodeVLQ(str: string): number[] {
    const values: number[] = [];
    let shift = 0;
    let value = 0;

    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

    for (const char of str) {
      const digit = base64Chars.indexOf(char);
      if (digit === -1) continue;

      const continued = digit & 0x20;
      value += (digit & 0x1f) << shift;

      if (continued) {
        shift += 5;
      } else {
        // Sign bit is in the LSB
        const negative = value & 1;
        value >>= 1;
        values.push(negative ? -value : value);

        value = 0;
        shift = 0;
      }
    }

    return values;
  }

  /**
   * Find original position from decoded mappings.
   */
  private findOriginalPosition(
    cache: SourceMapCache,
    line: number,
    column: number
  ): OriginalLocation | null {
    const { map, decoded } = cache;

    // Binary search for the closest mapping
    let best: DecodedMapping | null = null;

    for (const mapping of decoded) {
      if (mapping.generatedLine < line) {
        continue;
      }
      if (mapping.generatedLine > line) {
        break;
      }

      // Same line - find closest column
      if (mapping.generatedColumn <= column) {
        if (!best || mapping.generatedColumn > best.generatedColumn) {
          best = mapping;
        }
      }
    }

    if (!best || best.sourceIndex === undefined || best.originalLine === undefined) {
      return null;
    }

    const source = map.sources[best.sourceIndex];
    if (!source) return null;

    // Resolve source path
    let file = source;
    if (map.sourceRoot) {
      file = map.sourceRoot + source;
    }

    const result: OriginalLocation = {
      file,
      line: best.originalLine,
    };

    if (best.originalColumn !== undefined) {
      result.column = best.originalColumn;
    }

    return result;
  }

  /**
   * Clear the cache.
   */
  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }
}

// Singleton instance
let loaderInstance: SourceMapLoader | null = null;

/**
 * Get the shared source map loader instance.
 */
export function getSourceMapLoader(): SourceMapLoader {
  if (!loaderInstance) {
    loaderInstance = new SourceMapLoader();
  }
  return loaderInstance;
}
