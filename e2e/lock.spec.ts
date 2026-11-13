import { test, expect, type Page } from "@playwright/test";

/**
 * Too many wrong verification codes lock the account for 2 hours: after [n] wrong codes in a row (demo value 5,
 * never shown), "Account locked" / "Too many incorrect codes. Try again in 2 hours." with a live countdown. While
 * locked, no money moves in the wallet. The merchant gets account.locked with the reason. The wallet's device codes
 * and Checkout's sign-up and log-in codes count together. Demo: "Skip lock time" on the locked screen.
 */

const title = (page: Page) => page.locator("#panelBody .step-title").first();

/** A new device sending ₦5,000 to the Naira account: "Confirm this device". */
async function toDeviceCode(page: Page) {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.getByLabel("This device").selectOption("new");
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  await page.locator("#youSend").click();
  for (const d of "500000") await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await expect(title(page)).toHaveText("Confirm this device");
}
async function deviceCode(page: Page, code: string) {
  await page.locator("#deviceOtp input").first().click();
  await page.keyboard.type(code);
}
const events = (page: Page) => page.getByTestId("events");

test("wallet: 4 wrong device codes only say so; the 5th locks the account, with a countdown and account.locked", async ({ page }) => {
  await toDeviceCode(page);
  for (let i = 0; i < 4; i++) {
    await deviceCode(page, "000000");
    await expect(page.locator("#deviceStatus")).toHaveText("That code isn’t right. Check it and try again.");
  }
  await expect(page.locator("#panelBody")).not.toContainText("5"); // [n] is never shown
  await deviceCode(page, "000000");
  await expect(page.locator("#accountLocked .step-title").first()).toHaveText("Account locked");
  await expect(page.locator("#accountLocked .step-sub")).toHaveText("Too many incorrect codes. Try again in 2 hours.");
  await expect(page.locator("#lockCountdown")).toHaveText(/^1:59:[45]\d$/);
  const ev = events(page).locator("li", { hasText: "account.locked" });
  await expect(ev).toHaveCount(1);
  await expect(ev).toContainText('"widget":"wallet","reason":"too_many_incorrect_codes"');
});

test("wallet: while locked no money moves (Send, Convert, Deposit, turning on instant transfers); balances still show", async ({ page }) => {
  await toDeviceCode(page);
  for (let i = 0; i < 5; i++) await deviceCode(page, "000000");
  await expect(page.locator("#accountLocked")).toBeVisible();
  await page.locator("#lockedClose").click();
  await expect(page.locator("#actSend")).toBeVisible(); // the home and balances are there
  await page.locator("#actSend").click();
  await expect(page.locator("#accountLocked")).toBeVisible();
  await page.locator("#lockedClose").click();
  await page.locator("#actConvert").click();
  await expect(page.locator("#accountLocked")).toBeVisible();
  await page.locator("#lockedClose").click();
  await page.evaluate(() => (window as any).__ngn.getState().open("deposit-method")); // eslint-disable-line @typescript-eslint/no-explicit-any
  await expect(page.locator("#accountLocked")).toBeVisible();
  await page.locator("#lockedClose").click();
  await page.getByLabel("Instant transfers default").selectOption("off");
  await page.locator("#openSettingsHeader").click();
  await page.locator("#openInstantTransfers").click();
  await page.locator("#instantSwitch").click();
  await expect(page.locator("#accountLocked")).toBeVisible();
});

test("wallet: Skip lock time (demo) ends it; the step comes back where it was and a right code carries on", async ({ page }) => {
  await toDeviceCode(page);
  await expect(page.locator("#demoSkipLock")).toHaveCount(0); // only on the locked screen
  for (let i = 0; i < 5; i++) await deviceCode(page, "000000");
  await page.locator("#demoSkipLock").click();
  await expect(title(page)).toHaveText("Confirm this device");
  await deviceCode(page, "123456");
  await expect(title(page)).toHaveText("Enter your PIN");
});

test("wallet: the countdown runs live, and the lock ends on its own after 2 hours", async ({ page }) => {
  await page.clock.install();
  await toDeviceCode(page);
  for (let i = 0; i < 5; i++) { await deviceCode(page, "000000"); await page.clock.runFor(1000); }
  await expect(page.locator("#lockCountdown")).toHaveText(/^1:59:[45]\d$/);
  await page.clock.runFor(60 * 60 * 1000);
  await expect(page.locator("#lockCountdown")).toHaveText(/^0:59:[45]\d$/);
  await page.clock.runFor(60 * 60 * 1000);
  await expect(page.locator("#accountLocked")).toHaveCount(0);
  await expect(title(page)).toHaveText("Confirm this device");
});

/** Checkout: a new user on the code step. */
async function checkoutCode(page: Page) {
  await page.goto("/demo/ile-living");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();
  return widget;
}
async function otp(page: Page, code: string) {
  const boxes = page.locator("#otp input");
  for (let i = 0; i < 6; i++) await boxes.nth(i).fill(code[i]);
}

test("Checkout: the 5th wrong sign-up code locks the account; account.locked; reopening shows the lock; Skip lock time back to signing in", async ({ page }) => {
  const widget = await checkoutCode(page);
  for (let i = 0; i < 4; i++) {
    await otp(page, "000000");
    await expect(widget.locator(".otp-status")).toHaveText("That code isn’t right. Check it and try again.");
  }
  await otp(page, "000000");
  await expect(widget.getByRole("heading", { name: "Account locked" })).toBeVisible();
  await expect(widget.locator("#accountLocked .sub")).toHaveText("Too many incorrect codes. Try again in 2 hours.");
  await expect(widget.locator("#lockCountdown")).toHaveText(/^1:59:[45]\d$/);
  await expect(widget.locator(".steps")).toHaveCount(0);
  await expect(events(page).locator("li", { hasText: "account.locked" })).toContainText('"widget":"checkout","reason":"too_many_incorrect_codes"');

  await widget.locator("#lockedBack").click();
  await expect(widget).toHaveCount(0);
  await page.locator("#payWithPoket").click();
  await expect(widget.getByRole("heading", { name: "Account locked" })).toBeVisible(); // still locked
  await expect(events(page).locator("li", { hasText: "account.locked" })).toHaveCount(1); // told once

  await page.locator("#demoBtn").click(); // DEMO: Skip lock time
  await expect(widget.getByRole("heading", { name: "Verify your email" })).toBeVisible();
});

test("Checkout: a returning customer is locked out too while the lock lasts", async ({ page }) => {
  const widget = await checkoutCode(page);
  for (let i = 0; i < 5; i++) await otp(page, "000000");
  await expect(widget.getByRole("heading", { name: "Account locked" })).toBeVisible();
  await widget.locator("#lockedBack").click();
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  await expect(widget.getByRole("heading", { name: "Account locked" })).toBeVisible();
  await expect(widget.locator("#payGo")).toHaveCount(0);
});

test("mock: device codes and Checkout codes count together; a right code resets the count; nothing passes while locked", async () => {
  const { verifyCode, accountLockedUntil, skipAccountLock, CODE_LIMIT_DEMO, ACCOUNT_LOCK_MS } = await import("@/lib/mock-api");
  skipAccountLock();
  expect(CODE_LIMIT_DEMO).toBe(5);
  expect(ACCOUNT_LOCK_MS).toBe(2 * 60 * 60 * 1000);
  // 4 wrong, then a right one: the count starts again
  for (let i = 0; i < 4; i++) await expect(verifyCode("000000")).rejects.toThrow("That code isn’t right");
  await verifyCode("123456");
  for (let i = 0; i < 4; i++) await expect(verifyCode("000000")).rejects.toThrow("That code isn’t right");
  expect(accountLockedUntil()).toBeNull();
  // The 5th in a row (from either widget: one shared check) locks it for 2 hours
  await expect(verifyCode("000000")).rejects.toThrow("account_locked");
  const until = accountLockedUntil()!;
  expect(until - Date.now()).toBeGreaterThan(ACCOUNT_LOCK_MS - 5000);
  await expect(verifyCode("123456")).rejects.toThrow("account_locked"); // even the right code
  skipAccountLock();
  await verifyCode("123456");
});

test("across both widgets: 3 wrong device codes in the wallet, then 2 at Checkout lock the account; the wallet shows the lock", async ({ page }) => {
  await toDeviceCode(page);
  for (let i = 0; i < 3; i++) {
    await deviceCode(page, "000000");
    await expect(page.locator("#deviceStatus")).toHaveText("That code isn’t right. Check it and try again.");
  }
  // To Checkout by the demo bar's link (no reload), so the one mock (and its count) carries over, as one account would
  await page.locator("#demoToCheckout").click();
  await expect(page).toHaveURL(/\/demo\/ile-living$/);
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();
  await otp(page, "000000");
  await expect(widget.locator(".otp-status")).toHaveText("That code isn’t right. Check it and try again."); // the 4th
  await otp(page, "000000");
  await expect(widget.getByRole("heading", { name: "Account locked" })).toBeVisible(); // the 5th, across both
  await expect(events(page).locator("li", { hasText: "account.locked" })).toContainText('"widget":"checkout"');

  // Back in the wallet: the send left at its device step shows the lock; closed, a new Send does too
  await page.locator("#demoToWallet").click();
  await expect(page).toHaveURL(/\/demo\/wallet$/);
  await expect(page.locator("#accountLocked")).toBeVisible();
  await expect(page.locator("#lockCountdown")).toHaveText(/^1:59:[0-5]\d$/);
  await page.locator("#lockedClose").click();
  await page.locator("#actSend").click();
  await expect(page.locator("#accountLocked")).toBeVisible();
});
