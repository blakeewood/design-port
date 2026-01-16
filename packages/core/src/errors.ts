/**
 * Error types and handling utilities for DesignPort.
 * Provides actionable error messages for common issues.
 */

/**
 * Base error class for DesignPort errors.
 */
export class DesignPortError extends Error {
  /** Suggested action to resolve the error */
  action?: string;
  /** Error code for programmatic handling */
  code: string;

  constructor(message: string, code: string, action?: string) {
    super(message);
    this.name = 'DesignPortError';
    this.code = code;
    if (action) {
      this.action = action;
    }
  }
}

/**
 * Error when dev server fails to start.
 */
export class DevServerError extends DesignPortError {
  constructor(message: string, details?: string) {
    const action = getDevServerAction(message);
    super(
      `Dev server failed: ${message}${details ? `\n${details}` : ''}`,
      'DEV_SERVER_ERROR',
      action
    );
    this.name = 'DevServerError';
  }
}

/**
 * Error when browser fails to launch.
 */
export class BrowserLaunchError extends DesignPortError {
  constructor(message: string, browser: string) {
    const action = getBrowserAction(message, browser);
    super(
      `Failed to launch ${browser}: ${message}`,
      'BROWSER_LAUNCH_ERROR',
      action
    );
    this.name = 'BrowserLaunchError';
  }
}

/**
 * Error when WebSocket connection fails.
 */
export class ConnectionError extends DesignPortError {
  constructor(message: string) {
    super(
      `Connection failed: ${message}`,
      'CONNECTION_ERROR',
      'Check if the browser is still open and try again'
    );
    this.name = 'ConnectionError';
  }
}

/**
 * Error when framework detection fails.
 */
export class FrameworkDetectionError extends DesignPortError {
  constructor(projectPath: string) {
    super(
      `Could not detect framework in ${projectPath}`,
      'FRAMEWORK_DETECTION_ERROR',
      'Make sure you have a package.json with framework dependencies (react, vue, svelte, etc.)'
    );
    this.name = 'FrameworkDetectionError';
  }
}

/**
 * Error when configuration is invalid.
 */
export class ConfigurationError extends DesignPortError {
  constructor(message: string) {
    super(
      `Invalid configuration: ${message}`,
      'CONFIGURATION_ERROR',
      'Check your .designportrc or package.json designPort configuration'
    );
    this.name = 'ConfigurationError';
  }
}

/**
 * Get suggested action for dev server errors.
 */
function getDevServerAction(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('eaddrinuse') || lowerMessage.includes('port')) {
    return 'Port is already in use. Try a different port with --port or stop the other process';
  }

  if (lowerMessage.includes('enoent') || lowerMessage.includes('not found')) {
    return 'Run "npm install" or "pnpm install" to install dependencies';
  }

  if (lowerMessage.includes('permission') || lowerMessage.includes('eacces')) {
    return 'Check file permissions or try running with elevated privileges';
  }

  if (lowerMessage.includes('timeout')) {
    return 'Dev server took too long to start. Check for errors in your project configuration';
  }

  return 'Check your project configuration and try again';
}

/**
 * Get suggested action for browser launch errors.
 */
function getBrowserAction(message: string, browser: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('not found') || lowerMessage.includes('could not find')) {
    const installInstructions: Record<string, string> = {
      chrome: 'Install Google Chrome from https://google.com/chrome',
      chromium: 'Install Chromium: brew install chromium (macOS) or apt install chromium (Linux)',
      edge: 'Install Microsoft Edge from https://microsoft.com/edge',
    };
    return installInstructions[browser] || `Install ${browser} browser`;
  }

  if (lowerMessage.includes('crashed')) {
    return 'Browser crashed. Try closing other browser instances and run again';
  }

  if (lowerMessage.includes('timeout')) {
    return 'Browser took too long to launch. Try closing other instances or restarting';
  }

  return 'Try using a different browser with --browser flag';
}

/**
 * Format an error for terminal display.
 */
export function formatError(error: Error): string {
  const lines: string[] = [];

  if (error instanceof DesignPortError) {
    lines.push(`[!] ${error.message}`);
    if (error.action) {
      lines.push('');
      lines.push(`[>] Suggestion: ${error.action}`);
    }
  } else if (error instanceof AggregateError) {
    lines.push('[!] Multiple errors occurred:');
    for (const err of error.errors) {
      lines.push(`   - ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    lines.push(`[!] ${error.message}`);
  }

  return lines.join('\n');
}

/**
 * Wrap an error with DesignPort context.
 */
export function wrapError(error: unknown, context: string): DesignPortError {
  const message = error instanceof Error ? error.message : String(error);
  return new DesignPortError(`${context}: ${message}`, 'UNKNOWN_ERROR');
}
