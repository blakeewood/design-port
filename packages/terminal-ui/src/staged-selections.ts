/**
 * Selected Elements Panel - Dynamic terminal panel for element selections.
 * Updates in place using ANSI escape codes without flickering.
 */

import chalk from 'chalk';

export interface SelectedElement {
  /** Unique ID for this selection */
  id: string;
  /** CSS selector for the element */
  selector: string;
  /** Short display text (e.g., "Button.primary") */
  summary: string;
  /** React/Vue/Svelte component name if detected */
  componentName?: string;
  /** Element tag name */
  tagName: string;
  /** Element dimensions */
  dimensions?: { width: number; height: number };
  /** Box model (padding and margin) */
  boxModel?: {
    padding: { top: number; right: number; bottom: number; left: number };
    margin: { top: number; right: number; bottom: number; left: number };
  };
  /** Element classes */
  classes?: string[];
  /** Font information */
  font?: {
    family: string;
    size: string;
    weight: string;
  };
  /** Implicit ARIA role */
  role?: string;
  /** Source file location */
  sourceLocation?: { file: string; line: number };
  /** When this element was selected */
  timestamp: number;
}

export interface SelectedElementsOptions {
  /** Maximum selections to track (default: 5) */
  maxSelections?: number;
  /** Panel width in characters (default: 50) */
  panelWidth?: number;
  /** Show expanded details when <= this many items (default: 3) */
  expandThreshold?: number;
}

type SelectionListener = (selections: SelectedElement[]) => void;

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

export class SelectedElementsManager {
  private selections: SelectedElement[] = [];
  private listeners: Set<SelectionListener> = new Set();
  private options: Required<SelectedElementsOptions>;
  private lastPanelHeight: number = 0;
  private isRendered: boolean = false;

  constructor(options: SelectedElementsOptions = {}) {
    this.options = {
      maxSelections: options.maxSelections ?? 5,
      panelWidth: options.panelWidth ?? 50,
      expandThreshold: options.expandThreshold ?? 3,
    };
  }

  /**
   * Add or toggle a selection.
   * If element with same ID exists, it's removed (toggle behavior).
   */
  toggle(selection: SelectedElement): boolean {
    const existingIndex = this.selections.findIndex(s => s.id === selection.id);

    if (existingIndex >= 0) {
      // Remove existing selection
      this.selections.splice(existingIndex, 1);
      this.notifyListeners();
      return false; // Was removed
    } else {
      // Add new selection
      this.add(selection);
      return true; // Was added
    }
  }

  /**
   * Add a selection to the staged list.
   */
  add(selection: SelectedElement): void {
    // Remove if already exists (by ID)
    this.selections = this.selections.filter(s => s.id !== selection.id);

    // Add to end
    this.selections.push(selection);

    // Trim to max
    if (this.selections.length > this.options.maxSelections) {
      this.selections = this.selections.slice(-this.options.maxSelections);
    }

    this.notifyListeners();
  }

  /**
   * Remove a selection by ID.
   */
  remove(id: string): boolean {
    const lengthBefore = this.selections.length;
    this.selections = this.selections.filter(s => s.id !== id);

    if (this.selections.length !== lengthBefore) {
      this.notifyListeners();
      return true;
    }
    return false;
  }

  /**
   * Clear all selections.
   */
  clear(): void {
    if (this.selections.length > 0) {
      this.selections = [];
      this.notifyListeners();
    }
  }

  /**
   * Get all current selections.
   */
  getSelections(): readonly SelectedElement[] {
    return this.selections;
  }

  /**
   * Get selection count.
   */
  get count(): number {
    return this.selections.length;
  }

  /**
   * Check if empty.
   */
  get isEmpty(): boolean {
    return this.selections.length === 0;
  }

  /**
   * Subscribe to selection changes.
   */
  subscribe(listener: SelectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Format selections as context for Claude.
   */
  formatContext(): string {
    if (this.selections.length === 0) {
      return '';
    }

    const lines: string[] = [];
    lines.push('--- Context: Selected Elements ---');

    this.selections.forEach((sel, index) => {
      const name = sel.componentName || `<${sel.tagName}>`;
      const location = sel.sourceLocation
        ? ` (${sel.sourceLocation.file}:${sel.sourceLocation.line})`
        : '';

      lines.push(`${index + 1}. ${name}${location}`);

      // Dimensions
      if (sel.dimensions) {
        lines.push(`   - Dimensions: ${sel.dimensions.width}px × ${sel.dimensions.height}px`);
      }

      // Box Model
      if (sel.boxModel) {
        const { padding, margin } = sel.boxModel;
        const padStr = this.formatSpacing(padding);
        const marginStr = this.formatSpacing(margin);
        lines.push(`   - Box Model: padding ${padStr}, margin ${marginStr}`);
      }

      // Classes
      if (sel.classes && sel.classes.length > 0) {
        lines.push(`   - Classes: ${sel.classes.join(' ')}`);
      }

      // Font
      if (sel.font) {
        const weight = sel.font.weight !== '400' ? ` weight-${sel.font.weight}` : '';
        lines.push(`   - Font: ${sel.font.family} ${sel.font.size}${weight}`);
      }

      // Role
      if (sel.role) {
        lines.push(`   - Role: ${sel.role}`);
      }

      lines.push('');
    });

    lines.push('---');
    return lines.join('\n');
  }

  /**
   * Format spacing values (padding/margin) concisely.
   */
  private formatSpacing(spacing: { top: number; right: number; bottom: number; left: number }): string {
    const { top, right, bottom, left } = spacing;

    // All same
    if (top === right && right === bottom && bottom === left) {
      return `${top}px`;
    }

    // Vertical/horizontal pairs
    if (top === bottom && left === right) {
      return `${top}px ${left}px`;
    }

    // All different
    return `${top}px ${right}px ${bottom}px ${left}px`;
  }

  /**
   * Render the panel to a string.
   */
  renderPanel(): string {
    const width = this.options.panelWidth;
    const lines: string[] = [];

    // Header
    const countStr = this.selections.length > 0 ? ` (${this.selections.length})` : '';
    const title = `Selected Elements${countStr}`;
    const headerPadding = width - title.length - 4; // 4 for corners and spaces
    const header = `${BOX.topLeft}${BOX.horizontal} ${title} ${BOX.horizontal.repeat(Math.max(0, headerPadding))}${BOX.topRight}`;
    lines.push(chalk.gray(header));

    if (this.selections.length === 0) {
      // Empty state
      const emptyMsg = 'Click elements in browser to select';
      const padding = width - emptyMsg.length - 4;
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      lines.push(
        chalk.gray(BOX.vertical) +
        ' '.repeat(leftPad + 1) +
        chalk.dim(emptyMsg) +
        ' '.repeat(rightPad + 1) +
        chalk.gray(BOX.vertical)
      );
    } else if (this.selections.length <= this.options.expandThreshold) {
      // Expanded mode - show details
      this.selections.forEach((sel, index) => {
        const num = chalk.cyan(`${index + 1}.`);
        const name = sel.componentName
          ? chalk.yellow(sel.componentName)
          : chalk.gray(`<${sel.tagName}>`);
        const dims = sel.dimensions
          ? chalk.dim(` ${sel.dimensions.width}x${sel.dimensions.height}`)
          : '';

        const content = `${num} ${name}${dims}`;
        const contentLen = `${index + 1}. ${sel.componentName || `<${sel.tagName}>`}${sel.dimensions ? ` ${sel.dimensions.width}x${sel.dimensions.height}` : ''}`.length;
        const linePadding = width - contentLen - 4;

        lines.push(
          chalk.gray(BOX.vertical) +
          ' ' + content +
          ' '.repeat(Math.max(1, linePadding)) +
          chalk.gray(BOX.vertical)
        );
      });
    } else {
      // Collapsed mode - show summary
      const summaries = this.selections.map(s => s.componentName || s.tagName);
      let summaryLine = summaries.join(', ');
      const maxLen = width - 6;

      if (summaryLine.length > maxLen) {
        summaryLine = summaryLine.slice(0, maxLen - 3) + '...';
      }

      const padding = width - summaryLine.length - 4;
      lines.push(
        chalk.gray(BOX.vertical) +
        ' ' + chalk.white(summaryLine) +
        ' '.repeat(Math.max(1, padding)) +
        chalk.gray(BOX.vertical)
      );
    }

    // Footer
    const footer = `${BOX.bottomLeft}${BOX.horizontal.repeat(width - 2)}${BOX.bottomRight}`;
    lines.push(chalk.gray(footer));

    this.lastPanelHeight = lines.length;
    return lines.join('\n');
  }

  /**
   * Get the height of the last rendered panel.
   */
  getPanelHeight(): number {
    return this.lastPanelHeight || 3;
  }

  /**
   * Write panel to terminal, updating in place if already rendered.
   */
  writeToTerminal(stream: NodeJS.WriteStream = process.stdout): void {
    if (!stream.isTTY) {
      // Non-TTY: just print
      stream.write(this.renderPanel() + '\n');
      return;
    }

    if (this.isRendered && this.lastPanelHeight > 0) {
      // Move cursor up to overwrite previous panel
      stream.write(`\x1b[${this.lastPanelHeight}A`);
      // Clear from cursor to end of screen
      stream.write('\x1b[0J');
    }

    stream.write(this.renderPanel() + '\n');
    this.isRendered = true;
  }

  /**
   * Clear panel from terminal.
   */
  clearFromTerminal(stream: NodeJS.WriteStream = process.stdout): void {
    if (!stream.isTTY || !this.isRendered) return;

    if (this.lastPanelHeight > 0) {
      // Move cursor up
      stream.write(`\x1b[${this.lastPanelHeight}A`);
      // Clear to end
      stream.write('\x1b[0J');
    }

    this.isRendered = false;
    this.lastPanelHeight = 0;
  }

  /**
   * Mark panel as needing fresh render (e.g., after other output).
   */
  invalidate(): void {
    this.isRendered = false;
  }

  private notifyListeners(): void {
    const selections = [...this.selections];
    this.listeners.forEach(listener => listener(selections));
  }
}

// Singleton instance for easy access
export const stagedSelections = new SelectedElementsManager();
