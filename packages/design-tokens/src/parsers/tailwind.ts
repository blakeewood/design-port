/**
 * Tailwind CSS configuration parser.
 */

import createJiti from 'jiti';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

export interface TailwindTokens {
  colors: Record<string, string | Record<string, string>>;
  spacing: Record<string, string>;
  fontSize: Record<string, string | [string, { lineHeight?: string }]>;
  fontWeight: Record<string, string>;
  borderRadius: Record<string, string>;
  fontFamily: Record<string, string[]>;
}

interface TailwindConfig {
  theme?: {
    colors?: Record<string, unknown>;
    spacing?: Record<string, string>;
    fontSize?: Record<string, unknown>;
    fontWeight?: Record<string, string>;
    borderRadius?: Record<string, string>;
    fontFamily?: Record<string, string[]>;
    extend?: {
      colors?: Record<string, unknown>;
      spacing?: Record<string, string>;
      fontSize?: Record<string, unknown>;
      fontWeight?: Record<string, string>;
      borderRadius?: Record<string, string>;
      fontFamily?: Record<string, string[]>;
    };
  };
}

const CONFIG_FILES = [
  'tailwind.config.ts',
  'tailwind.config.js',
  'tailwind.config.mjs',
  'tailwind.config.cjs',
];

export class TailwindParser {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Check if the project uses Tailwind CSS.
   */
  async detect(): Promise<boolean> {
    for (const file of CONFIG_FILES) {
      try {
        await access(join(this.projectPath, file));
        return true;
      } catch {
        // File doesn't exist
      }
    }
    return false;
  }

  /**
   * Parse the Tailwind configuration and extract design tokens.
   */
  async parse(): Promise<TailwindTokens> {
    const configPath = await this.findConfigFile();
    if (!configPath) {
      return this.getDefaultTokens();
    }

    try {
      const jiti = createJiti(this.projectPath, { interopDefault: true });
      const config = jiti(configPath) as TailwindConfig;

      return this.extractTokens(config);
    } catch (error) {
      console.warn(`[DesignPort] Failed to parse Tailwind config: ${error}`);
      return this.getDefaultTokens();
    }
  }

  /**
   * Parse a Tailwind class name to extract token information.
   */
  parseClassName(className: string): { property: string; token: string; value?: string } | null {
    // Remove variants (hover:, md:, etc.)
    const baseName = className.split(':').pop() ?? className;

    // Common patterns
    const patterns: Array<{
      regex: RegExp;
      property: string;
      tokenPrefix: string;
    }> = [
      { regex: /^p([xytrbl])?-(\[.+\]|\d+|px)$/, property: 'padding', tokenPrefix: 'spacing' },
      { regex: /^m([xytrbl])?-(\[.+\]|\d+|px|auto)$/, property: 'margin', tokenPrefix: 'spacing' },
      { regex: /^gap-(\[.+\]|\d+|px)$/, property: 'gap', tokenPrefix: 'spacing' },
      { regex: /^w-(\[.+\]|\d+|full|screen|auto)$/, property: 'width', tokenPrefix: 'spacing' },
      { regex: /^h-(\[.+\]|\d+|full|screen|auto)$/, property: 'height', tokenPrefix: 'spacing' },
      { regex: /^bg-(.+)$/, property: 'background-color', tokenPrefix: 'colors' },
      { regex: /^text-(.+)$/, property: 'color', tokenPrefix: 'colors' },
      { regex: /^border-(.+)$/, property: 'border-color', tokenPrefix: 'colors' },
      { regex: /^font-(sans|serif|mono|.+)$/, property: 'font-family', tokenPrefix: 'fontFamily' },
      { regex: /^text-(xs|sm|base|lg|xl|.+)$/, property: 'font-size', tokenPrefix: 'fontSize' },
      { regex: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, property: 'font-weight', tokenPrefix: 'fontWeight' },
      { regex: /^rounded(-[a-z]+)?(-\w+)?$/, property: 'border-radius', tokenPrefix: 'borderRadius' },
    ];

    for (const { regex, property, tokenPrefix } of patterns) {
      const match = baseName.match(regex);
      if (match) {
        const tokenValue = match[1] || match[2] || baseName;
        return {
          property,
          token: `${tokenPrefix}.${tokenValue}`,
        };
      }
    }

    return null;
  }

  private async findConfigFile(): Promise<string | null> {
    for (const file of CONFIG_FILES) {
      const fullPath = join(this.projectPath, file);
      try {
        await access(fullPath);
        return fullPath;
      } catch {
        // File doesn't exist
      }
    }
    return null;
  }

  private extractTokens(config: TailwindConfig): TailwindTokens {
    const defaults = this.getDefaultTokens();
    const theme = config.theme ?? {};
    const extend = theme.extend ?? {};

    return {
      colors: this.mergeTokens(defaults.colors, theme.colors as Record<string, string>, extend.colors as Record<string, string>),
      spacing: this.mergeTokens(defaults.spacing, theme.spacing, extend.spacing),
      fontSize: this.mergeTokens(defaults.fontSize, theme.fontSize as Record<string, string>, extend.fontSize as Record<string, string>),
      fontWeight: this.mergeTokens(defaults.fontWeight, theme.fontWeight, extend.fontWeight),
      borderRadius: this.mergeTokens(defaults.borderRadius, theme.borderRadius, extend.borderRadius),
      fontFamily: this.mergeTokens(defaults.fontFamily, theme.fontFamily, extend.fontFamily),
    };
  }

  private mergeTokens<T extends Record<string, unknown>>(
    defaults: T,
    theme?: T,
    extend?: T
  ): T {
    if (theme) {
      // Theme replaces defaults
      return { ...theme, ...extend } as T;
    }
    // Extend adds to defaults
    return { ...defaults, ...extend } as T;
  }

  private getDefaultTokens(): TailwindTokens {
    return {
      colors: {
        transparent: 'transparent',
        current: 'currentColor',
        black: '#000',
        white: '#fff',
        slate: { '50': '#f8fafc', '100': '#f1f5f9', '200': '#e2e8f0', '300': '#cbd5e1', '400': '#94a3b8', '500': '#64748b', '600': '#475569', '700': '#334155', '800': '#1e293b', '900': '#0f172a', '950': '#020617' },
        gray: { '50': '#f9fafb', '100': '#f3f4f6', '200': '#e5e7eb', '300': '#d1d5db', '400': '#9ca3af', '500': '#6b7280', '600': '#4b5563', '700': '#374151', '800': '#1f2937', '900': '#111827', '950': '#030712' },
        red: { '50': '#fef2f2', '100': '#fee2e2', '200': '#fecaca', '300': '#fca5a5', '400': '#f87171', '500': '#ef4444', '600': '#dc2626', '700': '#b91c1c', '800': '#991b1b', '900': '#7f1d1d', '950': '#450a0a' },
        blue: { '50': '#eff6ff', '100': '#dbeafe', '200': '#bfdbfe', '300': '#93c5fd', '400': '#60a5fa', '500': '#3b82f6', '600': '#2563eb', '700': '#1d4ed8', '800': '#1e40af', '900': '#1e3a8a', '950': '#172554' },
        green: { '50': '#f0fdf4', '100': '#dcfce7', '200': '#bbf7d0', '300': '#86efac', '400': '#4ade80', '500': '#22c55e', '600': '#16a34a', '700': '#15803d', '800': '#166534', '900': '#14532d', '950': '#052e16' },
      },
      spacing: {
        '0': '0px', 'px': '1px', '0.5': '0.125rem', '1': '0.25rem', '1.5': '0.375rem',
        '2': '0.5rem', '2.5': '0.625rem', '3': '0.75rem', '3.5': '0.875rem', '4': '1rem',
        '5': '1.25rem', '6': '1.5rem', '7': '1.75rem', '8': '2rem', '9': '2.25rem',
        '10': '2.5rem', '11': '2.75rem', '12': '3rem', '14': '3.5rem', '16': '4rem',
        '20': '5rem', '24': '6rem', '28': '7rem', '32': '8rem', '36': '9rem',
        '40': '10rem', '44': '11rem', '48': '12rem', '52': '13rem', '56': '14rem',
        '60': '15rem', '64': '16rem', '72': '18rem', '80': '20rem', '96': '24rem',
      },
      fontSize: {
        'xs': '0.75rem', 'sm': '0.875rem', 'base': '1rem', 'lg': '1.125rem',
        'xl': '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem',
        '5xl': '3rem', '6xl': '3.75rem', '7xl': '4.5rem', '8xl': '6rem', '9xl': '8rem',
      },
      fontWeight: {
        thin: '100', extralight: '200', light: '300', normal: '400',
        medium: '500', semibold: '600', bold: '700', extrabold: '800', black: '900',
      },
      borderRadius: {
        'none': '0px', 'sm': '0.125rem', 'DEFAULT': '0.25rem', 'md': '0.375rem',
        'lg': '0.5rem', 'xl': '0.75rem', '2xl': '1rem', '3xl': '1.5rem', 'full': '9999px',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['ui-serif', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    };
  }
}
