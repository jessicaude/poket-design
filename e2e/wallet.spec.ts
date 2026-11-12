import { test, expect } from "@playwright/test";

// Playwright locators pierce the open shadow root that WalletShell renders into.
test("wallet shell renders the reference frame and switches tabs", async ({ page }) => {
  await page.goto("/demo/wallet");
  const panel = page.locator(".panel");
  await expect(panel.locator(".panel-head .panel-brand svg.brand-lockup")).toBeVisible();
  await expect(page.locator("#openSettingsHeader")).toBeVisible();
  await expect(page.locator("#openNotifHeader")).toBeHidden();
  // No flow open: the body is the home entry (NGN balance + Withdraw)
  await expect(page.locator("#panelBody #actSend")).toBeVisible();

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

test("NGN screens render in #panelBody: Deposit NGN offers bank transfer and convert, never card", async ({ page }) => {
  await page.goto("/demo/wallet?ngn=deposit-method");
  const body = page.locator("#panelBody");
  await expect(body.locator(".step-title")).toHaveText("Deposit NGN");
  await expect(body.locator(".select-row .t1")).toHaveText(["Bank transfer", "Convert"]);
  await expect(body.locator("#dmBank .t2")).toHaveText("From any Nigerian bank");
  await expect(body.locator("#dmCard")).toHaveCount(0);
  // Styled by the wallet stylesheet inside the shadow root
  const ic = await body.locator("#dmBank .va-ic").evaluate((el) => getComputedStyle(el).width);
  expect(ic).toBe("34px");

  // Back leaves the NGN flow, back to the wallet home
  await body.locator("#backToDepositSelect").click();
  await expect(body.locator(".step-title")).toHaveCount(0);
  await expect(body.locator("#actSend")).toBeVisible();
});

test("Deposit NGN: the bank row says so when the dedicated NGN account is ready", async ({ page }) => {
  await page.goto("/demo/wallet?ngn=deposit-method");
  await expect(page.locator("#dmBank .t2")).toHaveText("From any Nigerian bank");
  await page.evaluate(() => (window as any).__ngn.getState().set({ dedicated: { status: "ready", num: "1234567890" } })); // eslint-disable-line @typescript-eslint/no-explicit-any
  await expect(page.locator("#dmBank .t2")).toHaveText("To your NGN account · usually within seconds");
  await expect(page.locator("#dmConvert .t2")).toHaveText("From your USD or USDC balance");
  await expect(page.locator("#panelBody .select-row")).toHaveCount(2);
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
