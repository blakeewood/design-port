/**
 * Browser launching and lifecycle management using Puppeteer.
 */

import puppeteer, { type Browser, type Page } from 'puppeteer-core';

export interface BrowserLauncherOptions {
  /** Browser executable path (auto-detected if not provided) */
  executablePath?: string;
  /** Browser type to look for */
  browser?: 'chrome' | 'chromium' | 'edge';
  /** Run in headless mode */
  headless?: boolean;
  /** Window width */
  width?: number;
  /** Window height */
  height?: number;
}

const DEFAULT_OPTIONS: Required<BrowserLauncherOptions> = {
  executablePath: '',
  browser: 'chrome',
  headless: false,
  width: 1280,
  height: 800,
};

export class BrowserLauncher {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private options: Required<BrowserLauncherOptions>;

  constructor(options: BrowserLauncherOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Launch the browser and navigate to the given URL.
   */
  async launch(url: string): Promise<Page> {
    const executablePath =
      this.options.executablePath || (await this.findBrowserExecutable());

    this.browser = await puppeteer.launch({
      executablePath,
      headless: this.options.headless,
      defaultViewport: null,
      args: [
        `--window-size=${this.options.width},${this.options.height}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const pages = await this.browser.pages();
    this.page = pages[0] ?? (await this.browser.newPage());

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });

    return this.page;
  }

  /**
   * Inject a script into the current page.
   */
  async injectScript(script: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    await this.page.addScriptTag({ content: script });
  }

  /**
   * Navigate to a new URL.
   */
  async navigate(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched');
    }

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  /**
   * Close the browser.
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Check if the browser is running.
   */
  isRunning(): boolean {
    return this.browser !== null && this.browser.connected;
  }

  /**
   * Get the current page.
   */
  getPage(): Page | null {
    return this.page;
  }

  private async findBrowserExecutable(): Promise<string> {
    const { execSync } = await import('node:child_process');
    const platform = process.platform;

    const paths: Record<string, string[]> = {
      darwin: [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      ],
      linux: [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/microsoft-edge',
      ],
      win32: [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ],
    };

    const candidates = paths[platform] ?? [];

    for (const path of candidates) {
      try {
        if (platform === 'win32') {
          execSync(`if exist "${path}" echo found`, { encoding: 'utf-8' });
        } else {
          execSync(`test -f "${path}"`, { encoding: 'utf-8' });
        }
        return path;
      } catch {
        // Path doesn't exist, try next
      }
    }

    throw new Error(
      `Could not find ${this.options.browser} executable. Please install Chrome/Chromium or specify executablePath.`
    );
  }
}
