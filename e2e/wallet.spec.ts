import { test, expect } from "@playwright/test";

// Playwright locators pierce the open shadow root that WalletShell renders into.
test("wallet shell renders the reference frame and switches tabs", async ({ page }) => {
  await page.goto("/demo/wallet");
  const panel = page.locator(".panel");
  await expect(panel.locator(".panel-head .panel-brand svg.brand-lockup")).toBeVisible();
  await expect(page.locator("#openSettingsHeader")).toBeVisible();
  await expect(page.locator("#openNotifHeader")).toBeHidden();
  await expect(page.locator("#panelBody")).toBeEmpty();

  const tabs = page.locator("#tabbar .tab-item");
  await expect(tabs).toHaveText(["Wallet", "Card", "Activity"]);
  await expect(page.locator("#tabHome")).toHaveClass(/\bon\b/);

  await page.locator("#tabActivity").click();
  await expect(page.locator("#tabActivity")).toHaveClass(/\bon\b/);
  await expect(page.locator("#tabHome")).not.toHaveClass(/\bon\b/);

  // Wallet tokens come from :host inside the shadow root, so they must resolve there.
  const radius = await panel.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  expect(radius).toBe("20px");
});

test("wallet styles stay inside the shadow root", async ({ page }) => {
  await page.goto("/demo/wallet");
  await expect(page.locator("#tabHome")).toBeVisible();
  const leaked = await page.evaluate(() => ({
    token: getComputedStyle(document.documentElement).getPropertyValue("--brand-500"),
    rule: [...document.styleSheets].some((s) => {
      try { return [...s.cssRules].some((r) => r.cssText.includes(".tab-item")); } catch { return false; }
    }),
  }));
  expect(leaked).toEqual({ token: "", rule: false });
});
