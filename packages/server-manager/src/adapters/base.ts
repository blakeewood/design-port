/**
 * Base interface for dev server adapters.
 */

export interface DevServerAdapter {
  /** Adapter name for logging */
  name: string;

  /**
   * Check if this adapter can handle the given project.
   */
  detect(projectPath: string): Promise<boolean>;

  /**
   * Get the command to start the dev server.
   * Returns [command, ...args]
   */
  getStartCommand(projectPath: string): string[];

  /**
   * Get the dev server URL once running.
   */
  getDevServerUrl(port: number): string;

  /**
   * Optional: Get the default port for this dev server.
   */
  getDefaultPort?(): number;

  /**
   * Optional: Inject middleware or plugin for script injection.
   * Returns the modified config content or undefined if not supported.
   */
  injectMiddleware?(
    configPath: string,
    scriptUrl: string
  ): Promise<string | undefined>;
}

/**
 * Base class with common functionality for adapters.
 */
export abstract class BaseDevServerAdapter implements DevServerAdapter {
  abstract name: string;
  abstract detect(projectPath: string): Promise<boolean>;
  abstract getStartCommand(projectPath: string): string[];

  getDevServerUrl(port: number): string {
    return `http://localhost:${port}`;
  }

  getDefaultPort(): number {
    return 3000;
  }

  async injectMiddleware(
    _configPath: string,
    _scriptUrl: string
  ): Promise<string | undefined> {
    return undefined;
  }
}
