/**
 * Chakra UI theme parser.
 */

import createJiti from 'jiti';
import { access } from 'node:fs/promises';
import { join } from 'node:path';

export interface ChakraTokens {
  colors: Record<string, string | Record<string, string>>;
  space: Record<string, string>;
  fontSizes: Record<string, string>;
  fontWeights: Record<string, number | string>;
  radii: Record<string, string>;
  fonts: Record<string, string>;
}

interface ChakraTheme {
  colors?: Record<string, unknown>;
  space?: Record<string, string>;
  fontSizes?: Record<string, string>;
  fontWeights?: Record<string, number | string>;
  radii?: Record<string, string>;
  fonts?: Record<string, string>;
}

const THEME_FILES = [
  'src/theme.ts',
  'src/theme/index.ts',
  'src/theme.js',
  'src/theme/index.js',
  'theme.ts',
  'theme/index.ts',
  'theme.js',
  'theme/index.js',
];

export class ChakraParser {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Check if the project uses Chakra UI.
   */
  async detect(): Promise<boolean> {
    try {
      const packageJsonPath = join(this.projectPath, 'package.json');
      await access(packageJsonPath);

      const { readFile } = await import('node:fs/promises');
      const content = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      return '@chakra-ui/react' in allDeps;
    } catch {
      return false;
    }
  }

  /**
   * Parse the Chakra theme and extract design tokens.
   */
  async parse(): Promise<ChakraTokens> {
    const themePath = await this.findThemeFile();
    if (!themePath) {
      return this.getDefaultTokens();
    }

    try {
      const jiti = createJiti(this.projectPath, { interopDefault: true });
      const themeModule = jiti(themePath) as { default?: ChakraTheme } | ChakraTheme;
      const theme = 'default' in themeModule ? themeModule.default : themeModule;

      return this.extractTokens(theme as ChakraTheme);
    } catch (error) {
      console.warn(`[DesignPort] Failed to parse Chakra theme: ${error}`);
      return this.getDefaultTokens();
    }
  }

  private async findThemeFile(): Promise<string | null> {
    for (const file of THEME_FILES) {
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

  private extractTokens(theme: ChakraTheme): ChakraTokens {
    const defaults = this.getDefaultTokens();

    return {
      colors: { ...defaults.colors, ...theme.colors as Record<string, string> },
      space: { ...defaults.space, ...theme.space },
      fontSizes: { ...defaults.fontSizes, ...theme.fontSizes },
      fontWeights: { ...defaults.fontWeights, ...theme.fontWeights },
      radii: { ...defaults.radii, ...theme.radii },
      fonts: { ...defaults.fonts, ...theme.fonts },
    };
  }

  private getDefaultTokens(): ChakraTokens {
    return {
      colors: {
        transparent: 'transparent',
        current: 'currentColor',
        black: '#000000',
        white: '#FFFFFF',
        gray: {
          '50': '#F7FAFC', '100': '#EDF2F7', '200': '#E2E8F0', '300': '#CBD5E0',
          '400': '#A0AEC0', '500': '#718096', '600': '#4A5568', '700': '#2D3748',
          '800': '#1A202C', '900': '#171923',
        },
        blue: {
          '50': '#EBF8FF', '100': '#BEE3F8', '200': '#90CDF4', '300': '#63B3ED',
          '400': '#4299E1', '500': '#3182CE', '600': '#2B6CB0', '700': '#2C5282',
          '800': '#2A4365', '900': '#1A365D',
        },
      },
      space: {
        '0': '0', '1': '0.25rem', '2': '0.5rem', '3': '0.75rem', '4': '1rem',
        '5': '1.25rem', '6': '1.5rem', '7': '1.75rem', '8': '2rem', '9': '2.25rem',
        '10': '2.5rem', '12': '3rem', '14': '3.5rem', '16': '4rem', '20': '5rem',
        '24': '6rem', '28': '7rem', '32': '8rem', '36': '9rem', '40': '10rem',
      },
      fontSizes: {
        'xs': '0.75rem', 'sm': '0.875rem', 'md': '1rem', 'lg': '1.125rem',
        'xl': '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem', '4xl': '2.25rem',
        '5xl': '3rem', '6xl': '3.75rem', '7xl': '4.5rem', '8xl': '6rem', '9xl': '8rem',
      },
      fontWeights: {
        hairline: 100, thin: 200, light: 300, normal: 400,
        medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900,
      },
      radii: {
        'none': '0', 'sm': '0.125rem', 'base': '0.25rem', 'md': '0.375rem',
        'lg': '0.5rem', 'xl': '0.75rem', '2xl': '1rem', '3xl': '1.5rem', 'full': '9999px',
      },
      fonts: {
        heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        mono: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      },
    };
  }
}
