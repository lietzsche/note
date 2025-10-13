## makex 진입
### 나만의 makex 저작도구 진입 및 동작 확인
#### example.feature
```
Feature: makex 진입

  Scenario: 나만의 makex 저작도구 진입 및 동작 확인
    Given 초등학교 로그인 후 메인 페이지 진입
    And 퀵 매뉴 닫기
    When 배너를 거쳐 나만의 MakeX에서 저작도구 진입
    Then 다음 저작도구들 확인
      | 즐겨찾기         |
      | 템플릿           |
      | 텍스트           |
      | 문항형           |
      | 조작형           |
      | 도형            |
      | 이미지           |
      | 비디오           |
      | 오디오           |
```

### example.steps.ts
```
import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import {expect, Page} from "@playwright/test";
import {Locator} from "playwright-core";

Given('초등학교 로그인 후 메인 페이지 진입', async function () {
  await this.page.goto("https://e.m-teacher.co.kr")

  await this.page.waitForLoadState('domcontentloaded', { timeout: 30_000 });
  await this.page.waitForLoadState('networkidle', { timeout: 30_000 });

  await this.page.locator("button#closePop").click().catch(() => {});

  await this.page.waitForLoadState('domcontentloaded', { timeout: 30_000 });
  await this.page.waitForLoadState('networkidle', { timeout: 30_000 });

  await this.page.locator("#user-id").fill("");
  await this.page.locator("#user-pw").fill("");
  await this.page.locator('#btn-login').click()
  await this.page.locator("button#closePop").click().catch(() => {});
});

Given("퀵 매뉴 닫기", async function () {
  await this.page.locator(".quick_menu.open button.toggle-button.quick_btn").click();
})

const ifPopupUpdateTab = async function (popup: Page) {
    await popup.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    await popup.bringToFront();

    const oldPage = this.page;
    const hasOpener = !!popup.opener();     // ← 여기서 판단
    this.page = popup;

    // noopener 인 경우에만 기존 탭 닫기
    if (!hasOpener && oldPage !== popup && !oldPage.isClosed()) {
        await oldPage.close();
    }
}

// 팝업 시 팝업되는 페이지로 기존 페이지를 갈아끼우고, 기존 페이지 끄기
const ifPopupUpdateNextTab = async function (btn: Locator) {
    const ctx = this.page.context();
    const pagesBefore = ctx.pages().length;

    let [nextTab] = await Promise.all([
        Promise.race([
            this.page.waitForEvent('popup', { timeout: 30_000 }),
            ctx.waitForEvent('page', { timeout: 30_000 }),
        ]).catch(() => null),
        btn.click(),
    ]);

    if (!nextTab && ctx.pages().length > pagesBefore) {
        const newPages = ctx.pages().slice(pagesBefore);
        nextTab = newPages[newPages.length - 1];
    }

    if (nextTab && nextTab !== this.page) {
        await ifPopupUpdateTab.call(this, nextTab);
    }
}

When("배너를 거쳐 나만의 MakeX에서 저작도구 진입", async function () {
    const link = await this.page.locator('a:has(strong)', {hasText: "메이크엑스"})
    await expect(link).toBeVisible({ timeout: 15_000 });
    await ifPopupUpdateNextTab.call(this, link);
    await this.page.getByRole("tab", { name: /나만의/ }).click()
    await this.page.getByLabel(/자료 만들기/).click()
    await ifPopupUpdateNextTab.call(this, await this.page.getByRole("button", { name: /콘텐츠 추가하기/ }));
});

Then('다음 저작도구들 확인', async function (table: DataTable) {
  const closeBtn = await this.page.locator("button.btn_close");
    await expect(closeBtn).toBeVisible({ timeout: 30_000 })
    await closeBtn.click()
    for (const name of table.raw().flat().filter(Boolean)) {
        const item = this.page.getByText(name).first()
        await expect(item, `${name} 매뉴가 표시되지 않음`).toBeAttached({ timeout: 30_000 });
    }
});

```