import * as fs from "fs";
import * as crypto from "crypto";

/**
 * ContextWriter handles writing formatted selected element context to temp files
 * for use by the MCP server and Claude integration.
 *
 * Uses file-based IPC with project-specific temp files to ensure isolation
 * between multiple DesignPort instances.
 */
export class ContextWriter {
  private projectPath: string;
  private contextFilePath: string;

  /**
   * Initialize ContextWriter for a specific project
   * @param projectPath The absolute path to the project being inspected
   */
  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.contextFilePath = this.getContextFilePath();
  }

  /**
   * Generate a consistent hash for the project path
   * Used to create project-specific temp file paths
   */
  private hashProjectPath(): string {
    return crypto
      .createHash("md5")
      .update(this.projectPath || "/tmp")
      .digest("hex")
      .substring(0, 8);
  }

  /**
   * Get the path to the context file for this project
   */
  private getContextFilePath(): string {
    const hash = this.hashProjectPath();
    return `/tmp/design-port-context-${hash}.txt`;
  }

  /**
   * Write formatted context to the temp file
   * Called whenever selected elements change
   *
   * @param formattedContext The pre-formatted context string from formatContext()
   */
  writeContext(formattedContext: string): void {
    try {
      fs.writeFileSync(this.contextFilePath, formattedContext, "utf-8");

      // Set permissions to be readable by the MCP server process
      fs.chmodSync(this.contextFilePath, 0o644);
    } catch (error) {
      console.error(`Failed to write context file: ${error}`);
    }
  }

  /**
   * Clear the context file (called when selections are cleared)
   */
  clearContext(): void {
    try {
      if (fs.existsSync(this.contextFilePath)) {
        fs.unlinkSync(this.contextFilePath);
      }
    } catch (error) {
      console.error(`Failed to clear context file: ${error}`);
    }
  }

  /**
   * Get the current context file path (for debugging/testing)
   */
  getPath(): string {
    return this.contextFilePath;
  }

  /**
   * Check if a context file exists and is fresh (< 1 hour old)
   */
  isFresh(): boolean {
    try {
      if (!fs.existsSync(this.contextFilePath)) {
        return false;
      }

      const stats = fs.statSync(this.contextFilePath);
      const ageMs = Date.now() - stats.mtimeMs;
      const staleAfterMs = 60 * 60 * 1000; // 1 hour

      return ageMs < staleAfterMs;
    } catch {
      return false;
    }
  }
}
