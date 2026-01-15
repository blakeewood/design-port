/**
 * Terminal output formatting for element measurements.
 * Provides rich display of design tokens, CSS variables, and accessibility info.
 */

import chalk from 'chalk';

export interface CSSVariableUsage {
  /** CSS property using the variable */
  property: string;
  /** Variable name (e.g., --primary-500) */
  variable: string;
  /** Resolved value */
  resolvedValue: string;
}

export interface TailwindClassInfo {
  /** Original class name */
  className: string;
  /** CSS property it affects */
  property: string;
  /** Variant prefix (hover:, md:, etc.) */
  variant?: string;
  /** Token path (e.g., colors.blue.500) */
  tokenPath?: string;
  /** Whether it's an arbitrary value */
  isArbitrary: boolean;
}

export interface AccessibilityInfo {
  role?: string;
  label?: string;
  description?: string;
}

export interface ElementSelection {
  selector: string;
  tagName: string;
  classList: string[];
  id?: string;
  /** Element attributes (data-*, aria-*, etc.) */
  attributes?: Record<string, string>;
  bounds: { x: number; y: number; width: number; height: number };
  boxModel: {
    content: { width: number; height: number };
    padding: { top: number; right: number; bottom: number; left: number };
    border: { top: number; right: number; bottom: number; left: number };
    margin: { top: number; right: number; bottom: number; left: number };
  };
  computedStyles: Record<string, string>;
  /** CSS variables used by this element */
  cssVariables?: CSSVariableUsage[];
  /** Tailwind classes parsed into tokens */
  tailwindClasses?: TailwindClassInfo[];
  componentName?: string;
  sourceLocation?: { file: string; line: number; column?: number };
  /** Accessibility information */
  accessibility?: AccessibilityInfo;
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
  /** Show accessibility information */
  showAccessibility?: boolean;
  /** Maximum Tailwind classes to show */
  maxTailwindClasses?: number;
  /** Maximum CSS variables to show */
  maxCssVariables?: number;
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
      showAccessibility: true,
      maxTailwindClasses: 10,
      maxCssVariables: 8,
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
    const width = 60;

    // Header
    lines.push(this.header('Selected Element', width));

    // Component/Element info
    if (selection.componentName) {
      const location = selection.sourceLocation
        ? chalk.dim(` ${this.formatSourceLocation(selection.sourceLocation)}`)
        : '';
      lines.push(this.line(`Component: ${chalk.cyan(`<${selection.componentName}>`)}${location}`));
    }

    // Tag with classes
    const tag = this.formatTag(selection);
    lines.push(this.line(`Element: ${chalk.gray(tag)}`));

    // Selector
    lines.push(this.line(`Selector: ${chalk.dim(this.truncate(selection.selector, 50))}`));

    // Dimensions section
    lines.push(this.separator('Box Model', width));
    lines.push(this.line(
      `Size: ${chalk.yellow(Math.round(selection.bounds.width))}px × ${chalk.yellow(Math.round(selection.bounds.height))}px`
    ));
    lines.push(this.line(
      `Position: ${chalk.dim(`x: ${Math.round(selection.bounds.x)}, y: ${Math.round(selection.bounds.y)}`)}`
    ));

    const padding = this.formatSpacing(selection.boxModel.padding);
    const paddingTokens = this.findTokensForProperty(tokens, 'padding');
    lines.push(this.line(
      `Padding: ${chalk.green(padding)}${paddingTokens ? chalk.dim(` → ${paddingTokens}`) : ''}`
    ));

    const margin = this.formatSpacing(selection.boxModel.margin);
    const marginTokens = this.findTokensForProperty(tokens, 'margin');
    lines.push(this.line(
      `Margin: ${chalk.yellow(margin)}${marginTokens ? chalk.dim(` → ${marginTokens}`) : ''}`
    ));

    if (this.hasNonZeroBorder(selection.boxModel.border)) {
      const border = this.formatSpacing(selection.boxModel.border);
      lines.push(this.line(`Border: ${chalk.cyan(border)}`));
    }

    // Typography section
    lines.push(this.separator('Typography', width));
    const fontFamily = selection.computedStyles['font-family']?.split(',')[0]?.trim().replace(/['"]/g, '') ?? 'inherit';
    const fontSize = selection.computedStyles['font-size'] ?? 'inherit';
    const fontWeight = selection.computedStyles['font-weight'] ?? 'normal';
    const lineHeight = selection.computedStyles['line-height'] ?? 'normal';
    lines.push(this.line(`Font: ${chalk.white(fontFamily)} ${fontSize} / ${lineHeight}`));
    lines.push(this.line(`Weight: ${fontWeight}`));

    const color = selection.computedStyles['color'];
    if (color) {
      const colorToken = this.findTokensForProperty(tokens, 'color');
      lines.push(this.line(
        `Color: ${this.formatColor(color)}${colorToken ? chalk.dim(` → ${colorToken}`) : ''}`
      ));
    }

    // Background section
    const bgColor = selection.computedStyles['background-color'];
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      lines.push(this.separator('Background', width));
      const bgToken = this.findTokensForProperty(tokens, 'background-color');
      lines.push(this.line(
        `Color: ${this.formatColor(bgColor)}${bgToken ? chalk.dim(` → ${bgToken}`) : ''}`
      ));
    }

    // Tailwind Classes section
    if (selection.tailwindClasses && selection.tailwindClasses.length > 0) {
      lines.push(this.separator('Tailwind Classes', width));
      lines.push(...this.formatTailwindClasses(selection.tailwindClasses));
    }

    // CSS Variables section
    if (selection.cssVariables && selection.cssVariables.length > 0) {
      lines.push(this.separator('CSS Variables', width));
      lines.push(...this.formatCSSVariables(selection.cssVariables));
    }

    // Design tokens section (from resolver)
    if (tokens.length > 0) {
      lines.push(this.separator('Resolved Design Tokens', width));
      for (const token of tokens.slice(0, 6)) {
        const systemBadge = this.getSystemBadge(token.system);
        lines.push(this.line(
          `${systemBadge} ${chalk.cyan(token.token)} → ${token.value}`
        ));
      }
      if (tokens.length > 6) {
        lines.push(this.line(chalk.dim(`... and ${tokens.length - 6} more`)));
      }
    }

    // Accessibility section
    if (this.options.showAccessibility && selection.accessibility) {
      const a11y = selection.accessibility;
      if (a11y.role || a11y.label || a11y.description) {
        lines.push(this.separator('Accessibility', width));
        if (a11y.role) {
          lines.push(this.line(`Role: ${chalk.magenta(a11y.role)}`));
        }
        if (a11y.label) {
          lines.push(this.line(`Label: ${this.truncate(a11y.label, 45)}`));
        }
        if (a11y.description) {
          lines.push(this.line(`Description: ${this.truncate(a11y.description, 40)}`));
        }
      }
    }

    // Layout info (verbose mode)
    if (this.options.verbose) {
      lines.push(this.separator('Layout', width));
      const display = selection.computedStyles['display'];
      const position = selection.computedStyles['position'];
      if (display) lines.push(this.line(`Display: ${display}`));
      if (position && position !== 'static') lines.push(this.line(`Position: ${position}`));

      if (display === 'flex' || display === 'inline-flex') {
        const dir = selection.computedStyles['flex-direction'];
        const justify = selection.computedStyles['justify-content'];
        const align = selection.computedStyles['align-items'];
        const gap = selection.computedStyles['gap'];
        if (dir) lines.push(this.line(`  Direction: ${dir}`));
        if (justify) lines.push(this.line(`  Justify: ${justify}`));
        if (align) lines.push(this.line(`  Align: ${align}`));
        if (gap) lines.push(this.line(`  Gap: ${gap}`));
      }

      if (display === 'grid' || display === 'inline-grid') {
        const cols = selection.computedStyles['grid-template-columns'];
        const rows = selection.computedStyles['grid-template-rows'];
        if (cols) lines.push(this.line(`  Columns: ${this.truncate(cols, 40)}`));
        if (rows) lines.push(this.line(`  Rows: ${this.truncate(rows, 40)}`));
      }
    }

    // Footer
    lines.push(this.footer(width));

    return lines.join('\n');
  }

  /**
   * Format a compact summary for quick display.
   */
  formatCompact(selection: ElementSelection): string {
    const size = `${Math.round(selection.bounds.width)}×${Math.round(selection.bounds.height)}`;
    const component = selection.componentName ? chalk.cyan(`<${selection.componentName}>`) : '';
    const tag = chalk.gray(`<${selection.tagName}>`);
    const element = component || tag;

    return `${element} ${chalk.yellow(size)}px`;
  }

  /**
   * Format Tailwind classes with grouping by property type.
   */
  private formatTailwindClasses(classes: TailwindClassInfo[]): string[] {
    const lines: string[] = [];
    const max = this.options.maxTailwindClasses;

    // Group by property category
    const spacing = classes.filter(c => c.property.includes('padding') || c.property.includes('margin') || c.property === 'gap');
    const sizing = classes.filter(c => c.property.includes('width') || c.property.includes('height'));
    const colors = classes.filter(c => c.property.includes('color') || c.property.includes('background'));
    const typography = classes.filter(c => c.property.includes('font') || c.property.includes('leading') || c.property.includes('tracking'));
    const layout = classes.filter(c => ['display', 'position', 'flex-direction', 'justify-content', 'align-items'].includes(c.property));
    const other = classes.filter(c => !spacing.includes(c) && !sizing.includes(c) && !colors.includes(c) && !typography.includes(c) && !layout.includes(c));

    let count = 0;
    const addGroup = (name: string, items: TailwindClassInfo[]) => {
      if (items.length === 0 || count >= max) return;
      const classNames = items
        .slice(0, max - count)
        .map(c => {
          const variant = c.variant ? chalk.dim(`${c.variant}:`) : '';
          const arbitrary = c.isArbitrary ? chalk.yellow(c.className) : chalk.green(c.className);
          return `${variant}${arbitrary}`;
        });
      count += classNames.length;
      lines.push(this.line(`${chalk.dim(name + ':')} ${classNames.join(' ')}`));
    };

    addGroup('Spacing', spacing);
    addGroup('Size', sizing);
    addGroup('Color', colors);
    addGroup('Type', typography);
    addGroup('Layout', layout);
    addGroup('Other', other);

    if (classes.length > max) {
      lines.push(this.line(chalk.dim(`... and ${classes.length - max} more classes`)));
    }

    return lines;
  }

  /**
   * Format CSS variable usages.
   */
  private formatCSSVariables(variables: CSSVariableUsage[]): string[] {
    const lines: string[] = [];
    const max = this.options.maxCssVariables;

    for (const v of variables.slice(0, max)) {
      const varName = chalk.cyan(v.variable);
      const value = this.formatCSSValue(v.resolvedValue);
      lines.push(this.line(`${varName} → ${value}`));
      lines.push(this.line(chalk.dim(`  used in: ${v.property}`)));
    }

    if (variables.length > max) {
      lines.push(this.line(chalk.dim(`... and ${variables.length - max} more variables`)));
    }

    return lines;
  }

  /**
   * Format a CSS value with color preview if applicable.
   */
  private formatCSSValue(value: string): string {
    // Check if it's a color value
    if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) {
      return this.formatColor(value);
    }
    return value;
  }

  /**
   * Get a badge for the design system.
   */
  private getSystemBadge(system: DesignToken['system']): string {
    switch (system) {
      case 'tailwind': return chalk.bgBlue.white(' TW ');
      case 'chakra': return chalk.bgGreen.white(' CK ');
      case 'css-var': return chalk.bgMagenta.white(' CSS ');
      default: return chalk.bgGray.white(' -- ');
    }
  }

  /**
   * Format source location.
   */
  private formatSourceLocation(loc: { file: string; line: number; column?: number }): string {
    const file = loc.file.split('/').pop() || loc.file;
    return `${file}:${loc.line}${loc.column ? `:${loc.column}` : ''}`;
  }

  /**
   * Truncate string with ellipsis.
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  }

  /**
   * Check if border has any non-zero values.
   */
  private hasNonZeroBorder(border: { top: number; right: number; bottom: number; left: number }): boolean {
    return border.top > 0 || border.right > 0 || border.bottom > 0 || border.left > 0;
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
