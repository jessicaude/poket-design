import { test, expect, type Page } from "@playwright/test";

/**
 * NGN withdrawal: a first payment to an account shows "sends after [hold]" on amount and review, and the amount
 * is reserved from the balance once the PIN is accepted. Seed: "Naira account" (lb2) has been paid before;
 * "Ngozi Eze" (r6) and newly added accounts haven't.
 */

const NOTICE = "First payment to a new account sends after [hold]";
const title = (page: Page) => page.locator("#panelBody .step-title").first();
const ngn = (page: Page) => page.evaluate(() => {
  const s = (window as any).__ngn.getState(); // eslint-disable-line @typescript-eslint/no-explicit-any
  return { balance: s.ngnBalance as number, reserved: s.ngnReserved as number };
});

async function toAmount(page: Page, recipient: string) {
  await page.goto("/demo/wallet");
  await page.getByLabel("PIN", { exact: true }).selectOption("set"); // demo PIN 1234
  await page.locator("#ngnWithdraw").click();
  await page.locator(`[data-payoutrecipient="${recipient}"]`).click();
  await page.locator("#payoutRecipientContinue").click();
  await expect(page.locator(".keypad")).toBeVisible();
}
async function typeAmount(page: Page, digits: string) {
  for (const d of digits) await page.locator(`[data-payoutkey="${d}"]`).click();
}
async function toPin(page: Page) {
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await expect(title(page)).toHaveText("Enter your PIN");
}
async function typePin(page: Page, pin: string) {
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type(pin);
}

test("first payment: notice on amount and review; reserved at the PIN; held until [hold]", async ({ page }) => {
  await toAmount(page, "other:r6");
  await expect(page.locator("#firstPaymentNotice")).toHaveText(NOTICE);
  await typeAmount(page, "500000");
  await page.locator("#payoutReview").click();
  await expect(page.locator("#firstPaymentNotice")).toHaveText(NOTICE);
  await expect(page.locator("#panelBody .receipt-row", { hasText: "Delivery" }).locator(".r-value")).toHaveText("After [hold]");
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();

  // Nothing is reserved until the PIN is accepted: not at review, not on a wrong PIN
  await expect(title(page)).toHaveText("Enter your PIN");
  expect(await ngn(page)).toEqual({ balance: 5000000, reserved: 0 });
  await typePin(page, "0000");
  await expect(page.locator("#panelBody .step-sub")).toContainText("Incorrect PIN. 2 attempts left.");
  expect(await ngn(page)).toEqual({ balance: 5000000, reserved: 0 });

  await typePin(page, "1234");
  await expect(title(page)).toHaveText("Sending payout…");
  await expect.poll(() => ngn(page)).toEqual({ balance: 4500000, reserved: 500000 });

  await expect(title(page)).toHaveText("₦5,000.00 NGN");
  await expect(page.locator("#panelBody .step-sub")).toHaveText("Sends to Ngozi Eze after [hold]");
  await expect(page.locator("#panelBody .receipt-row.total")).toContainText("Estimated deliveryAfter [hold]");
  expect(await ngn(page)).toEqual({ balance: 4500000, reserved: 500000 }); // still reserved while held
  await page.locator("#payoutDone").click();
  await expect(page.locator('#panelBody [data-holdbucket="open"] .tx-amt')).toHaveText("₦45,000.00 NGN");

  // The account has now been paid: no notice next time
  await page.locator("#ngnWithdraw").click();
  await page.locator('[data-payoutrecipient="other:r6"]').click();
  await page.locator("#payoutRecipientContinue").click();
  await expect(page.locator(".keypad")).toBeVisible();
  await expect(page.locator("#firstPaymentNotice")).toHaveCount(0);
});

test("account paid before: no notice; reserved at the PIN and still while Sending", async ({ page }) => {
  await toAmount(page, "self:lb2");
  await expect(page.locator("#firstPaymentNotice")).toHaveCount(0);
  await typeAmount(page, "1000000");
  await toPin(page);
  await expect(page.locator("#firstPaymentNotice")).toHaveCount(0);
  await typePin(page, "1234");
  await expect.poll(() => ngn(page)).toEqual({ balance: 4000000, reserved: 1000000 });
  await expect(page.locator("#panelBody .step-sub")).toHaveText("On its way to Naira account");
  expect(await ngn(page)).toEqual({ balance: 4000000, reserved: 1000000 }); // cleared once paid (ngn-withdrawal-status.spec)
  await expect(page.locator("#panelBody .receipt-row.total")).toContainText("Estimated arrivalUsually within seconds");
});

test("a newly added account gets the notice", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.locator("#ngnWithdraw").click();
  await page.locator("#addPayoutOtherBtn").click();
  await page.locator("#ngnBankRow").click();
  await page.locator("[data-ngnbank]", { hasText: "Zenith Bank" }).click();
  await page.locator("#ngnAcctInput").fill("2045671111");
  await page.locator("#ngnThirdPartyOk").check();
  await page.locator("#ngnAcctSave").click();
  await page.locator("#payoutRecipientContinue").click();
  await expect(page.locator("#firstPaymentNotice")).toHaveText(NOTICE);
});
