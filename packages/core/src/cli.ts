#!/usr/bin/env node
/**
 * CLI entry point for DesignPort.
 * This can be used to start the plugin from the command line for testing.
 */

import { DesignPortPlugin } from './plugin.js';
import { createConfig } from './config.js';

async function main() {
  const args = process.argv.slice(2);
  const projectPath = args[0] || process.cwd();

  console.log('🎨 DesignPort - Visual UI Design Interface');
  console.log('─'.repeat(50));
  console.log(`📁 Project: ${projectPath}`);
  console.log('');

  const config = createConfig({
    projectPath,
    verbose: args.includes('--verbose') || args.includes('-v'),
  });

  const plugin = new DesignPortPlugin(config);

  // Handle shutdown signals
  const shutdown = async () => {
    console.log('\n🛑 Shutting down...');
    await plugin.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await plugin.start();
    console.log('✅ DesignPort is running');
    console.log('   Click elements in the browser to inspect them');
    console.log('   Press Ctrl+C to stop');
    console.log('');
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
