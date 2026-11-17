import { test, expect, type Page } from "./fixtures";

/**
 * "Setting up your {cur} account": account details waiting for the partner bank's review, in the wallet's waiting
 * state (features/wallet/WaitingScreen.tsx). The flag with a clock badge, the title and one line, the three-step
 * tracker, Back to wallet and (not NGN) Deposit by card. The demo's "Account approved" completes the tracker, then
 * the account details. USD waits for review today; the other currencies use the same screen when theirs is pending.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const body = (page: Page) => page.locator("#panelBody");
const title = (page: Page) => body(page).locator(".step-title").first();
const steps = (page: Page) => page.locator("#vaPending .track-step");

/** Tier 1, and the currency's account details made and waiting for review; its balance's account card opened. */
async function pendingAccount(page: Page, cur: string) {
  await page.goto("/demo/wallet");
  await page.getByLabel("Tier").selectOption("1");
  await page.evaluate((c) => (window as any).__deposit.setState((s: any) => ({ vas: { ...s.vas, [c]: { status: "pending", num: "123456789012345" } } })), cur);
  await page.locator(`[data-holdcur="${cur}"][data-holdbucket="open"] .tx-title`).click();
  await page.locator("#vaOpen").click();
  await expect(title(page)).toHaveText(`Setting up your ${cur} account`);
}

test("USD: the flag with a clock badge, one line, the three-step tracker, and the two buttons", async ({ page }) => {
  await pendingAccount(page, "USD");
  await expect(page.locator("#vaPending .wait-flag svg")).toBeVisible();
  await expect(page.locator("#vaPending .wait-flag")).toHaveCSS("width", "48px");
  await expect(page.locator("#vaPending .wait-badge svg")).toBeVisible();
  await expect(page.locator("#vaPending .check-circle")).toHaveCount(0); // no info icon
  await expect(body(page).locator(".step-sub")).toHaveText("We’ll let you know when it’s ready.");
  // Details submitted (done, a check), Bank review (current, with the timing), Account ready (upcoming)
  await expect(steps(page).locator(".track-label")).toHaveText(["Details submitted", "Bank review", "Account ready"]);
  expect(await steps(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-state")))).toEqual(["done", "current", "upcoming"]);
  await expect(steps(page).nth(0).locator(".track-dot svg")).toBeVisible();
  await expect(steps(page).nth(1)).toHaveAttribute("aria-current", "step");
  await expect(steps(page).nth(1).locator(".track-sub")).toHaveText("Usually 1 to 2 business days");
  await expect(page.locator("#vaPending .track-sub")).toHaveCount(1);
  // The wallet's brand colour for done and current, grey for upcoming
  const brand = await page.locator("#walletHost .panel").evaluate((el) => getComputedStyle(el).getPropertyValue("--brand-500").trim());
  const rgb = await page.evaluate((hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; }, brand);
  await expect(steps(page).nth(0).locator(".track-dot")).toHaveCSS("background-color", rgb);
  await expect(steps(page).nth(1).locator(".track-dot")).toHaveCSS("border-top-color", rgb);
  await expect(steps(page).nth(2).locator(".track-dot")).toHaveCSS("border-top-color", "rgb(209, 213, 219)");
  // Back to wallet (primary), Deposit by card (secondary)
  await expect(page.locator("#vaPendingHome")).toHaveText("Back to wallet");
  await expect(page.locator("#vaPendingHome")).toHaveClass(/\bbtn-primary\b/);
  await expect(page.locator("#vaPendingCard")).toHaveText("Deposit by card");
  await expect(page.locator("#vaPendingCard")).toHaveClass(/\bbtn-secondary\b/);
});

test("Back to wallet: the wallet's home; Deposit by card: the card top-up in that currency", async ({ page }) => {
  await pendingAccount(page, "USD");
  await page.locator("#vaPendingHome").click();
  await expect(page.locator("#totalBalance")).toBeVisible();
  await expect(page.locator("#vaPending")).toHaveCount(0);
  // Still waiting when opened again; then the card top-up
  await page.locator('[data-holdcur="USD"][data-holdbucket="open"] .tx-title').click();
  await page.locator("#vaOpen").click();
  await expect(title(page)).toHaveText("Setting up your USD account");
  await page.locator("#vaPendingCard").click();
  await expect(page.locator("#vaPending")).toHaveCount(0);
  expect(await page.evaluate(() => { const d = (window as any).__deposit.getState(); return [d.stage, d.choice]; })).toEqual(["amount", { k: "cash", cur: "USD" }]);
});

test("Account approved while it's open: the tracker completes, then the account details", async ({ page }) => {
  await pendingAccount(page, "USD");
  await page.locator("#demoVaApprove").click();
  await expect.poll(() => steps(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-state")))).toEqual(["done", "done", "done"]);
  await expect(page.locator("#vaPending .track-sub")).toHaveCount(0);
  await expect(title(page)).toHaveText("Setting up your USD account"); // shown complete first
  await expect(title(page)).toHaveText("USD account details");
  await expect(page.locator("#vaDetails")).toBeVisible();
});

for (const cur of ["EUR", "GBP", "GHS"]) {
  test(`${cur}: the same screen when its account is pending, with its own flag; approved, its details`, async ({ page }) => {
    await pendingAccount(page, cur);
    await expect(steps(page).locator(".track-label")).toHaveText(["Details submitted", "Bank review", "Account ready"]);
    await expect(page.locator("#vaPendingCard")).toHaveText("Deposit by card");
    await page.locator("#demoVaApprove").click();
    await expect(title(page)).toHaveText(`${cur} account details`);
  });
}

test("NGN: the same screen with Back to wallet only (no card top-up for naira); approved, its details", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.getByLabel("Tier").selectOption("1");
  await page.evaluate(() => { const n = (window as any).__ngn.getState(); n.set({ dedicated: { status: "pending", num: "0123456789" } }); n.go("details"); });
  await expect(title(page)).toHaveText("Setting up your NGN account");
  await expect(page.locator("#vaPending .wait-flag svg")).toBeVisible();
  await expect(steps(page).locator(".track-label")).toHaveText(["Details submitted", "Bank review", "Account ready"]);
  await expect(page.locator("#vaPendingHome")).toHaveText("Back to wallet");
  await expect(page.locator("#vaPendingCard")).toHaveCount(0);
  await page.locator("#demoVaApprove").click();
  await expect.poll(() => steps(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-state")))).toEqual(["done", "done", "done"]);
  await expect(title(page)).toHaveText("NGN account details");
  // Back to wallet from a pending one: the home
  await page.evaluate(() => { const n = (window as any).__ngn.getState(); n.set({ dedicated: { status: "pending", num: "0123456789" } }); });
  await expect(title(page)).toHaveText("Setting up your NGN account");
  await page.locator("#vaPendingHome").click();
  await expect(page.locator("#totalBalance")).toBeVisible();
});
