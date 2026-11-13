import { test, expect, type Page } from "@playwright/test";
import { expectSelfie, passSelfie } from "./selfie";

/**
 * The selfie check before a send's PIN, in place of the step-up placeholder: over ₦[step-up] (demo ₦20,000), or with
 * the demo's "Flag as unusual" on. Checkout's vendor and "Checking your ID" screens. Outcomes (demo bar "Selfie
 * check"): passes (on to the PIN), needs retry, declined. Failures count toward the 3 ID check attempts (shared with
 * NGN ID matches); the 3rd holds the send for review and blocks the account.
 */

const title = (page: Page) => page.locator("#panelBody .step-title").first();
async function start(page: Page, outcome: "pass" | "retry" | "declined" = "pass") {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.getByLabel("Selfie check").selectOption(outcome);
}
/** Send to the Naira account (paid before), review, Send. */
async function toConfirm(page: Page, digits: string) {
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  await page.locator("#youSend").click();
  for (const d of digits) await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
}
const ngn = (page: Page) => page.evaluate(() => { const n = (window as any).__ngn.getState(); return { balance: n.ngnBalance as number, reserved: n.ngnReserved as number, attempts: n.attempts as number }; }); // eslint-disable-line @typescript-eslint/no-explicit-any

test("at or under ₦[step-up]: no selfie check; Flag as unusual asks for one on any send; passing goes on to the PIN", async ({ page }) => {
  await start(page);
  await toConfirm(page, "500000"); // ₦5,000
  await expect(title(page)).toHaveText("Enter your PIN");
  await page.locator("#backToPayoutReview").click();
  await page.getByLabel("Flag as unusual").selectOption("on");
  await page.locator("#confirmPayout").click();
  await expectSelfie(page);
  await expect(page.locator("#panelBody .vendor .opt")).toContainText("Scan the QR code");
  await page.locator("#demoSelfieOpen").click();
  await expect(page.locator("#panelBody .vendor .wait")).toHaveText("Take a short selfie video on your phone. Keep this window open.");
  await page.locator("#demoSelfieFinish").click();
  await expect(title(page)).toHaveText("Checking your ID");
  await expect(title(page)).toHaveText("Enter your PIN");
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
  expect((await ngn(page)).attempts).toBe(0);
});

test("needs retry: the reference's selfie reasons and tries left; Try again goes back to the handoff; Finish later to review", async ({ page }) => {
  await start(page, "retry");
  await toConfirm(page, "2500000"); // ₦25,000: over ₦[step-up]
  await passSelfie(page);
  await expect(title(page)).toHaveText("We couldn't read your ID");
  await expect(page.locator("#selfieReason")).toHaveText("We couldn't see your face clearly. Try again in good light.");
  await expect(page.locator("#selfieTriesLeft")).toHaveText("2 tries left");
  await page.locator("#selfieTryAgain").click();
  await passSelfie(page);
  await expect(page.locator("#selfieReason")).toHaveText("Your selfie was blurry. Hold your phone still.");
  await expect(page.locator("#selfieTriesLeft")).toHaveText("1 try left");
  await page.locator("#selfieLater").click();
  await expect(page.locator("#confirmPayout")).toBeVisible();
  expect(await ngn(page)).toMatchObject({ reserved: 0, attempts: 2 }); // nothing reserved without the PIN
});

test("declined: Checkout's wording with tries left", async ({ page }) => {
  await start(page, "declined");
  await toConfirm(page, "2500000");
  await passSelfie(page);
  await expect(title(page)).toHaveText("We couldn't verify your identity");
  await expect(page.locator("#selfieReason")).toHaveCount(0);
  await expect(page.locator("#selfieTriesLeft")).toHaveText("2 tries left");
});

test("the 3rd failure holds the send for review (no PIN) and the account shows the blocked state", async ({ page }) => {
  await start(page, "declined");
  await toConfirm(page, "2500000");
  for (let i = 0; i < 2; i++) { await passSelfie(page); await page.locator("#selfieTryAgain").click(); }
  await passSelfie(page);
  // Held for review: reserved, not sent, never asked for the PIN
  await expect(page.locator("#heldForReview")).toHaveText("Held for review");
  await expect(page.locator("#heldForReviewNote")).toHaveText("We're checking this payment. We'll let you know.");
  expect(await ngn(page)).toMatchObject({ balance: 5000000 - 2500000, reserved: 2500000, attempts: 3 });
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Held for review");
  await page.locator("#backFromTxDetail").click();

  // Blocked: no money moves (Send, Convert); balances still show
  await page.locator("#actSend").click();
  await expect(page.locator("#accountBlocked .step-title")).toHaveText("We couldn't verify your identity");
  await expect(page.locator("#accountBlocked .step-sub")).toHaveText("If you think this is a mistake, contact Poket support.");
  await page.locator("#blockedClose").click();
  await page.locator("#actConvert").click();
  await expect(page.locator("#accountBlocked")).toBeVisible();
  await page.locator("#blockedClose").click();
  await expect(page.locator("#actSend")).toBeVisible();
});

test("failures count with other ID checks: 2 NGN ID mismatches already, so one failed selfie check holds the send", async ({ page }) => {
  await start(page, "retry");
  await page.evaluate(() => (window as any).__ngn.getState().set({ attempts: 2 })); // eslint-disable-line @typescript-eslint/no-explicit-any
  await toConfirm(page, "2500000");
  await passSelfie(page);
  await expect(page.locator("#heldForReview")).toHaveText("Held for review");
  // ...and the NGN account's ID check is locked too (the same 3 attempts)
  await page.locator("#payoutDone").click();
  await page.getByLabel("Tier").selectOption("1");
  await page.evaluate(() => (window as any).__nav.getState().home()); // eslint-disable-line @typescript-eslint/no-explicit-any
  expect((await ngn(page)).attempts).toBe(3);
});
