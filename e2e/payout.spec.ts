import { test, expect, type Page } from "@playwright/test";

/** Payout (tPayout) from the NGN balance, with the checkout's PIN steps, in the wallet demo. */

const title = (page: Page) => page.locator("#panelBody .step-title").first();

async function toAmount(page: Page, recipient: string) {
  await page.goto("/demo/wallet");
  await page.locator("#ngnWithdraw").click();
  await expect(title(page)).toHaveText("Recipient");
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
  await expect(page.locator("#panelBody .otp-box")).toHaveCount(4);
}
async function typePin(page: Page, pin: string) {
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type(pin);
}

test("home: NGN balance row and Withdraw", async ({ page }) => {
  await page.goto("/demo/wallet");
  const row = page.locator('#panelBody [data-holdcur="NGN"]');
  await expect(row.locator(".tx-title")).toHaveText("Nigerian Naira");
  await expect(row.locator(".tx-sub")).toHaveText("50,000 NGN");
  await expect(row.locator(".tx-amt")).toHaveText("₦50,000.00 NGN");
  await expect(row.locator(".tx-amt .cur-code")).toHaveText("NGN");
  await page.locator("#ngnWithdraw").click();
  const body = page.locator("#panelBody");
  await expect(body.locator(".step-sub")).toHaveText("Pay out Nigerian Naira to your own account or someone else's.");
  await expect(body.locator(".select-row .t1")).toHaveText(["Naira account", "Ngozi Eze"]); // NGN: Nigerian bank accounts only
  await expect(body.locator(".select-row .t2")).toHaveText(["GTBank · •••• 6789", "GTBank · •••• 6789"]);
  await expect(page.locator("#payoutRecipientContinue")).toBeDisabled();
  await page.locator("#backToPayoutCurrency").click();
  await expect(page.locator("#ngnWithdraw")).toBeVisible();
});

test("to your own account: amount, review, create the PIN, done", async ({ page }) => {
  await toAmount(page, "self:lb2");
  const body = page.locator("#panelBody");
  await expect(page.locator("#payoutReview")).toBeDisabled();
  await typeAmount(page, "12500000");
  await page.locator('[data-payoutkey="back"]').click();
  await expect(body.locator(".amount-value")).toHaveText("₦12,500.00 NGN");
  await expect(page.locator("#payoutSpeedPill")).toHaveText("Usually within seconds · ₦[fee] fee");
  await expect(page.locator("#payoutAmtHint")).toHaveText("Available ₦50,000.00 NGN · fee ₦[fee] · Max");

  await expect(page.locator("#firstPaymentNotice")).toHaveCount(0); // Naira account has been paid before
  await page.locator("#payoutReview").click();
  await expect(page.locator("#firstPaymentNotice")).toHaveCount(0);
  await expect(body.locator(".receipt-row .r-label")).toHaveText(["To", "Fee", "Arrives", "Debited from balance"]);
  await expect(body.locator(".receipt-row .r-value")).toHaveText(["GTBank · •••• 6789", "₦[fee]", "Usually within seconds", "₦12,500.00 NGN + ₦[fee]"]);
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

  await expect(title(page)).toHaveText("Sending payout…");
  await expect(title(page)).toHaveText("₦12,500.00 NGN");
  await expect(body.locator(".step-sub")).toHaveText("On its way to Naira account");
  await expect(body.locator(".receipt-row .r-value").first()).toHaveText(/^TXN-\d{6}$/);
  await expect(body.locator(".receipt-row.total")).toContainText("Estimated arrivalUsually within seconds");
  await page.locator("#payoutDone").click();
  // NGN fees aren't decided, so only the amount comes off the balance
  await expect(page.locator('#panelBody [data-holdcur="NGN"] .tx-amt')).toHaveText("₦37,500.00 NGN");
});

test("wrong PIN: attempts left, locked after 3, reset with the emailed passcode", async ({ page }) => {
  await toAmount(page, "other:r6");
  await page.getByLabel("PIN", { exact: true }).selectOption("set"); // demo: PIN 1234
  await typeAmount(page, "500000");
  await page.locator("#payoutReview").click();
  const body = page.locator("#panelBody");
  await expect(body.locator(".receipt-row .r-label")).toHaveText(["To", "Fee", "Delivery", "Total charged"]);
  await expect(body.locator(".receipt-row .r-value")).toHaveText(["GTBank · •••• 6789", "₦[fee]", "After [hold]", "₦5,000.00 NGN + ₦[fee]"]); // first payment to Ngozi Eze
  await expect(body).toContainText("I've reviewed the destination, fee, and delivery estimate above.");
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();

  await expect(body.locator(".step-eyebrow")).toHaveText("Security check");
  await expect(title(page)).toHaveText("Enter your PIN");
  for (const left of ["2 attempts left.", "1 attempt left."]) {
    await typePin(page, "0000");
    await expect(body.locator(".step-sub")).toHaveText(`Approves this withdrawal. Incorrect PIN. ${left}`);
    await expect(body.locator(".otp-box").first()).toHaveValue("");
  }
  await typePin(page, "0000");
  await expect(title(page)).toHaveText("Too many attempts");
  await expect(body.locator(".step-sub")).toHaveText("Your PIN is locked. Reset it with a passcode sent to your email to keep withdrawing.");
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
  await expect(body.locator(".step-sub")).toHaveText("Your new PIN is set. Use it next time you withdraw.");
  await page.locator("#doneToWallet").click();
  await expect(page.locator("#ngnWithdraw")).toBeVisible();
  // Balance untouched: the payout wasn't sent
  await expect(page.locator('#panelBody [data-holdcur="NGN"] .tx-amt')).toHaveText("₦50,000.00 NGN");
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
  await expect(page.locator("#ngnWithdraw")).toBeVisible();
});

// The reference's Link a payout method form, used for non-NGN methods. NGN bank accounts use the name-enquiry step instead.
test("link your own method (non-NGN form): the holder must match the verified name", async ({ page }) => {
  await page.goto("/demo/wallet?payout=recipient");
  await expect(title(page)).toHaveText("Recipient"); // the demo hooks are set
  // As startAdd(true) does for a non-NGN payout method.
  await page.evaluate(() => (window as any).__payout.setState({ currency: "USD", addingSelf: true, draft: { currency: "USD", methodType: "bank" }, stage: "add-recipient" })); // eslint-disable-line @typescript-eslint/no-explicit-any
  await expect(title(page)).toHaveText("Link a payout method");
  const hint = page.locator("#payoutHolderMatchHint");
  await expect(hint).toBeHidden();
  await page.locator("#payoutHolderNameInput").fill("Ada O");
  await expect(hint).toHaveText("Must match account holder: Ada Osun");
  await page.locator("#payoutHolderNameInput").fill("ada osun");
  await expect(hint).toHaveText("Matches verified account holder");
  // Method: Cash App needs only a cashtag
  await page.locator('[data-dropdown-toggle="payoutSelfMethod"]').click();
  await page.locator('[data-dropdown-option="payoutSelfMethod::cashapp"]').click();
  await page.locator("#payoutCashtagInput").fill("$adaosun");
  const save = page.locator("#savePayoutRecipientBtn");
  await expect(save).toBeDisabled(); // no nickname yet
  await page.locator("#payoutNameInput").fill("My Cash App");
  await save.click();
  const added = page.locator("#panelBody .select-row.sel");
  await expect(added.locator(".t1")).toHaveText("My Cash App Instant"); // a USD payout keeps speeds
  await expect(added.locator(".t2")).toHaveText("$adaosun");
});

test("NGN: only Nigerian bank accounts, no conversion, no speed choice; Max is the whole balance; Back steps back", async ({ page }) => {
  await toAmount(page, "other:r6");
  const body = page.locator("#panelBody");
  await expect(page.locator("#payoutSpeedPill")).toHaveText("Usually within seconds · ₦[fee] fee");
  await page.locator("#payoutMaxAmt").click();
  await expect(body.locator(".amount-value")).toHaveText("₦50,000.00 NGN");
  await expect(page.locator("#payoutAmtHint")).toHaveText("Available ₦50,000.00 NGN · fee ₦[fee] · Max");
  await expect(body.locator(".info-card")).toHaveCount(0); // no exchange rate or "Recipient gets"
  await page.locator("#payoutReview").click();
  await expect(body.locator(".step-sub").first()).toHaveText("to Ngozi Eze");
  await expect(body.locator(".status-pill")).toHaveCount(0);
  await expect(body.locator(".receipt-row .r-label")).toHaveText(["To", "Fee", "Delivery", "Total charged"]);
  await expect(body.locator(".receipt-row .r-value")).toHaveText(["GTBank · •••• 6789", "₦[fee]", "After [hold]", "₦50,000.00 NGN + ₦[fee]"]); // first payment to Ngozi Eze

  await page.locator("#backToPayoutAmount").click();
  await expect(body.locator(".amount-value")).toHaveText("₦50,000.00 NGN");
  await page.locator("#backToPayoutRecipient2").click();
  await expect(title(page)).toHaveText("Recipient");
  await expect(body.locator(".select-row.sel .t1")).toHaveText("Ngozi Eze");
});

test("other currencies keep international recipients and Standard / Instant", async ({ page }) => {
  await page.goto("/demo/wallet?payout=recipient");
  await expect(title(page)).toHaveText("Recipient"); // the demo hooks are set
  await page.evaluate(() => (window as any).__payout.setState({ currency: "USD" })); // eslint-disable-line @typescript-eslint/no-explicit-any
  await expect(page.locator("#panelBody .select-row .t1")).toHaveText(["Personal checking Standard", "Naira account Int'l Standard", "Jordan Blake", "Ngozi Eze Int'l"]);
});
