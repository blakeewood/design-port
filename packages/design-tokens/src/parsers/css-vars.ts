/**
 * CSS custom properties (variables) extractor.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'node:fs/promises';

export interface CSSVarTokens {
  /** Variable name to resolved value */
  variables: Map<string, string>;
  /** Variable name to source file:line */
  sources: Map<string, string>;
}

const CSS_GLOB_PATTERNS = [
  'src/**/*.css',
  'styles/**/*.css',
  'app/**/*.css',
  '*.css',
];

export class CSSVarsParser {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Check if the project has CSS files with custom properties.
   */
  async detect(): Promise<boolean> {
    const cssFiles = await this.findCSSFiles();
    return cssFiles.length > 0;
  }

  /**
   * Parse CSS files and extract custom properties.
   */
  async parse(): Promise<CSSVarTokens> {
    const variables = new Map<string, string>();
    const sources = new Map<string, string>();

    const cssFiles = await this.findCSSFiles();

    for (const file of cssFiles) {
      try {
        const content = await readFile(join(this.projectPath, file), 'utf-8');
        this.extractVariables(content, file, variables, sources);
      } catch {
        // Skip files that can't be read
      }
    }

    return { variables, sources };
  }

  private async findCSSFiles(): Promise<string[]> {
    const files: string[] = [];

    for (const pattern of CSS_GLOB_PATTERNS) {
      try {
        // Node.js 22+ has built-in glob
        const matches = await glob(pattern, { cwd: this.projectPath });
        for await (const match of matches) {
          if (typeof match === 'string') {
            files.push(match);
          }
        }
      } catch {
        // Glob pattern didn't match or glob not available
        // Fallback: manually check common directories
      }
    }

    return [...new Set(files)];
  }

  private extractVariables(
    content: string,
    file: string,
    variables: Map<string, string>,
    sources: Map<string, string>
  ): void {
    // Match CSS rules that might contain custom properties
    // Focus on :root, html, [data-theme], etc.
    const rootRuleRegex = /(?::root|html|\[data-theme[^\]]*\])\s*\{([^}]+)\}/g;

    let match;
    while ((match = rootRuleRegex.exec(content)) !== null) {
      const ruleContent = match[1];
      if (!ruleContent) continue;

      // Find custom property declarations
      const varRegex = /(--[\w-]+)\s*:\s*([^;]+);/g;
      let varMatch;

      while ((varMatch = varRegex.exec(ruleContent)) !== null) {
        const name = varMatch[1];
        const value = varMatch[2]?.trim();

        if (name && value) {
          variables.set(name, value);

          // Calculate line number
          const beforeMatch = content.slice(0, (match.index ?? 0) + (varMatch.index ?? 0));
          const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
          sources.set(name, `${file}:${lineNumber}`);
        }
      }
    }

    // Also look for standalone custom property declarations
    const standaloneVarRegex = /^\s*(--[\w-]+)\s*:\s*([^;]+);/gm;
    let standaloneMatch;

    while ((standaloneMatch = standaloneVarRegex.exec(content)) !== null) {
      const name = standaloneMatch[1];
      const value = standaloneMatch[2]?.trim();

      if (name && value && !variables.has(name)) {
        variables.set(name, value);

        const beforeMatch = content.slice(0, standaloneMatch.index);
        const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
        sources.set(name, `${file}:${lineNumber}`);
      }
    }
  }
}
