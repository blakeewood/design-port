/**
 * CSS custom properties (variables) extractor.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

export interface CSSVarTokens {
  /** Variable name to resolved value */
  variables: Map<string, string>;
  /** Variable name to source file:line */
  sources: Map<string, string>;
}

const CSS_DIRECTORIES = [
  'src',
  'styles',
  'app',
  '.',
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

    for (const dir of CSS_DIRECTORIES) {
      await this.findCSSFilesInDir(join(this.projectPath, dir), files, dir);
    }

    return [...new Set(files)];
  }

  private async findCSSFilesInDir(
    dirPath: string,
    files: string[],
    relativePath: string,
    depth = 0
  ): Promise<void> {
    // Limit recursion depth to avoid traversing too deep
    if (depth > 5) return;

    try {
      const entries = await readdir(dirPath);

      for (const entry of entries) {
        // Skip node_modules and hidden directories
        if (entry.startsWith('.') || entry === 'node_modules') continue;

        const fullPath = join(dirPath, entry);
        const relPath = relativePath === '.' ? entry : join(relativePath, entry);

        try {
          const stats = await stat(fullPath);

          if (stats.isDirectory()) {
            await this.findCSSFilesInDir(fullPath, files, relPath, depth + 1);
          } else if (stats.isFile() && extname(entry).toLowerCase() === '.css') {
            files.push(relPath);
          }
        } catch {
          // Skip files/directories we can't stat
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
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
