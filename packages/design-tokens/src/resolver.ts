/**
 * Token resolution engine - maps computed values to design tokens.
 */

import { wcagContrast, formatHex, parse } from 'culori';
import type { TailwindTokens } from './parsers/tailwind.js';
import type { ChakraTokens } from './parsers/chakra.js';
import type { CSSVarTokens } from './parsers/css-vars.js';

export interface TokenMatch {
  system: 'tailwind' | 'chakra' | 'css-var' | 'custom';
  token: string;
  path: string;
  value: string;
  confidence: number;
}

export interface ClassTokenMapping {
  class: string;
  property: string;
  token: string;
  value: string;
}

interface ColorIndex {
  hex: string;
  token: string;
  system: 'tailwind' | 'chakra' | 'css-var';
}

export class TokenResolver {
  private colorIndex: ColorIndex[] = [];
  private spacingIndex: Map<string, { token: string; system: string }> = new Map();
  private fontSizeIndex: Map<string, { token: string; system: string }> = new Map();

  /**
   * Index tokens from Tailwind config.
   */
  indexTailwind(tokens: TailwindTokens): void {
    // Index colors
    this.indexColors(tokens.colors, 'tailwind', 'colors');

    // Index spacing
    for (const [key, value] of Object.entries(tokens.spacing)) {
      this.spacingIndex.set(this.normalizeSpacing(value), {
        token: `spacing.${key}`,
        system: 'tailwind',
      });
    }

    // Index font sizes
    for (const [key, value] of Object.entries(tokens.fontSize)) {
      const size = typeof value === 'string' ? value : value[0];
      this.fontSizeIndex.set(this.normalizeSpacing(size), {
        token: `fontSize.${key}`,
        system: 'tailwind',
      });
    }
  }

  /**
   * Index tokens from Chakra theme.
   */
  indexChakra(tokens: ChakraTokens): void {
    this.indexColors(tokens.colors, 'chakra', 'colors');

    for (const [key, value] of Object.entries(tokens.space)) {
      this.spacingIndex.set(this.normalizeSpacing(value), {
        token: `space.${key}`,
        system: 'chakra',
      });
    }

    for (const [key, value] of Object.entries(tokens.fontSizes)) {
      this.fontSizeIndex.set(this.normalizeSpacing(value), {
        token: `fontSizes.${key}`,
        system: 'chakra',
      });
    }
  }

  /**
   * Index CSS custom properties.
   */
  indexCSSVars(tokens: CSSVarTokens): void {
    for (const [name, value] of tokens.variables) {
      // Try to parse as color
      const parsed = parse(value);
      if (parsed) {
        const hex = formatHex(parsed);
        if (hex) {
          this.colorIndex.push({
            hex,
            token: name,
            system: 'css-var',
          });
        }
      }
    }
  }

  /**
   * Resolve a color value to matching tokens.
   */
  resolveColor(color: string): TokenMatch[] {
    const parsed = parse(color);
    if (!parsed) return [];

    const targetHex = formatHex(parsed)?.toLowerCase();
    if (!targetHex) return [];

    const matches: TokenMatch[] = [];

    for (const { hex, token, system } of this.colorIndex) {
      if (hex.toLowerCase() === targetHex) {
        matches.push({
          system,
          token,
          path: token,
          value: hex,
          confidence: 1,
        });
      }
    }

    // If no exact match, find closest colors
    if (matches.length === 0) {
      const candidates: Array<{ index: ColorIndex; distance: number }> = [];

      for (const indexEntry of this.colorIndex) {
        const indexParsed = parse(indexEntry.hex);
        if (indexParsed) {
          // Use contrast ratio as a proxy for color difference
          const contrast = wcagContrast(parsed, indexParsed);
          // Lower contrast = more similar colors
          const distance = Math.abs(contrast - 1);
          candidates.push({ index: indexEntry, distance });
        }
      }

      // Sort by distance and take top 3
      candidates.sort((a, b) => a.distance - b.distance);
      for (const { index, distance } of candidates.slice(0, 3)) {
        const confidence = Math.max(0, 1 - distance / 10);
        if (confidence > 0.5) {
          matches.push({
            system: index.system,
            token: index.token,
            path: index.token,
            value: index.hex,
            confidence,
          });
        }
      }
    }

    return matches;
  }

  /**
   * Resolve a spacing value to matching tokens.
   */
  resolveSpacing(value: string): TokenMatch[] {
    const normalized = this.normalizeSpacing(value);
    const match = this.spacingIndex.get(normalized);

    if (match) {
      return [{
        system: match.system as 'tailwind' | 'chakra',
        token: match.token,
        path: match.token,
        value: normalized,
        confidence: 1,
      }];
    }

    return [];
  }

  /**
   * Resolve a font size to matching tokens.
   */
  resolveFontSize(value: string): TokenMatch[] {
    const normalized = this.normalizeSpacing(value);
    const match = this.fontSizeIndex.get(normalized);

    if (match) {
      return [{
        system: match.system as 'tailwind' | 'chakra',
        token: match.token,
        path: match.token,
        value: normalized,
        confidence: 1,
      }];
    }

    return [];
  }

  /**
   * Clear all indexed tokens.
   */
  clear(): void {
    this.colorIndex = [];
    this.spacingIndex.clear();
    this.fontSizeIndex.clear();
  }

  private indexColors(
    colors: Record<string, string | Record<string, string>>,
    system: 'tailwind' | 'chakra' | 'css-var',
    prefix: string
  ): void {
    for (const [key, value] of Object.entries(colors)) {
      if (typeof value === 'string') {
        const parsed = parse(value);
        if (parsed) {
          const hex = formatHex(parsed);
          if (hex) {
            this.colorIndex.push({
              hex,
              token: `${prefix}.${key}`,
              system,
            });
          }
        }
      } else if (typeof value === 'object') {
        // Nested color (e.g., blue.500)
        for (const [shade, shadeValue] of Object.entries(value)) {
          const parsed = parse(shadeValue);
          if (parsed) {
            const hex = formatHex(parsed);
            if (hex) {
              this.colorIndex.push({
                hex,
                token: `${prefix}.${key}.${shade}`,
                system,
              });
            }
          }
        }
      }
    }
  }

  private normalizeSpacing(value: string): string {
    // Normalize to px for comparison
    const num = parseFloat(value);
    if (isNaN(num)) return value;

    if (value.endsWith('rem')) {
      return `${num * 16}px`;
    }
    if (value.endsWith('em')) {
      return `${num * 16}px`;
    }
    if (value.endsWith('px')) {
      return value;
    }
    if (!isNaN(num) && !value.includes('px')) {
      return `${num}px`;
    }

    return value;
  }
}
