import { describe, it, expect } from 'vitest';
import { detectFramework } from './detector.js';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('detectFramework', () => {
  it('detects React with Vite', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'design-port-test-'));

    try {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          dependencies: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
          },
          devDependencies: {
            vite: '^5.0.0',
          },
        })
      );

      await writeFile(join(tempDir, 'vite.config.ts'), 'export default {}');

      const result = await detectFramework(tempDir);

      expect(result.framework).toBe('react');
      expect(result.buildTool).toBe('vite');
      expect(result.configFile).toBe('vite.config.ts');
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  it('detects Next.js', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'design-port-test-'));

    try {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          dependencies: {
            react: '^18.0.0',
            next: '^14.0.0',
          },
        })
      );

      const result = await detectFramework(tempDir);

      expect(result.framework).toBe('react');
      expect(result.buildTool).toBe('nextjs');
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });

  it('returns vanilla for unknown projects', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'design-port-test-'));

    try {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          dependencies: {},
        })
      );

      const result = await detectFramework(tempDir);

      expect(result.framework).toBe('vanilla');
      expect(result.buildTool).toBe('unknown');
    } finally {
      await rm(tempDir, { recursive: true });
    }
  });
});
