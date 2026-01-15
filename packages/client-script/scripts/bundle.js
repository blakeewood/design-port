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

  console.log('Client script bundled successfully');
}

bundle().catch((error) => {
  console.error('Bundle failed:', error);
  process.exit(1);
});
