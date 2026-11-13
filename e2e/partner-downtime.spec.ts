import { test, expect, type Page } from "@playwright/test";

/**
 * WGT-13, partner downtime. Demo bar "Naira partner: Up / Down" (in both widgets' bars, one shared state). While down:
 * a banner tops the wallet home, the NGN balance and the affected naira screens; Deposit NGN’s Bank transfer and
 * getting NGN account details are paused (no accounts created; Convert instead); existing account details stay, with
 * a Paused chip and "Transfers may arrive late."; sends to Nigerian banks can’t be reviewed and the name enquiry is
 * unavailable; sends already Sending stay Sending; Checkout’s naira bank transfer is Paused. Poket users, Convert,
 * cards and balances are unaffected. Back up, everything is as before.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const COPY = "Naira bank transfers are paused. Your balance is safe, and sending to Poket users, converting and card payments still work.";
const banner = (page: Page) => page.locator("#panelBody #nairaPaused");
const title = (page: Page) => page.locator("#panelBody .step-title").first();
const partner = (page: Page, v: "up" | "down") => page.getByLabel("Naira partner").selectOption(v);
async function start(page: Page, path = "/demo/wallet") {
  await page.goto(path);
  await expect(page.locator("#panelBody")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
}
async function ngnBalance(page: Page) {
  await page.locator('[data-wallettab="cash"]').click();
  await page.locator('#panelBody [data-holdcur="NGN"][data-holdbucket="open"]').click();
  await expect(page.locator("#ngnBalanceAmount")).toBeVisible();
}
/** Send → a recipient → an amount (keypad), on the amount screen. */
async function toAmount(page: Page, recipient: string, digits?: string) {
  await page.locator("#actSend").click();
  await page.locator(`[data-sendrecipient="${recipient}"]`).click();
  await expect(page.locator("#youSend")).toBeVisible();
  if (!digits) return;
  await page.locator("#youSend").click();
  for (const d of digits) await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
}
async function sendWithPin(page: Page) {
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
}

test("up: no banner anywhere", async ({ page }) => {
  await start(page);
  await expect(page.getByLabel("Naira partner")).toHaveValue("up");
  await expect(banner(page)).toHaveCount(0);
  await ngnBalance(page);
  await expect(banner(page)).toHaveCount(0);
});

test("down: the banner tops the home and the NGN balance screen, in the wallet’s warning style; back up, it goes", async ({ page }) => {
  await start(page);
  await partner(page, "down");
  await expect(banner(page)).toHaveText(COPY);
  await expect(banner(page)).toHaveClass("alert warn");
  expect(await page.locator("#panelBody .screen-fade").first().evaluate((el) => el.firstElementChild?.id)).toBe("nairaPaused");
  await ngnBalance(page);
  await expect(banner(page)).toHaveText(COPY);
  await partner(page, "up");
  await expect(banner(page)).toHaveCount(0);
});

test("Deposit NGN > Bank transfer: paused, with Convert; no temporary account; back up, the step returns", async ({ page }) => {
  await start(page, "/demo/wallet?ngn=deposit-method");
  await partner(page, "down");
  await expect(title(page)).toHaveText("Deposit NGN");
  await expect(banner(page)).toHaveText(COPY);
  await page.locator("#dmBank").click();
  await expect(title(page)).toHaveText("Add naira"); // Tier 0: straight to a temporary account’s amount, paused
  await expect(page.locator("#ngnPaused")).toHaveText("Bank transfers into naira are paused. Try again later, or convert from USD.");
  await expect(page.locator("#ngnAmt")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__ngn.getState().temp)).toBeNull();
  // Back up: the amount step again
  await partner(page, "up");
  await expect(page.locator("#ngnAmt")).toBeVisible();
  await expect(page.locator("#ngnPaused")).toHaveCount(0);
  // Down again: Convert opens Convert into NGN
  await partner(page, "down");
  await page.locator("#ngnPausedConvert").click();
  await expect(page.locator("#cvPickTo .cv-pick-name, #cvEmpty").first()).toBeVisible();
  expect(await page.evaluate(() => (window as any).__convert.getState().stage)).toBeTruthy();
});

test("Tier 1: Bank transfer’s choice is paused too", async ({ page }) => {
  await start(page, "/demo/wallet?ngn=deposit-method");
  await page.getByLabel("Tier").selectOption("1");
  await partner(page, "down");
  await page.locator("#dmBank").click();
  await expect(title(page)).toHaveText("Bank transfer");
  await expect(page.locator("#ngnPaused")).toBeVisible();
  await expect(page.locator("#ngnPickTemp")).toHaveCount(0);
});

test("getting NGN account details is paused, with the same message", async ({ page }) => {
  await start(page);
  await page.getByLabel("Tier").selectOption("1");
  await partner(page, "down");
  await ngnBalance(page);
  await page.locator("#vaOpen").click();
  await expect(title(page)).toHaveText("Bank transfer");
  await expect(page.locator("#ngnPaused")).toHaveText("Bank transfers into naira are paused. Try again later, or convert from USD.");
  // Already at the terms: paused there too, and nothing is created
  await page.evaluate(() => (window as any).__ngn.getState().set({ stage: "intro", ngnId: { route: "bvn", last4: "5678" } }));
  await expect(title(page)).toHaveText("Get NGN account details");
  await expect(page.locator("#ngnPaused")).toBeVisible();
  await expect(page.locator("#vaCreate")).toHaveCount(0);
  await partner(page, "up");
  await expect(page.locator("#vaCreate")).toBeVisible();
});

test("an existing dedicated account: details stay, with Paused and 'Transfers may arrive late.'; the card shows Paused", async ({ page }) => {
  await start(page);
  await page.getByLabel("Tier").selectOption("1");
  await page.evaluate(() => (window as any).__ngn.getState().set({ dedicated: { status: "ready", num: "8812345678" } }));
  await ngnBalance(page);
  await expect(page.locator("#vaOpen .va-status")).toHaveText("Ready");
  await partner(page, "down");
  await expect(page.locator("#vaOpen .va-status")).toHaveText("Paused");
  await page.locator("#vaOpen").click();
  await expect(title(page)).toContainText("NGN account details");
  await expect(page.locator("#vaPaused")).toHaveText("Paused");
  await expect(page.locator("#pausedLate")).toHaveText("Transfers may arrive late.");
  await expect(page.locator("#panelBody .va-field")).not.toHaveCount(0); // the details stay visible
  await expect(page.locator("#vaShare")).toBeVisible();
  await partner(page, "up");
  await expect(page.locator("#vaPaused")).toHaveCount(0);
  await expect(page.locator("#pausedLate")).toHaveCount(0);
});

test("an existing temporary account: details stay, with Paused and 'Transfers may arrive late.'", async ({ page }) => {
  await start(page, "/demo/wallet?ngn=deposit-method");
  await page.locator("#dmBank").click();
  await page.locator("#ngnAmt").fill("5000");
  await page.locator("#ngnTempGo").click();
  await expect(title(page)).toHaveText(/^Send exactly/);
  await partner(page, "down");
  await expect(page.locator("#vaPaused")).toHaveText("Paused");
  await expect(page.locator("#pausedLate")).toHaveText("Transfers may arrive late.");
  await expect(page.locator("#ngnCount")).toBeVisible(); // still counting down
  await expect(page.locator("[data-ngncopy]")).not.toHaveCount(0);
});

test("Send to a Nigerian bank: only 'Sending to banks is paused.' (no banner) on amount and review, Review and Send disabled; back up, it can go", async ({ page }) => {
  await start(page);
  await partner(page, "down");
  await toAmount(page, "bank:lb2", "500000");
  await expect(page.locator("#sendPaused")).toHaveText("Sending to banks is paused. Try again later.");
  await expect(banner(page)).toHaveCount(0); // only its own message, as on the paused deposit screens
  await expect(page.locator("#payoutReview")).toBeDisabled();
  await expect(page.locator("#instantOffNotice")).toHaveCount(0);
  await partner(page, "up");
  await expect(page.locator("#sendPaused")).toHaveCount(0);
  await expect(page.locator("#payoutReview")).toBeEnabled();
  // On review when it goes down: Send is disabled
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await expect(page.locator("#confirmPayout")).toBeEnabled();
  await partner(page, "down");
  await expect(page.locator("#sendPaused")).toHaveText("Sending to banks is paused. Try again later.");
  await expect(banner(page)).toHaveCount(0);
  await expect(page.locator("#confirmPayout")).toBeDisabled();
  await partner(page, "up");
  await expect(page.locator("#sendPaused")).toHaveCount(0);
  await expect(page.locator("#confirmPayout")).toBeEnabled();
});

test("adding a Nigerian bank: the name enquiry shows its unavailable state", async ({ page }) => {
  await start(page);
  await partner(page, "down");
  await page.locator("#actSend").click();
  await page.locator("#newRecipient").click();
  await page.locator('[data-newkind="bank"]').click();
  await page.locator('[data-sendcur="NGN"]').click();
  await expect(banner(page)).toHaveText(COPY);
  await page.locator("#ngnBankRow").click();
  await page.locator("#ngnBankSearch").fill("zen");
  await page.locator("[data-ngnbank]", { hasText: "Zenith Bank" }).click();
  await page.locator("#ngnAcctInput").fill("0123456789");
  await expect(page.locator("#panelBody .alert.warn[role=alert]")).toHaveText("We can’t check the name on the account right now. Try again");
  await expect(page.locator("#ngnAcctSave")).toBeDisabled();
  await partner(page, "up");
  await page.locator("#ngnEnquiryRetry").click();
  await expect(page.locator("#ngnAcctName")).toHaveText("Ada Osun");
});

test("a send already Sending stays Sending until the partner is back", async ({ page }) => {
  await start(page);
  await toAmount(page, "bank:r6", "500000"); // a first payment to Ngozi: scheduled, then released
  await sendWithPin(page);
  await page.locator("#viewPayoutTx").click();
  const chip = page.locator("#withdrawalStatus");
  await expect(chip).toHaveText("Scheduled");
  await partner(page, "down");
  await page.getByRole("button", { name: "Release first-payment hold" }).click();
  await expect(chip).toHaveText("Sending");
  await expect(banner(page)).toHaveText(COPY);
  await expect(page.getByRole("button", { name: "Mark paid" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Fail" })).toBeDisabled();
  await page.waitForTimeout(2500); // longer than the release’s usual 1.5s
  await expect(chip).toHaveText("Sending");
  await partner(page, "up");
  await expect(chip).toHaveText("Paid");
  await expect(banner(page)).toHaveCount(0);
});

test("unaffected: Poket users, other banks and Convert", async ({ page }) => {
  await start(page);
  await partner(page, "down");
  await toAmount(page, "poket:pu1", "300000");
  await expect(banner(page)).toHaveCount(0);
  await expect(page.locator("#sendPaused")).toHaveCount(0);
  await expect(page.locator("#payoutReview")).toBeEnabled();
  await page.locator("#backToPayoutRecipient2").click();
  await page.locator('[data-sendrecipient="bank:lb1"]').click();
  await expect(page.locator("#sendPaused")).toHaveCount(0);
  await page.locator("#backToPayoutRecipient2").click();
  await page.locator("#backFromSend").click();
  await page.locator("#actConvert").click();
  await expect(page.locator("#actConvert")).toHaveCount(0);
  await expect(banner(page)).toHaveCount(0);
});

test("Checkout: naira bank transfer is marked Paused and can’t be chosen; naira and dollar cards still work", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Order currency").selectOption("NGN");
  await partner(page, "down");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();
  const boxes = page.locator("#otp input");
  for (let i = 0; i < 6; i++) await boxes.nth(i).fill("123456"[i]);
  await expect(widget.getByRole("heading", { name: "Add a payment method" })).toBeVisible();
  const bank = widget.locator('[data-addpm="ngn-bank"]');
  await expect(bank.locator(".chip")).toHaveText("Paused");
  await expect(bank).toHaveAttribute("aria-disabled", "true");
  await expect(bank).toHaveClass(/\boff\b/);
  await bank.click({ force: true });
  await expect(widget.getByRole("heading", { name: "Add a payment method" })).toBeVisible(); // nothing happened
  await expect(widget.locator('[data-addpm="ngn-card"]')).not.toHaveAttribute("aria-disabled", "true");
  await widget.locator('[data-addpm="ngn-card"]').click();
  await expect(widget.getByRole("heading", { name: "Add a card" })).toBeVisible();
});

test("one partner state for both widgets: set Down in the wallet, Checkout’s bar shows Down", async ({ page }) => {
  await start(page);
  await partner(page, "down");
  await page.locator("#demoToCheckout").click();
  await expect(page).toHaveURL(/\/demo\/ile-living$/);
  await expect(page.getByLabel("Naira partner")).toHaveCount(0); // a USD order: the control isn’t shown
  await page.getByLabel("Order currency").selectOption("NGN");
  await expect(page.getByLabel("Naira partner")).toHaveValue("down");
});

test("recovery: the banner clears, transfers that arrived while down are credited with a notification each, Sending sends are Paid", async ({ page }) => {
  await start(page);
  const balance = () => page.evaluate(() => (window as any).__ngn.getState().ngnBalance as number);
  // A send to the Naira account (paid before): Sending at once
  await toAmount(page, "bank:lb2", "500000");
  await sendWithPin(page);
  await page.locator("#viewPayoutTx").click();
  const chip = page.locator("#withdrawalStatus");
  await expect(chip).toHaveText("Sending");
  const before = await balance();

  await partner(page, "down");
  await expect(page.locator("#demoQueuedArrival")).toHaveText("Transfer arrived while down");
  await page.locator("#demoQueuedArrival").click();
  await page.locator("#demoQueuedArrival").click();
  await expect(page.locator("#demoQueuedArrival")).toHaveText("Transfer arrived while down (2)");
  await page.waitForTimeout(500);
  expect(await balance()).toBe(before); // nothing credited while down
  await expect(page.locator("#openNotifHeader")).toBeHidden();
  await expect(chip).toHaveText("Sending");

  await partner(page, "up");
  await expect(banner(page)).toHaveCount(0);
  await expect(page.locator("#demoQueuedArrival")).toHaveCount(0);
  await expect(chip).toHaveText("Paid");
  await expect.poll(balance).toBe(before + 2 * 2500000); // ₦25,000.00 each
  await page.locator("#openNotifHeader").click();
  const notes = page.locator("#panelBody [data-notif] .settings-row-sub", { hasText: "after a delay." });
  await expect(notes).toHaveText(["₦25,000.00 from Chinedu Eze added to your NGN balance, after a delay.", "₦25,000.00 from Chinedu Eze added to your NGN balance, after a delay."]);

  // Down and up again with nothing queued: no new credit or notification
  await partner(page, "down");
  await partner(page, "up");
  await page.waitForTimeout(300);
  expect(await balance()).toBe(before + 2 * 2500000);
  await expect(notes).toHaveCount(2);
});

test("while down, a temporary account’s 'Transfer arrives' gives way to 'Transfer arrived while down'", async ({ page }) => {
  await start(page, "/demo/wallet?ngn=deposit-method");
  await page.locator("#dmBank").click();
  await page.locator("#ngnAmt").fill("5000");
  await page.locator("#ngnTempGo").click();
  await expect(title(page)).toHaveText(/^Send exactly/);
  await expect(page.getByRole("button", { name: "Transfer arrives", exact: true })).toBeVisible();
  await partner(page, "down");
  await expect(page.getByRole("button", { name: "Transfer arrives", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Let it expire" })).toBeVisible();
  await expect(page.locator("#demoQueuedArrival")).toBeVisible();
});
