import { test, expect, type Page } from "@playwright/test";

/** Sending to a Nigerian bank account (tPayout's amount, review and done), with the checkout's PIN steps, in the wallet demo. */

const title = (page: Page) => page.locator("#panelBody .step-title").first();

async function toAmount(page: Page, recipient: string) {
  await page.goto("/demo/wallet");
  await page.locator("#actSend").click();
  await expect(title(page)).toHaveText("Send");
  await page.locator(`[data-sendrecipient="bank:${recipient.split(":")[1]}"]`).click(); // straight to the amount
  await expect(page.locator(".keypad")).toBeVisible();
}
async function typeAmount(page: Page, digits: string) {
  for (const d of digits) await page.locator(`[data-payoutkey="${d}"]`).click();
}
async function toPin(page: Page) {
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await expect(page.locator("#panelBody .otp-box")).toHaveCount(4);
}
async function typePin(page: Page, pin: string) {
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type(pin);
}

// Later steps of a send can be previewed with ?send=<stage>: a send to a saved recipient (Ngozi Eze) from the NGN balance.
test("previews: ?send=review and ?send=ngn-account start in Send", async ({ page }) => {
  await page.goto("/demo/wallet?send=review");
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("to Ngozi Eze");
  await page.locator("#backToPayoutAmount").click();
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("NGN");
  await page.locator("#backToPayoutRecipient2").click();
  await expect(title(page)).toHaveText("Send");
  await page.goto("/demo/wallet?send=ngn-account");
  await expect(title(page)).toHaveText("Add a bank account");
  await page.locator("#backToPayoutRecipient").click();
  await expect(title(page)).toHaveText("Currency"); // Send's currency step for a new bank account
});

test("to your own account: amount, review, create the PIN, done", async ({ page }) => {
  await toAmount(page, "self:lb2");
  const body = page.locator("#panelBody");
  await expect(page.locator("#payoutReview")).toBeDisabled();
  await typeAmount(page, "12500000");
  await page.locator('[data-payoutkey="back"]').click();
  await expect(body.locator(".amount-value")).toHaveText("₦12,500.00 NGN");
  await expect(page.locator("#payoutSpeedPill")).toHaveText("Usually within seconds · ₦[fee] fee");
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("NGN"); // You send: the NGN balance
  await expect(page.locator("#panelBody .cv-box-top")).toContainText("Available ₦50,000.00 NGN");

  await expect(page.locator("#firstPaymentNotice")).toHaveCount(0); // Naira account has been paid before
  await page.locator("#payoutReview").click();
  await expect(page.locator("#firstPaymentNotice")).toHaveCount(0);
  await expect(body.locator(".receipt-row .r-label")).toHaveText(["To", "They get", "Fee", "Arrives", "Debited from balance"]);
  await expect(body.locator(".receipt-row .r-value")).toHaveText(["GTBank · •••• 6789", "₦12,500.00 NGN", "₦[fee]", "Usually within seconds", "₦12,500.00 NGN + ₦[fee]"]);
  await expect(body.locator(".status-pill")).toHaveCount(0); // no Standard / Instant for NGN
  await expect(body.locator(".fine-print")).toHaveCount(0);
  await expect(page.locator("#confirmPayout")).toBeDisabled();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();

  // First payout: create and confirm the PIN. A mismatch starts over.
  await expect(body.locator(".step-eyebrow")).toHaveText("One-time setup");
  await expect(title(page)).toHaveText("Create your PIN");
  await expect(body.locator(".otp-hint")).toHaveText("Different from your passcode. Never sent to you.");
  await typePin(page, "1234");
  await expect(title(page)).toHaveText("Confirm your PIN");
  await typePin(page, "9999");
  await expect(title(page)).toHaveText("Create your PIN");
  await expect(body.locator(".step-sub")).toHaveText("Protects money leaving your account. 4 digits. PINs did not match. Start over.");
  await typePin(page, "1234");
  await expect(title(page)).toHaveText("Confirm your PIN");
  await typePin(page, "1234");

  await expect(title(page)).toHaveText("Sending…");
  await expect(title(page)).toHaveText("₦12,500.00 NGN");
  await expect(body.locator(".step-sub")).toHaveText("On its way to Naira account");
  await expect(body.locator(".receipt-row .r-value").first()).toHaveText(/^TXN-\d{6}$/);
  await expect(body.locator(".receipt-row.total")).toContainText("Estimated arrivalUsually within seconds");
  await page.locator("#payoutDone").click();
  // NGN fees aren't decided, so only the amount comes off the balance
  await page.locator('[data-wallettab="cash"]').click(); // NGN is under the Cash tab
  await expect(page.locator('#panelBody [data-holdcur="NGN"][data-holdbucket="open"] .tx-amt')).toHaveText("₦37,500.00 NGN");
});

test("wrong PIN: attempts left, locked after 3, reset with the emailed passcode", async ({ page }) => {
  await toAmount(page, "other:r6");
  await page.getByLabel("PIN", { exact: true }).selectOption("set"); // demo: PIN 1234
  await typeAmount(page, "500000");
  await page.locator("#payoutReview").click();
  const body = page.locator("#panelBody");
  await expect(body.locator(".receipt-row .r-label")).toHaveText(["To", "They get", "Fee", "Delivery", "Total charged"]);
  await expect(body.locator(".receipt-row .r-value")).toHaveText(["GTBank · •••• 6789", "₦5,000.00 NGN", "₦[fee]", "After [hold]", "₦5,000.00 NGN + ₦[fee]"]); // first payment to Ngozi Eze
  await expect(body).toContainText("I've reviewed the destination, fee, and delivery estimate above.");
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();

  await expect(body.locator(".step-eyebrow")).toHaveText("Security check");
  await expect(title(page)).toHaveText("Enter your PIN");
  for (const left of ["2 attempts left.", "1 attempt left."]) {
    await typePin(page, "0000");
    await expect(body.locator(".step-sub")).toHaveText(`Approves this payment. Incorrect PIN. ${left}`);
    await expect(body.locator(".otp-box").first()).toHaveValue("");
  }
  await typePin(page, "0000");
  await expect(title(page)).toHaveText("Too many attempts");
  await expect(body.locator(".step-sub")).toHaveText("Your PIN is locked. Reset it with a passcode sent to your email to keep sending.");
  await expect(body.locator(".fail-mark")).toBeVisible();

  await page.locator("#pinLockedReset").click();
  await expect(title(page)).toHaveText("Verify it is you");
  await expect(body.locator(".step-sub")).toHaveText("Enter the 6-digit passcode sent to ada@osun.co before you can set a new PIN.");
  await page.locator("#resend").click();
  await expect(page.locator("#resend")).toHaveText("Sent ✓");
  await body.locator(".otp-box").first().click();
  await page.keyboard.type("482913");
  await expect(title(page)).toHaveText("Create a new PIN");
  await expect(page.locator("#backToPayoutReview")).toHaveCount(0);
  await typePin(page, "4321");
  await expect(title(page)).toHaveText("Confirm your PIN");
  await typePin(page, "4321");
  await expect(title(page)).toHaveText("PIN updated");
  await expect(body.locator(".step-sub")).toHaveText("Your new PIN is set. Use it next time you send.");
  await page.locator("#doneToWallet").click();
  await expect(page.locator("#actSend")).toBeVisible();
  // Balance untouched: the payout wasn't sent
  await page.locator('[data-wallettab="cash"]').click(); // NGN is under the Cash tab
  await expect(page.locator('#panelBody [data-holdcur="NGN"][data-holdbucket="open"] .tx-amt')).toHaveText("₦50,000.00 NGN");
});

test("Cancel on the locked PIN returns to the wallet", async ({ page }) => {
  await toAmount(page, "self:lb2");
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await typeAmount(page, "100000");
  await toPin(page);
  for (const left of ["2 attempts", "1 attempt"]) {
    await typePin(page, "9876");
    await expect(page.locator("#panelBody .step-sub")).toContainText(`Incorrect PIN. ${left} left.`);
  }
  await typePin(page, "9876");
  await expect(title(page)).toHaveText("Too many attempts");
  await page.locator("#pinLockedClose").click();
  await expect(page.locator("#actSend")).toBeVisible();
});

test("NGN: only Nigerian bank accounts, no conversion, no speed choice; Max is the whole balance; Back steps back", async ({ page }) => {
  await toAmount(page, "other:r6");
  const body = page.locator("#panelBody");
  await expect(page.locator("#payoutSpeedPill")).toHaveText("After [hold] · ₦[fee] fee"); // first payment to Ngozi Eze
  await page.locator("#payoutMaxAmt").click();
  await expect(body.locator(".amount-value")).toHaveText("₦50,000.00 NGN");
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("NGN"); // You send: the NGN balance
  await expect(page.locator("#panelBody .cv-box-top")).toContainText("Available ₦50,000.00 NGN");
  await expect(body.locator(".info-card")).toHaveCount(0); // no exchange rate or "Recipient gets"
  await page.locator("#payoutReview").click();
  await expect(body.locator(".step-sub").first()).toHaveText("to Ngozi Eze");
  await expect(body.locator(".status-pill")).toHaveCount(0);
  await expect(body.locator(".receipt-row .r-label")).toHaveText(["To", "They get", "Fee", "Delivery", "Total charged"]);
  await expect(body.locator(".receipt-row .r-value")).toHaveText(["GTBank · •••• 6789", "₦50,000.00 NGN", "₦[fee]", "After [hold]", "₦50,000.00 NGN + ₦[fee]"]); // first payment to Ngozi Eze

  await page.locator("#backToPayoutAmount").click();
  await expect(body.locator(".amount-value")).toHaveText("₦50,000.00 NGN");
  await page.locator("#backToPayoutRecipient2").click();
  await expect(title(page)).toHaveText("Send"); // back to Send's recipients
});
