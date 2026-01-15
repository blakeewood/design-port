/**
 * Terminal output formatting for element measurements.
 */

import chalk from 'chalk';

export interface ElementSelection {
  selector: string;
  tagName: string;
  classList: string[];
  id?: string;
  bounds: { x: number; y: number; width: number; height: number };
  boxModel: {
    content: { width: number; height: number };
    padding: { top: number; right: number; bottom: number; left: number };
    border: { top: number; right: number; bottom: number; left: number };
    margin: { top: number; right: number; bottom: number; left: number };
  };
  computedStyles: Record<string, string>;
  componentName?: string;
  sourceLocation?: { file: string; line: number; column?: number };
}

export interface DesignToken {
  property: string;
  token: string;
  value: string;
  system: 'tailwind' | 'chakra' | 'css-var' | 'custom';
}

export interface FormatterOptions {
  /** Show full computed styles */
  verbose?: boolean;
  /** Use colors in output */
  colors?: boolean;
}

const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  teeRight: '├',
  teeLeft: '┤',
};

export class Formatter {
  private options: Required<FormatterOptions>;

  constructor(options: FormatterOptions = {}) {
    this.options = {
      verbose: false,
      colors: true,
      ...options,
    };
  }

  /**
   * Format an element selection for terminal display.
   */
  formatSelection(
    selection: ElementSelection,
    tokens: DesignToken[] = []
  ): string {
    const lines: string[] = [];
    const width = 55;

    // Header
    lines.push(this.header('Selected Element', width));

    // Component/Element info
    if (selection.componentName) {
      const location = selection.sourceLocation
        ? ` (${selection.sourceLocation.file}:${selection.sourceLocation.line})`
        : '';
      lines.push(this.line(`Component: ${chalk.cyan(selection.componentName)}${location}`));
    }

    // Tag with classes
    const tag = this.formatTag(selection);
    lines.push(this.line(`Tag: ${chalk.gray(tag)}`));

    // Dimensions section
    lines.push(this.separator('Dimensions', width));
    lines.push(this.line(
      `Size: ${chalk.yellow(Math.round(selection.bounds.width))}px × ${chalk.yellow(Math.round(selection.bounds.height))}px`
    ));

    const padding = this.formatSpacing(selection.boxModel.padding);
    const paddingTokens = this.findTokensForProperty(tokens, 'padding');
    lines.push(this.line(
      `Padding: ${padding}${paddingTokens ? chalk.dim(` (${paddingTokens})`) : ''}`
    ));

    const margin = this.formatSpacing(selection.boxModel.margin);
    lines.push(this.line(`Margin: ${margin}`));

    // Typography section
    lines.push(this.separator('Typography', width));
    const fontFamily = selection.computedStyles['font-family']?.split(',')[0]?.trim() ?? 'inherit';
    const fontSize = selection.computedStyles['font-size'] ?? 'inherit';
    const fontWeight = selection.computedStyles['font-weight'] ?? 'normal';
    lines.push(this.line(`Font: ${fontFamily}, ${fontSize}, weight ${fontWeight}`));

    const color = selection.computedStyles['color'];
    if (color) {
      const colorToken = this.findTokensForProperty(tokens, 'color');
      lines.push(this.line(
        `Color: ${this.formatColor(color)}${colorToken ? chalk.dim(` (${colorToken})`) : ''}`
      ));
    }

    // Background section
    const bgColor = selection.computedStyles['background-color'];
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
      lines.push(this.separator('Background', width));
      const bgToken = this.findTokensForProperty(tokens, 'background-color');
      lines.push(this.line(
        `Color: ${this.formatColor(bgColor)}${bgToken ? chalk.dim(` (${bgToken})`) : ''}`
      ));
    }

    // Design tokens section
    if (tokens.length > 0) {
      lines.push(this.separator('Design Tokens Used', width));
      for (const token of tokens.slice(0, 5)) {
        lines.push(this.line(
          `${chalk.dim(token.token)} → ${token.value}`
        ));
      }
      if (tokens.length > 5) {
        lines.push(this.line(chalk.dim(`... and ${tokens.length - 5} more`)));
      }
    }

    // Footer
    lines.push(this.footer(width));

    return lines.join('\n');
  }

  private header(title: string, width: number): string {
    const titlePart = `${BOX.topLeft}${BOX.horizontal} ${title} `;
    const remaining = width - titlePart.length;
    return chalk.gray(titlePart + BOX.horizontal.repeat(Math.max(0, remaining)));
  }

  private separator(title: string, width: number): string {
    const titlePart = `${BOX.teeRight}${BOX.horizontal} ${title} `;
    const remaining = width - titlePart.length;
    return chalk.gray(titlePart + BOX.horizontal.repeat(Math.max(0, remaining)));
  }

  private footer(width: number): string {
    return chalk.gray(BOX.bottomLeft + BOX.horizontal.repeat(width - 1));
  }

  private line(content: string): string {
    return chalk.gray(BOX.vertical) + ' ' + content;
  }

  private formatTag(selection: ElementSelection): string {
    let tag = `<${selection.tagName}`;
    if (selection.id) {
      tag += ` id="${selection.id}"`;
    }
    if (selection.classList.length > 0) {
      tag += ` class="${selection.classList.join(' ')}"`;
    }
    tag += '>';
    return tag.length > 50 ? tag.slice(0, 47) + '...' : tag;
  }

  private formatSpacing(spacing: { top: number; right: number; bottom: number; left: number }): string {
    if (spacing.top === spacing.right && spacing.right === spacing.bottom && spacing.bottom === spacing.left) {
      return `${spacing.top}px`;
    }
    if (spacing.top === spacing.bottom && spacing.left === spacing.right) {
      return `${spacing.top}px ${spacing.left}px`;
    }
    return `${spacing.top}px ${spacing.right}px ${spacing.bottom}px ${spacing.left}px`;
  }

  private formatColor(color: string): string {
    // Try to convert rgb to hex for display
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      const hex = '#' + [r, g, b].map(x => parseInt(x!, 10).toString(16).padStart(2, '0')).join('');
      return chalk.hex(hex)(hex);
    }
    return color;
  }

  private findTokensForProperty(tokens: DesignToken[], property: string): string | null {
    const matches = tokens.filter(t => t.property.includes(property));
    if (matches.length === 0) return null;
    return matches.map(t => `${t.system}: ${t.token}`).join(', ');
  }
}
