import { test, expect, type Page } from "@playwright/test";

/**
 * The wallet's frame: a fixed-size panel (400px wide, min(720px, the viewport minus the demo bar minus 48px) tall)
 * whose header and tab bar stay put while only the body scrolls; Cash before Stablecoins, Cash by default; and
 * secondary labels only where they add something (docs/copy.md).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
async function wallet(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
}
/** The panel's expected height for this viewport. */
const expected = (page: Page) => page.evaluate(() => {
  const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bar")) || 0;
  return Math.min(720, window.innerHeight - bar - 48);
});
const box = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!;

for (const size of [{ width: 1280, height: 1000 }, { width: 1280, height: 640 }]) {
  test(`fixed size at ${size.height}px: same height on every screen; header and tab bar stay, the body scrolls`, async ({ page }) => {
    await page.setViewportSize(size);
    await wallet(page);
    const want = await expected(page);
    const panel = async () => box(page, "#walletHost .panel");
    expect((await panel()).width).toBe(400);
    expect(Math.abs((await panel()).height - want)).toBeLessThanOrEqual(1);
    // A short screen (Settings) and a long one (Activity) are the same height
    await page.locator("#openSettingsHeader").click();
    expect(Math.abs((await panel()).height - want)).toBeLessThanOrEqual(1);
    await page.locator("#backFromSettings").click();
    await page.locator("#tabActivity").click();
    expect(Math.abs((await panel()).height - want)).toBeLessThanOrEqual(1);
    // Only the body scrolls: the header and the tab bar don't move
    const head = await box(page, "#walletHost .panel-head"), tabs = await box(page, "#tabbar");
    const scrolled = await page.locator("#panelBody").evaluate((el) => { el.scrollTop = 400; return el.scrollTop; });
    expect(scrolled).toBeGreaterThan(0); // Activity is longer than the panel
    expect((await box(page, "#walletHost .panel-head")).y).toBe(head.y);
    expect((await box(page, "#tabbar")).y).toBe(tabs.y);
    expect(tabs.y + tabs.height).toBeLessThanOrEqual((await panel()).y + (await panel()).height + 1);
    // The page itself doesn't scroll
    expect(await page.evaluate(() => document.scrollingElement!.scrollHeight <= window.innerHeight + 1)).toBe(true);
  });
}

test("home tabs: Cash, then Stablecoins; Cash by default, and View all follows", async ({ page }) => {
  await wallet(page);
  await expect(page.locator("[data-wallettab]")).toHaveText(["Cash", "Stablecoins"]);
  await expect(page.locator('[data-wallettab="cash"]')).toHaveClass(/\bsel\b/);
  await expect(page.locator('[data-wallettab="cash"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#walletHost .assets-header > span").first()).toHaveText("Cash");
  await expect(page.locator('[data-holdtype="cash"]').first()).toBeVisible();
  // No FIAT-ONLY note under the list; the tag still explains itself
  await expect(page.locator("#walletHost .fiat-note")).toHaveCount(0);
  await page.locator("#viewAllAssets").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Cash");
  await page.locator("#backHome").click();
  await page.locator('[data-wallettab="assets"]').click();
  await page.locator("#viewAllAssets").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Stablecoins");
});

test("secondary labels only where they add something", async ({ page }) => {
  await wallet(page);
  await page.locator("#tabActivity").click();
  const h = page.locator("#activityHistory");
  // A payment's row: how it was paid; a demo record with nothing to add has no subtitle
  await expect(h.locator('[data-payment="pay_mtk2291"] .tx-sub')).toHaveText("Verve ••• 6011");
  await expect(h.locator('[data-payment="pay_ilv10077"] .tx-sub')).toHaveText("Bank transfer");
  await expect(h.locator('[data-txid="t1"] .tx-sub')).toHaveCount(0);
  await expect(h.locator('[data-txid="t3"] .tx-sub')).toHaveCount(0);
  // A refund's row: where it went
  await expect(h.locator('[data-refund="rf_seedmtk"] .tx-sub')).toHaveText("To NGN balance");
  await expect(page.locator("#panelBody")).not.toContainText("Merchant payment ·");
  await expect(page.locator("#panelBody")).not.toContainText("Merchant refund ·");
  // Screens whose title says it all
  await expect(page.locator("#panelBody .step-sub")).toHaveCount(0); // Activity
  await page.locator("#tabHome").click();
  await page.locator("#actConvert").click();
  await expect(page.locator("#panelBody .step-title").first()).toHaveText("Convert");
  await expect(page.locator("#panelBody > .screen-fade > .step-sub, #panelBody > .step-sub")).toHaveCount(0);
  await expect(page.locator("#panelBody")).not.toContainText("Move money between your currencies and stablecoins.");
});

test("a new screen starts at the top of the panel, wherever the last one was scrolled", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await wallet(page);
  const scrolled = await page.locator("#panelBody").evaluate((el) => { el.scrollTop = 300; return el.scrollTop; });
  expect(scrolled).toBeGreaterThan(0);
  await page.locator('[data-holdcur="USD"][data-holdbucket="open"] .tx-title').click();
  await expect(page.locator("#balanceAmount")).toBeVisible();
  await expect.poll(() => page.locator("#panelBody").evaluate((el) => el.scrollTop)).toBe(0);
  await expect(page.locator("#backFromDetail")).toBeInViewport();
});
