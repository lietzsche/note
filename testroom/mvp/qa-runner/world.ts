import {
  setDefaultTimeout,
  setWorldConstructor,
  BeforeAll,
  AfterAll,
  Before,
  After,
  Status,
} from '@cucumber/cucumber';
import type { ITestCaseHookParameter, IWorld, IWorldOptions } from '@cucumber/cucumber';
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';

declare module '@cucumber/cucumber' {
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

class CustomWorld implements IWorld {
  readonly attach: IWorld['attach'];
  readonly log: IWorld['log'];
  readonly link: IWorld['link'];
  readonly parameters: IWorld['parameters'];
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;

  constructor(options: IWorldOptions) {
    this.attach = options.attach;
    this.log = options.log;
    this.link = options.link;
    this.parameters = options.parameters;
  }

  async initContext() {
    if (!sharedBrowser) {
      throw new Error('Playwright browser not initialized.');
    }
    this.browser = sharedBrowser;
    this.context = await sharedBrowser.newContext();
    this.page = await this.context.newPage();
    const actionTimeout = Number(process.env.PLAYWRIGHT_ACTION_TIMEOUT ?? 60_000);
    const navTimeout = Number(process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT ?? 60_000);
    this.page.setDefaultTimeout(actionTimeout);
    this.page.setDefaultNavigationTimeout(navTimeout);
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

export { CustomWorld };

Before(async function (this: CustomWorld) {
  await this.initContext();
});

After(async function (this: CustomWorld, scenario: ITestCaseHookParameter) {
  if (scenario.result?.status === Status.FAILED && this.page) {
    try {
      const screenshot = await this.page.screenshot({ fullPage: false, timeout: 0 });
      const fileName = `failure-${Date.now()}.png`;
      if (typeof this.attach === 'function') {
        await this.attach(`Screenshot captured: ${fileName}`, 'text/plain');
        await this.attach(screenshot, 'image/png');
      }
    } catch (error) {
      await this.attach(
        `Failed to capture screenshot: ${error instanceof Error ? error.message : String(error)}`,
        'text/plain'
      );
    }
  }

  await this.destroyContext();
});
