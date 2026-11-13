import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * WGT-12, refunds and disputes. The demo user's (Ada Osun's) Checkout payments, naira and dollar, card and bank
 * transfer, appear in Checkout's Poket account (Activity, pay-detail) and in the wallet's Activity (txRow, tTxDetail).
 * A payment to a store can be disputed for 60 days ("Raise a dispute", then tDispute's start and form); deposits,
 * top-ups, refunds, sends and conversions can't. Disputes are kept on the account: raised in one widget, open in both;
 * two use up the account's disputes. The wallet is reached from Checkout by the demo bar's link (no reload), so it
 * shares the one mock account.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const DAY = 86400000;

/** Ada (remembered) pays the Ilé Living order: USD with her Visa, or an NGN order (paid in USD by the Visa, converted). */
async function adaPays(page: Page, currency: "USD" | "NGN" = "USD") {
  await page.goto("/demo/ile-living");
  if (currency === "NGN") await page.getByLabel("Order currency").selectOption("NGN");
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#payGo").click();
  await expect(widget.getByRole("heading", { name: /^Paid / })).toBeVisible();
  return widget;
}
/** Ada pays a naira order by bank transfer (a one-time account; the demo's transfer arrives). */
async function adaPaysByTransfer(page: Page) {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Order currency").selectOption("NGN");
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator(".add").click();
  await widget.locator('[data-addpm="ngn-bank"]').click();
  await expect(widget.locator("#transferDetails")).toBeVisible();
  await page.locator("#demoTransferArrives").click();
  await expect(widget.getByRole("heading", { name: "Paid ₦36,270.00 to Ilé Living" })).toBeVisible();
  return widget;
}
async function toWallet(page: Page) {
  const widget = page.getByTestId("checkout-widget");
  if (await widget.count()) await widget.getByRole("button", { name: /^Back to / }).click();
  await page.locator("#demoToWallet").click();
  await expect(page).toHaveURL(/\/demo\/wallet$/);
  await expect(page.locator("#actSend")).toBeVisible();
}
const walletRow = (page: Page) => page.locator("#panelBody [data-payment]");
const detailRow = (page: Page, label: string) => page.locator("#txDetail .info-row", { hasText: label });
async function chooseReason(page: Page, scope: Locator | Page, short: string) {
  await scope.getByRole("radio", { name: short }).click();
}

test("Checkout: View receipt opens the payment's detail; the 60-day window; Activity lists it", async ({ page }) => {
  const widget = await adaPays(page);
  await widget.locator("#doneView").click();
  await expect(widget.locator("#pdAmount")).toHaveText(/\$23\.40\s*USD/);
  await expect(widget.locator(".tx-hero-sub")).toHaveText("Ilé Living");
  const receipt = widget.locator("#pdReceipt");
  await expect(receipt.locator(".receipt-row", { hasText: "Status" })).toContainText("Completed");
  await expect(receipt.locator(".receipt-row", { hasText: "Paid with" })).toContainText("Visa ••• 4242");
  await expect(receipt.locator(".receipt-row", { hasText: "Order" })).toContainText("ILV-10482");
  await expect(receipt.locator(".receipt-row", { hasText: "On your statement" })).toContainText("POKET* ILE LIVING");
  await expect(widget.locator("#pdWindow")).toHaveText("You can raise a dispute for 60 more days.");
  await expect(widget.locator("#pdDispute")).toHaveText("Raise a dispute");
  await expect(widget.locator("#tabbar .tab.on")).toHaveText("Activity");
  // Back: to the done screen it came from
  await widget.locator("#pdBack").click();
  await expect(widget.getByRole("heading", { name: /^Paid / })).toBeVisible();
  await expect(widget.locator("#tabbar")).toHaveCount(0);
});

test("Checkout: 'Your Poket' opens Activity; Home and Methods aren't ported", async ({ page }) => {
  await adaPays(page);
  await page.getByTestId("checkout-widget").getByRole("button", { name: /^Back to / }).click();
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#payAcct").click();
  await expect(widget.getByRole("heading", { name: "Activity" })).toBeVisible();
  await expect(widget.locator(".tx-group").first()).toHaveText(new Date().toLocaleDateString("en-US", { month: "long" }));
  const row = widget.locator("[data-pay]");
  await expect(row).toHaveCount(1);
  await expect(row.locator(".tx-title")).toHaveText("Ilé Living");
  await expect(row.locator(".tx-sub")).toContainText("Visa ••• 4242");
  await expect(row.locator(".tx-amt")).toHaveText("-$23.40");
  await widget.locator('#tabbar [data-tab="home"]').click();
  await expect(page.locator(".toast.on")).toHaveText("Home isn’t ported yet");
  await row.click();
  await expect(widget.locator("#pdBack")).toHaveText(/Activity/);
});

test("Checkout: raise a dispute: start, the form (only the reason is required), submitted; Activity shows it open; the merchant hears", async ({ page }) => {
  const widget = await adaPays(page);
  await widget.locator("#doneView").click();
  await widget.locator("#pdDispute").click();
  await expect(widget.getByRole("heading", { name: "Dispute this payment?" })).toBeVisible();
  await expect(widget.locator(".disp-pay")).toContainText("Ilé Living");
  await expect(widget.locator(".settings-row-title")).toHaveText(["Up to 14 days to resolve", "Refunds go to Visa ••• 4242"]);
  await expect(widget.locator(".warnbox")).toContainText("False claims can close your account");
  await widget.locator("#dispStart").click();
  await expect(widget.getByRole("heading", { name: "Tell us what happened" })).toBeVisible();
  const submit = widget.locator("#dispSubmit");
  await expect(submit).toHaveText("Choose a reason to continue");
  await expect(submit).toBeDisabled();
  // A Checkout payment isn't a subscription: 5 reasons
  await expect(widget.locator(".chip-opt")).toHaveText(["Wrong amount", "Charged twice", "Not received", "Not as described", "Didn’t make this payment"]);
  await chooseReason(page, widget, "Not received");
  await expect(submit).toHaveText("Submit dispute");
  // Add more detail: evidence label follows the reason; a contact date before the payment is refused
  await widget.locator("#dispMore").click();
  await expect(widget.locator(".more-body .lbl").filter({ hasText: "Evidence" })).toHaveText("Evidence of not receiving this");
  await widget.locator("#dispContacted").click();
  await widget.locator("#dispDate").pressSequentially("01012020");
  await expect(widget.locator("#dispDate")).toHaveValue("01 / 01 / 2020");
  await expect(widget.locator("#dispDateMsg")).toHaveText(/^That’s before you paid on /);
  await expect(submit).toBeDisabled();
  await widget.locator("#dispDate").fill("");
  await widget.locator("#dispDate").pressSequentially("13452026");
  await expect(widget.locator("#dispDateMsg")).toHaveText("That date doesn’t exist. Check the month and day.");
  await widget.locator("#dispContacted").click(); // not contacted after all: no date needed
  await expect(submit).toBeEnabled();
  await widget.locator("#dispAttach").click();
  await widget.locator("#dispMore").click();
  await expect(widget.locator("#dispMore .opt")).toHaveText("1 added");
  await submit.click();
  await expect(widget.getByRole("heading", { name: "Submitting dispute…" })).toBeVisible();
  await expect(widget.getByRole("heading", { name: "Dispute submitted" })).toBeVisible();
  await expect(widget.locator("#dispDoneScreen .sub")).toHaveText("If resolved in your favor, the money returns to Visa ••• 4242.");
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.dispute_opened" })).toContainText('"widget":"checkout"');
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.dispute_opened" })).toContainText('"reason":"not_received"');

  await widget.locator("#dispDone").click();
  const row = widget.locator("[data-pay]");
  await expect(row.locator(".tx-sub")).toContainText("· Dispute open");
  await expect(row.locator(".tx-ic.disp")).toHaveCount(1);
  await row.click();
  await expect(widget.locator("#pdStatus")).toHaveText("Dispute open");
  await expect(widget.locator("#pdDisputed")).toBeVisible();
  await expect(widget.locator("#pdDispute")).toHaveCount(0);
});

test("wallet: Ada's Checkout payments (dollar card, naira converted, naira bank transfer) appear in Activity, with the reference's detail", async ({ page }) => {
  // A naira order by bank transfer, then (same page, no reload) a dollar order by card
  const w = await adaPaysByTransfer(page);
  await w.getByRole("button", { name: /^Back to / }).click();
  await page.getByLabel("Order currency").selectOption("USD");
  await page.locator("#payWithPoket").click();
  await page.getByTestId("checkout-widget").locator("#payGo").click();
  await expect(page.getByTestId("checkout-widget").getByRole("heading", { name: /^Paid / })).toBeVisible();
  await toWallet(page);

  await page.locator("#tabActivity").click();
  const rows = walletRow(page);
  await expect(rows).toHaveCount(2);
  await expect(rows.locator(".tx-title")).toHaveText(["Ilé Living", "Ilé Living"]);
  await expect(rows.locator(".tx-sub").first()).toHaveText("Merchant payment · Ilé Living");
  await expect(rows.locator(".tx-amt")).toHaveText(["-$23.40 USD", "-₦36,270.00 NGN"]); // newest first
  await rows.nth(1).click();
  await expect(page.locator("#paymentAmount")).toHaveText("₦36,270.00 NGN");
  await expect(detailRow(page, "Status")).toContainText("Completed");
  await expect(detailRow(page, "Currency")).toContainText("NGN");
  await expect(detailRow(page, "Merchant")).toContainText("Ilé Living");
  await expect(detailRow(page, "Context")).toContainText("Checkout");
  await expect(page.locator("#extRaiseDispute")).toBeVisible();
  await expect(page.locator("#disputeWindow")).toHaveText("You can raise a dispute for 60 more days.");
});

test("wallet: raise a dispute (tDispute); Checkout shows it open too; the merchant hears", async ({ page }) => {
  await adaPays(page, "NGN"); // converted: the Visa paid $23.40 for ₦36,270.00
  await toWallet(page);
  await page.locator("#tabActivity").click();
  await walletRow(page).click();
  await page.locator("#extRaiseDispute").click();
  const body = page.locator("#panelBody");
  await expect(body.locator(".step-title")).toHaveText("Dispute this payment?");
  await expect(body.locator(".info-card .info-row").first()).toHaveText(/Ilé Living\s*₦36,270\.00 NGN/);
  await expect(body.locator(".settings-row-title")).toHaveText(["Up to 14 days to resolve", "Refunds go to your balance"]);
  await page.locator("#disputeStart").click();
  await expect(body.locator(".step-sub").first()).toHaveText("About your ₦36,270.00 NGN payment to Ilé Living.");
  await expect(page.locator("#extSubmitDispute")).toHaveText("Choose a reason to continue");
  await chooseReason(page, body, "Charged twice");
  await page.locator("#extDisputeMore").click();
  await expect(body.locator(".field-label", { hasText: "Evidence" })).toHaveText("Evidence of the duplicate charge");
  await page.locator("#extDisputeContacted").click();
  await page.locator("#extDisputeDate").pressSequentially("12312099");
  await expect(page.locator("#extDisputeDateMsg")).toHaveText("That date is in the future.");
  await expect(page.locator("#extSubmitDispute")).toBeDisabled();
  await page.locator("#extDisputeDate").fill("");
  const today = new Date();
  await page.locator("#extDisputeDate").pressSequentially(`${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}${today.getFullYear()}`);
  await expect(page.locator("#extDisputeDateMsg")).toHaveText(/^Between .* \(when you paid\) and today\.$/);
  await page.locator("#extSubmitDispute").click();
  await expect(body.locator(".step-title")).toHaveText("Submitting dispute…");
  await expect(page.locator("#disputeDone .step-title")).toHaveText("Dispute submitted");
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.dispute_opened" })).toContainText('"widget":"wallet","poket_reference"');
  await page.locator("#extDisputeDone").click();
  await expect(body.locator(".step-title").first()).toHaveText("Activity");
  await walletRow(page).click();
  await expect(page.locator("#disputeChip")).toHaveText("Open · under review");
  await expect(page.locator("#extRaiseDispute")).toHaveCount(0);

  // Checkout's account shows it open
  await page.locator("#demoToCheckout").click();
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#payAcct").click();
  await expect(widget.locator("[data-pay] .tx-sub")).toContainText("· Dispute open");
});

test("the 60-day window: 59 days ago, 1 more day; 61 days ago, closed with the reference's note", async ({ page }) => {
  await adaPays(page);
  await toWallet(page);
  const setAge = (days: number) => page.evaluate((ms) => {
    const st = (window as any).__account.getState();
    st.update((a: any) => ({ ...a, payments: a.payments.map((p: any) => ({ ...p, at: new Date(Date.now() - ms).toISOString() })) }));
  }, days * DAY + 60000);
  await setAge(59);
  await page.locator("#tabActivity").click();
  await walletRow(page).click();
  await expect(page.locator("#disputeWindow")).toHaveText("You can raise a dispute for 1 more day.");
  await setAge(61);
  await expect(page.locator("#extRaiseDispute")).toHaveCount(0);
  await expect(page.locator("#disputeClosed")).toHaveText("Disputes can be raised up to 60 days after payment. This payment was 61 days ago, so contact Ilé Living directly or reach Poket support.");

  // Checkout's detail too
  await page.locator("#demoToCheckout").click();
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#payAcct").click();
  await widget.locator("[data-pay]").first().click();
  await expect(widget.locator("#pdDispute")).toHaveCount(0);
  await expect(widget.locator("#pdClosed")).toContainText("This payment was 61 days ago");
});

test("no dispute option on deposits, top-ups, refunds, sends or conversions; the wallet's demo payment has one", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.locator("#tabActivity").click();
  for (const id of ["t1", "t3"]) { // a refund, a card top-up
    await page.locator(`[data-txid="${id}"]`).click();
    await expect(page.locator("#txDetail")).toBeVisible();
    await expect(page.locator("#extRaiseDispute")).toHaveCount(0);
    await page.locator("#backFromTxDetail").click();
  }
  await page.locator('[data-txid="t2"]').click(); // Sooyah Bistro: a payment to a store
  await expect(page.locator("#extRaiseDispute")).toBeVisible();
  await expect(page.locator("#disputeWindow")).toHaveText("You can raise a dispute for 57 more days.");
  await page.locator("#backFromTxDetail").click();

  // A send's status and a conversion's receipt: no dispute
  await page.locator("#tabHome").click();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  await page.locator("#youSend").click();
  for (const d of "500000") await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toBeVisible();
  await expect(page.locator("#extRaiseDispute")).toHaveCount(0);
});

test("two disputes use up the account's disputes: the third says it can't be raised", async ({ page }) => {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.waitForFunction(() => !!(window as any).__account?.getState().account);
  await page.evaluate(() => (window as any).__account.getState().update((a: any) => ({ ...a, disputeStrikes: 1 })));
  await page.locator("#tabActivity").click();
  await page.locator('[data-txid="t2"]').click();
  await page.locator("#extRaiseDispute").click();
  await page.locator("#disputeStart").click();
  await chooseReason(page, page.locator("#panelBody"), "Wrong amount");
  await page.locator("#extSubmitDispute").click();
  await expect(page.locator("#disputeDone")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__account.getState().account.disputeStrikes)).toBe(2);
  await page.locator("#extDisputeDone").click();
  await page.locator('[data-txid="t2"]').click();
  await expect(page.locator("#disputeChip")).toHaveText("Open · under review");

  // Another payment: restricted
  await page.evaluate(() => (window as any).__account.getState().update((a: any) => ({ ...a, payments: [{ id: "pay_x", merchant: "Ilé Living", amount: 2340, currency: "USD", method: "Visa ••• 4242", at: new Date().toISOString(), status: "paid", order: "ILV-1" }] })));
  await page.locator("#backFromTxDetail").click();
  await walletRow(page).click();
  await page.locator("#extRaiseDispute").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("You can't raise a dispute right now");
  await expect(page.locator("#panelBody")).toContainText("Account restricted");
  await expect(page.locator("#disputeStart")).toHaveCount(0);
});
