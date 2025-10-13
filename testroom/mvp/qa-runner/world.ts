import {
  setDefaultTimeout,
  setWorldConstructor,
  BeforeAll,
  AfterAll,
  Before,
  After,
} from '@cucumber/cucumber';
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';

declare module '@cucumber/cucumber' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface World {
    browser?: Browser;
    context?: BrowserContext;
    page?: Page;
  }
}

setDefaultTimeout(Number(process.env.CUCUMBER_TIMEOUT_MS ?? 60_000));

let sharedBrowser: Browser | undefined;

BeforeAll(async () => {
  sharedBrowser = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
  });
});

AfterAll(async () => {
  if (sharedBrowser) {
    await sharedBrowser.close();
  }
});

class CustomWorld {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;

  async initContext() {
    if (!sharedBrowser) {
      throw new Error('Playwright browser not initialized.');
    }
    this.browser = sharedBrowser;
    this.context = await sharedBrowser.newContext();
    this.page = await this.context.newPage();
  }

  async destroyContext() {
    if (this.context) {
      await this.context.close();
    }
    this.context = undefined;
    this.page = undefined;
  }
}

setWorldConstructor(CustomWorld);

Before(async function () {
  await this.initContext();
});

After(async function () {
  await this.destroyContext();
});

