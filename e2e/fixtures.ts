import { test as base, expect, type Page } from "@playwright/test";

// Everything else (expect, Page, Locator...) as Playwright has it; `test` below replaces Playwright's
export * from "@playwright/test";

/**
 * The e2e suite's `test`: every spec imports `test` and `expect` from here.
 *
 * `page.goto` on a demo page waits until React has taken the page over, not just until it has loaded. Both demo pages
 * are prerendered, so their buttons and the demo bar's selects are on screen before they respond: a click or a
 * selectOption that lands first is lost. Each page sets its test hooks on `window` from an effect, which only runs
 * once it's live: Checkout's `__checkout`, the wallet's `__nav`.
 *
 * Navigation by the demo bar's links (no reload, so both widgets share one mock) goes through `toCheckout` and
 * `toWallet`: the target's first compile on the dev server can outlast `toHaveURL`'s default 5 s, so they wait for
 * the URL as long as a navigation may take, then for the page on screen.
 */

/** How long a navigation may take: the dev server compiles a page on its first visit. */
const NAV_MS = 30_000;

/* eslint-disable @typescript-eslint/no-explicit-any */
const HOOKS: [RegExp, string][] = [[/\/demo\/ile-living(\?|$)/, "__checkout"], [/\/demo\/wallet(\?|$)/, "__nav"]];

export const test = base.extend({
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const res = await goto(url, options);
      const hook = HOOKS.find(([re]) => re.test(url))?.[1];
      if (hook) await page.waitForFunction((h) => !!(window as any)[h], hook, { timeout: NAV_MS });
      return res;
    };
    await provide(page);
  },
});

/** The demo bar's "To Checkout": Ilé Living's page, live (its Pay with Poket button on screen). */
export async function toCheckout(page: Page) {
  await page.locator("#demoToCheckout").click();
  await page.waitForURL(/\/demo\/ile-living$/, { timeout: NAV_MS });
  await expect(page.locator("#payWithPoket")).toBeVisible({ timeout: NAV_MS });
}

/** The demo bar's "To wallet": the wallet's page, live (its panel on screen, signed in or out). */
export async function toWallet(page: Page) {
  await page.locator("#demoToWallet").click();
  await page.waitForURL(/\/demo\/wallet$/, { timeout: NAV_MS });
  await expect(page.locator("#panelBody")).toBeVisible({ timeout: NAV_MS });
}
