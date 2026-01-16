/**
 * Bundle the client script for browser injection using esbuild.
 */

import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');
const distDir = join(__dirname, '..', 'dist');

async function bundle() {
  // Legacy bundle (Phase 1-6)
  await build({
    entryPoints: [join(srcDir, 'browser-entry.ts')],
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'DesignPort',
    outfile: join(distDir, 'bundle.js'),
    target: ['chrome90', 'firefox88', 'safari14'],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  // Phase 6.5 Visual Inspector bundle
  await build({
    entryPoints: [join(srcDir, 'browser-entry-v2.ts')],
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'DesignPortV2',
    outfile: join(distDir, 'overlay.js'),
    target: ['chrome90', 'firefox88', 'safari14'],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  // Separate bundles for modular loading
  await build({
    entryPoints: [join(srcDir, 'inspector-panel.ts')],
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'DesignPortPanel',
    outfile: join(distDir, 'inspector.js'),
    target: ['chrome90', 'firefox88', 'safari14'],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  console.log('Client script bundled successfully');
  console.log('  - bundle.js (legacy)');
  console.log('  - overlay.js (Phase 6.5 visual inspector)');
  console.log('  - inspector.js (inspector panel only)');
}

bundle().catch((error) => {
  console.error('Bundle failed:', error);
  process.exit(1);
});
