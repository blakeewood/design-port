#!/usr/bin/env node
/**
 * CLI entry point for DesignPort.
 * Usage: design-port [project-path] [options]
 */

import { DesignPortPlugin } from './plugin.js';
import { createConfigFromProject, type DesignPortConfig } from './config.js';
import { formatError } from './errors.js';

interface ParsedArgs {
  projectPath: string;
  verbose: boolean;
  port?: number;
  browser?: 'chrome' | 'chromium' | 'edge';
  headless: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    projectPath: process.cwd(),
    verbose: false,
    headless: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--version' || arg === '-V') {
      result.version = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--headless') {
      result.headless = true;
    } else if (arg === '--port' || arg === '-p') {
      const portArg = args[++i];
      if (portArg) {
        result.port = parseInt(portArg, 10);
      }
    } else if (arg === '--browser' || arg === '-b') {
      const browserArg = args[++i];
      if (browserArg && ['chrome', 'chromium', 'edge'].includes(browserArg)) {
        result.browser = browserArg as 'chrome' | 'chromium' | 'edge';
      }
    } else if (!arg.startsWith('-')) {
      result.projectPath = arg;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
🎨 DesignPort - Visual UI Design Interface

Usage: design-port [project-path] [options]

Options:
  -h, --help          Show this help message
  -V, --version       Show version number
  -v, --verbose       Enable verbose logging
  -p, --port <port>   Dev server port (default: auto-detect)
  -b, --browser <b>   Browser to use: chrome, chromium, edge (default: chrome)
  --headless          Run browser in headless mode

Examples:
  design-port                    # Start in current directory
  design-port ./my-project       # Start in specific directory
  design-port -v --port 3000     # Verbose mode on port 3000

Configuration:
  Create .designportrc or add "designPort" to package.json:
  {
    "browser": "chrome",
    "devServerPort": 3000,
    "verbose": false
  }
`);
}

function printBanner(projectPath: string): void {
  console.log('');
  console.log('  🎨 DesignPort');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  📁 Project: ${projectPath}`);
  console.log('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    console.log('design-port v0.1.0');
    process.exit(0);
  }

  printBanner(args.projectPath);

  // Load configuration from project files and apply CLI overrides
  const overrides: DesignPortConfig = {
    verbose: args.verbose,
    headless: args.headless,
  };
  if (args.port) {
    overrides.devServerPort = args.port;
  }
  if (args.browser) {
    overrides.browser = args.browser;
  }

  let config;
  try {
    config = await createConfigFromProject(args.projectPath, overrides);
  } catch (error) {
    console.error(formatError(error instanceof Error ? error : new Error(String(error))));
    process.exit(1);
  }

  const plugin = new DesignPortPlugin(config);

  // Track shutdown state to prevent double shutdown
  let isShuttingDown = false;

  // Handle shutdown signals gracefully
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log('');
    console.log(`  🛑 Received ${signal}, shutting down...`);

    try {
      await plugin.stop();
      console.log('  ✅ Cleanup complete');
      process.exit(0);
    } catch (error) {
      console.error('  ⚠️  Error during cleanup:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('');
    console.error(formatError(error));
    shutdown('uncaughtException').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    console.error('');
    console.error(formatError(error));
  });

  try {
    await plugin.start();

    // Get connection info for display
    const connectionInfo = plugin.getConnectionInfo();

    console.log('  ✅ DesignPort is running');
    console.log('');
    console.log('  🌐 Connection Info:');
    console.log(`     Dev Server:      ${connectionInfo.devServerUrl}`);
    console.log(`     WebSocket:       ws://localhost:${connectionInfo.wsPort}`);
    console.log(`     Script Server:   http://localhost:${connectionInfo.scriptPort}`);
    console.log('');
    console.log('  📌 Usage:');
    console.log('     • Click elements in the browser to inspect them');
    console.log('     • Press Ctrl+Shift+P to toggle pick mode');
    console.log('     • Press Ctrl+C to stop');
    console.log('');
    console.log('  💡 To inject inspector manually, add to your HTML:');
    console.log(`     <script src="http://localhost:${connectionInfo.scriptPort}/__design-port-bundle.js"></script>`);
    console.log('');

  } catch (error) {
    console.error('');
    console.error(formatError(error instanceof Error ? error : new Error(String(error))));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
