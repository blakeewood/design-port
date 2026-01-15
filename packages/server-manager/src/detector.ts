/**
 * Framework and build tool detection.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type Framework = 'react' | 'vue' | 'svelte' | 'vanilla';
export type BuildTool = 'vite' | 'nextjs' | 'cra' | 'webpack' | 'unknown';
export type PackageManager = 'npm' | 'yarn' | 'pnpm';

export interface FrameworkInfo {
  framework: Framework;
  buildTool: BuildTool;
  packageManager: PackageManager;
  configFile?: string;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Detect the framework, build tool, and package manager used in a project.
 */
export async function detectFramework(
  projectPath: string
): Promise<FrameworkInfo> {
  const packageJsonPath = join(projectPath, 'package.json');

  let packageJson: PackageJson;
  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(content) as PackageJson;
  } catch {
    return {
      framework: 'vanilla',
      buildTool: 'unknown',
      packageManager: await detectPackageManager(projectPath),
    };
  }

  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const framework = detectFrameworkFromDeps(allDeps);
  const buildTool = await detectBuildTool(projectPath, allDeps);
  const packageManager = await detectPackageManager(projectPath);

  return {
    framework,
    buildTool,
    packageManager,
    configFile: await findConfigFile(projectPath, buildTool),
  };
}

function detectFrameworkFromDeps(deps: Record<string, string>): Framework {
  if ('react' in deps || 'react-dom' in deps) return 'react';
  if ('vue' in deps) return 'vue';
  if ('svelte' in deps) return 'svelte';
  return 'vanilla';
}

async function detectBuildTool(
  projectPath: string,
  deps: Record<string, string>
): Promise<BuildTool> {
  // Check for Next.js
  if ('next' in deps) return 'nextjs';

  // Check for Vite
  if ('vite' in deps) return 'vite';

  // Check for Create React App
  if ('react-scripts' in deps) return 'cra';

  // Check for webpack
  if ('webpack' in deps) return 'webpack';

  return 'unknown';
}

async function detectPackageManager(
  projectPath: string
): Promise<PackageManager> {
  const { access } = await import('node:fs/promises');

  try {
    await access(join(projectPath, 'pnpm-lock.yaml'));
    return 'pnpm';
  } catch {
    // Not pnpm
  }

  try {
    await access(join(projectPath, 'yarn.lock'));
    return 'yarn';
  } catch {
    // Not yarn
  }

  return 'npm';
}

async function findConfigFile(
  projectPath: string,
  buildTool: BuildTool
): Promise<string | undefined> {
  const { access } = await import('node:fs/promises');

  const configFiles: Record<BuildTool, string[]> = {
    vite: [
      'vite.config.ts',
      'vite.config.js',
      'vite.config.mts',
      'vite.config.mjs',
    ],
    nextjs: [
      'next.config.ts',
      'next.config.js',
      'next.config.mjs',
    ],
    cra: [],
    webpack: ['webpack.config.js', 'webpack.config.ts'],
    unknown: [],
  };

  const candidates = configFiles[buildTool];
  for (const file of candidates) {
    try {
      await access(join(projectPath, file));
      return file;
    } catch {
      // File doesn't exist
    }
  }

  return undefined;
}
