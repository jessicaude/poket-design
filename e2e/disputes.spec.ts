import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * WGT-12, refunds and disputes. The demo user's (Ada Osun's) Checkout payments (three seeded, as the reference
 * does: Mama Tee's Kitchen ₦65,100.00 by Verve card 2 days ago, Ilé Living ₦36,270.00 by bank transfer 10 days ago,
 * Adire Market $65.00 by Visa 76 days ago), naira and dollar, card and bank
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
const detailRow = (page: Page, label: string) => page.locator(`#txDetail .info-row[data-label="${label}"]`);
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
  // The new payment first, then Ada's three seeded ones (as the reference seeds them)
  const rows = widget.locator("[data-pay]");
  await expect(rows.locator(".tx-title")).toHaveText(["Ilé Living", "Mama Tee’s Kitchen", "Ilé Living", "Adire Market"]);
  await expect(rows.locator(".tx-amt")).toHaveText(["-$23.40", "-₦65,100.00", "-₦36,270.00", "-$65.00"]);
  await expect(rows.nth(1).locator(".tx-sub")).toContainText("Verve ••• 6011");
  await expect(rows.nth(2).locator(".tx-sub")).toContainText("Bank transfer");
  const row = rows.first();
  await expect(row.locator(".tx-sub")).toContainText("Visa ••• 4242");
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
  const submit = widget.locator("#dispReview");
  await expect(submit).toHaveText("Choose a reason to continue");
  await expect(submit).toBeDisabled();
  // WGT-12's five reasons
  await expect(widget.locator(".chip-opt")).toHaveText(["Not received", "Not as described", "Charged twice", "Didn’t authorise", "Other"]);
  await chooseReason(page, widget, "Not received");
  // Then a short description (required)
  await expect(submit).toHaveText("Describe what happened to continue");
  await expect(submit).toBeDisabled();
  await widget.locator("#dispDescription").fill("The cushions never arrived.");
  await expect(widget.locator("#dispDescriptionCount")).toHaveText("27/300");
  await expect(submit).toHaveText("Review dispute");
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
  // Review, then submit (Back keeps what was entered)
  await expect(widget.getByRole("heading", { name: "Review your dispute" })).toBeVisible();
  await expect(widget.locator("#dispReviewReason")).toHaveText("Not received");
  await expect(widget.locator("#dispReviewDescription")).toHaveText("The cushions never arrived.");
  await expect(widget.locator("#dispReviewBox")).toContainText("Evidenceevidence.pdf");
  await widget.locator("#dispBack").click();
  await expect(widget.locator("#dispDescription")).toHaveValue("The cushions never arrived.");
  await submit.click();
  await widget.locator("#dispSubmit").click();
  await expect(widget.getByRole("heading", { name: "Submitting dispute…" })).toBeVisible();
  await expect(widget.getByRole("heading", { name: "Dispute submitted" })).toBeVisible();
  await expect(widget.locator("#dispDoneScreen .sub")).toHaveText("If resolved in your favor, the money returns to Visa ••• 4242.");
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.dispute_opened" })).toContainText('"widget":"checkout"');
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.dispute_opened" })).toContainText('"reason":"not_received"');

  await widget.locator("#dispDone").click();
  const row = widget.locator("[data-pay]").first();
  await expect(row.locator(".tx-sub")).toContainText("· Dispute open");
  await expect(row.locator(".tx-ic.disp")).toHaveCount(1);
  await row.click();
  await expect(widget.locator("#pdStatus")).toHaveText("Dispute open");
  await expect(widget.locator("#pdHeld")).toHaveText("$23.40 held while we review.");
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
  // The two new payments, newest first, then Ada's three seeded ones
  await expect(rows.locator(".tx-title")).toHaveText(["Ilé Living", "Ilé Living", "Mama Tee’s Kitchen", "Ilé Living", "Adire Market"]);
  await expect(rows.locator(".tx-sub").first()).toHaveText("Merchant payment · Ilé Living");
  await expect(rows.locator(".tx-amt")).toHaveText(["-$23.40 USD", "-₦36,270.00 NGN", "-₦65,100.00 NGN", "-₦36,270.00 NGN", "-$65.00 USD"]);
  await rows.nth(1).click();
  await expect(page.locator("#paymentAmount")).toHaveText("₦36,270.00 NGN");
  await expect(detailRow(page, "Status")).toContainText("Completed");
  // WGT-11's rows: a naira bank transfer names no account to come from, and has the bank's session ID
  await expect(page.locator("#txDetail .info-row > span:first-child")).toHaveText(["Status", "Date", "To", "Method", "Reference", "Session ID"]);
  await expect(detailRow(page, "To")).toContainText("Ilé Living");
  await expect(detailRow(page, "Method")).toContainText("Bank transfer");
  await expect(detailRow(page, "Session ID")).toContainText("[session ID]");
  await expect(page.locator("#extRaiseDispute")).toBeVisible();
  await expect(page.locator("#disputeWindow")).toHaveText("You can raise a dispute for 60 more days.");
});

test("wallet: raise a dispute (tDispute); Checkout shows it open too; the merchant hears", async ({ page }) => {
  await adaPays(page, "NGN"); // converted: the Visa paid $23.40 for ₦36,270.00
  await toWallet(page);
  await page.locator("#tabActivity").click();
  await walletRow(page).first().click();
  await page.locator("#extRaiseDispute").click();
  const body = page.locator("#panelBody");
  await expect(body.locator(".step-title")).toHaveText("Dispute this payment?");
  await expect(body.locator(".info-card .info-row").first()).toHaveText(/Ilé Living\s*₦36,270\.00 NGN/);
  await expect(body.locator(".settings-row-title")).toHaveText(["Up to 14 days to resolve", "Refunds go to your balance"]);
  await page.locator("#disputeStart").click();
  await expect(body.locator(".step-sub").first()).toHaveText("About your ₦36,270.00 NGN payment to Ilé Living.");
  await expect(page.locator("#extReviewDispute")).toHaveText("Choose a reason to continue");
  await expect(body.locator(".ud-chip")).toHaveText(["Not received", "Not as described", "Charged twice", "Didn’t authorise", "Other"]);
  await chooseReason(page, body, "Charged twice");
  await page.locator("#extDisputeDescription").fill("I was charged twice for one order.");
  await page.locator("#extDisputeMore").click();
  await expect(body.locator(".field-label", { hasText: "Evidence" })).toHaveText("Evidence of the duplicate charge");
  await page.locator("#extDisputeContacted").click();
  await page.locator("#extDisputeDate").pressSequentially("12312099");
  await expect(page.locator("#extDisputeDateMsg")).toHaveText("That date is in the future.");
  await expect(page.locator("#extReviewDispute")).toBeDisabled();
  await page.locator("#extDisputeDate").fill("");
  const today = new Date();
  await page.locator("#extDisputeDate").pressSequentially(`${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}${today.getFullYear()}`);
  await expect(page.locator("#extDisputeDateMsg")).toHaveText(/^Between .* \(when you paid\) and today\.$/);
  await page.locator("#extReviewDispute").click();
  await expect(body.locator(".step-title")).toHaveText("Review your dispute");
  await expect(page.locator("#reviewReason")).toHaveText("Charged twice");
  await expect(page.locator("#reviewDescription")).toHaveText("I was charged twice for one order.");
  await page.locator("#extSubmitDispute").click();
  await expect(body.locator(".step-title")).toHaveText("Submitting dispute…");
  await expect(page.locator("#disputeDone .step-title")).toHaveText("Dispute submitted");
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.dispute_opened" })).toContainText('"widget":"wallet","poket_reference"');
  await page.locator("#extDisputeDone").click();
  await expect(body.locator(".step-title").first()).toHaveText("Activity");
  await walletRow(page).first().click();
  await expect(page.locator("#disputeChip")).toHaveText("Open · under review");
  await expect(detailRow(page, "Status")).toContainText("Dispute open");
  await expect(page.locator("#disputeHeld")).toHaveText("₦36,270.00 NGN held while we review.");
  await expect(page.locator("#extRaiseDispute")).toHaveCount(0);

  // Checkout's account shows it open
  await page.locator("#demoToCheckout").click();
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#payAcct").click();
  await expect(widget.locator("[data-pay] .tx-sub").first()).toContainText("· Dispute open");
});

test("the 60-day window: 59 days ago, 1 more day; 61 days ago, closed with the reference's note", async ({ page }) => {
  await adaPays(page);
  await toWallet(page);
  // The new payment (the account lists it first): made 59, then 61 days ago
  const id: string = await page.evaluate(() => (window as any).__account.getState().account.payments[0].id);
  const setAge = (days: number) => page.evaluate(([pid, ms]) => {
    (window as any).__account.getState().update((a: any) => ({ ...a, payments: a.payments.map((p: any) => (p.id === pid ? { ...p, at: new Date(Date.now() - (ms as number)).toISOString() } : p)) }));
  }, [id, days * DAY + 60000] as const);
  await setAge(59);
  await page.locator("#tabActivity").click();
  await page.locator(`[data-payment="${id}"]`).click();
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
  await widget.locator(`[data-pay="${id}"]`).click();
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
  await chooseReason(page, page.locator("#panelBody"), "Other");
  await page.locator("#extDisputeDescription").fill("Not what I ordered.");
  await page.locator("#extReviewDispute").click();
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

test("seeds: Ada's three Checkout payments; the dollar one from 76 days ago is outside the window", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.locator("#tabActivity").click();
  await page.locator('[data-payment="pay_mtk2291"]').click();
  await expect(page.locator("#paymentAmount")).toHaveText("₦65,100.00 NGN");
  await expect(page.locator("#disputeWindow")).toHaveText("You can raise a dispute for 58 more days.");
  await page.locator("#backFromTxDetail").click();
  await page.locator('[data-payment="pay_ilv10077"]').click();
  await expect(page.locator("#disputeWindow")).toHaveText("You can raise a dispute for 50 more days.");
  await page.locator("#backFromTxDetail").click();
  await page.locator('[data-payment="pay_a9d2c7ke"]').click();
  await expect(page.locator("#paymentAmount")).toHaveText("$65.00 USD");
  await expect(page.locator("#extRaiseDispute")).toHaveCount(0);
  await expect(page.locator("#disputeClosed")).toHaveText("Disputes can be raised up to 60 days after payment. This payment was 76 days ago, so contact Adire Market directly or reach Poket support.");
});

test("wallet: Merchant refunds part, then the rest, of a naira card payment: Partly refunded, then Refunded; refund rows with their own receipt; back to the card", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
  const ngn = () => page.evaluate(() => (window as any).__ngn.getState().ngnBalance as number);
  const before = await ngn();
  await page.locator("#tabActivity").click();
  await page.locator('[data-payment="pay_mtk2291"]').click();
  await page.locator("#demoRefundPart").click(); // half of what's left: ₦32,550.00
  await expect(detailRow(page, "Status")).toContainText("Partly refunded");
  await expect(detailRow(page, "Refunded")).toContainText("₦32,550.00 NGN");
  await expect(page.locator("#extRaiseDispute")).toBeVisible(); // part refunded: still disputable
  await page.locator("#demoRefundFull").click(); // the rest
  await expect(detailRow(page, "Status")).toContainText("Refunded");
  await expect(detailRow(page, "Status")).not.toContainText("Partly");
  await expect(detailRow(page, "Refunded")).toContainText("₦65,100.00 NGN");
  await expect(page.locator("#extRaiseDispute")).toHaveCount(0);
  await expect(page.locator("#demoRefundFull")).toBeDisabled();
  await expect(page.locator("#demoRefundPart")).toBeDisabled();
  // Mama Tee's Kitchen isn't the demo's merchant (Ilé Living): its events don't reach this one
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.refunded" })).toHaveCount(0);
  expect(await ngn()).toBe(before); // a card refund doesn't touch the NGN balance

  await page.locator("#backFromTxDetail").click();
  const refunds = page.locator("#panelBody [data-refund]");
  await expect(refunds.locator(".tx-title")).toHaveText(["Refund · Mama Tee’s Kitchen", "Refund · Mama Tee’s Kitchen"]);
  await expect(refunds.locator(".tx-sub").first()).toHaveText("Merchant refund · Mama Tee’s Kitchen");
  await expect(refunds.locator(".tx-amt")).toHaveText(["+₦32,550.00 NGN", "+₦32,550.00 NGN"]);
  await refunds.first().click();
  await expect(page.locator("#refundAmount")).toHaveText("₦32,550.00 NGN");
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("Refund · Mama Tee’s Kitchen");
  await expect(page.locator("#txDetail .info-row > span:first-child")).toHaveText(["Status", "Date", "From", "To", "Method", "Reference"]);
  await expect(detailRow(page, "From")).toContainText("Mama Tee’s Kitchen");
  await expect(detailRow(page, "To")).toContainText("Verve ••• 6011");
  await expect(page.locator("#refundNote")).toHaveText("Back to Verve ••• 6011 in [refund time]");
});

test("wallet: a naira bank-transfer payment refunds to the NGN balance, with a notification", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
  const ngn = () => page.evaluate(() => (window as any).__ngn.getState().ngnBalance as number);
  const before = await ngn();
  await page.locator("#tabActivity").click();
  await page.locator('[data-payment="pay_ilv10077"]').click();
  await page.locator("#demoRefundFull").click();
  await expect(detailRow(page, "Status")).toContainText("Refunded");
  await expect.poll(ngn).toBe(before + 3627000);
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.refunded" })).toContainText('"poket_reference":"pay_ilv10077"');
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.refunded" })).toContainText('"amount":3627000,"currency":"NGN","full":true,"refunded_to":"ngn_balance"');
  await page.locator("#backFromTxDetail").click();
  await page.locator("#panelBody [data-refund]").click();
  await expect(detailRow(page, "To")).toContainText("NGN balance");
  await expect(detailRow(page, "Session ID")).toHaveCount(0); // into the NGN balance: not a bank transfer
  await expect(page.locator("#refundNote")).toHaveText("Added to your NGN balance.");
  await page.locator("#openNotifHeader").click();
  await expect(page.locator("#panelBody [data-notif]").first()).toContainText("Refund received");
  await expect(page.locator("#panelBody [data-notif]").first()).toContainText("₦36,270.00 NGN from Ilé Living added to your NGN balance.");
  // It shows in the NGN balance's history too
  await page.locator("#extBackHome").click();
  await page.locator("#tabHome").click();
  await page.locator('[data-wallettab="cash"]').click();
  await page.locator('#panelBody [data-holdcur="NGN"][data-holdbucket="open"]').click();
  await expect(page.locator("#panelBody [data-refund] .tx-title")).toHaveText("Refund · Ilé Living");
});

test("Checkout: the DEMO pill's Merchant refunds on a payment's detail; Refunded; the refund row and receipt; the wallet credits a naira refund", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#payAcct").click();

  // The dollar card payment from 76 days ago: refunded in full, so no window note either
  await widget.locator('[data-pay="pay_a9d2c7ke"]').click();
  await expect(widget.locator("#pdClosed")).toBeVisible();
  await expect(page.locator("#demoBtn")).toHaveText("Merchant refunds: full");
  await expect(page.locator("#demoBtn2")).toHaveText("Merchant refunds: part");
  await page.locator("#demoBtn").click();
  await expect(widget.locator("#pdStatus")).toHaveText("Refunded");
  await expect(widget.locator("#pdRefunded")).toHaveText("$65.00 to Visa ••• 4242");
  await expect(widget.locator("#pdClosed")).toHaveCount(0);
  await expect(page.locator("#demoBtn")).toHaveCount(0); // nothing left to refund
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.refunded" })).toHaveCount(0); // Adire Market's, not Ilé Living's

  // Part of the naira bank transfer: Partly refunded, to the NGN balance
  await widget.locator("#pdBack").click();
  await widget.locator('[data-pay="pay_ilv10077"]').click();
  await page.locator("#demoBtn2").click();
  await expect(widget.locator("#pdStatus")).toHaveText("Partly refunded");
  await expect(widget.locator("#pdRefunded")).toHaveText("₦18,135.00 to NGN balance");
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.refunded" })).toContainText('"amount":1813500,"currency":"NGN","full":false,"refunded_to":"ngn_balance"');
  await expect(widget.locator("#pdDispute")).toBeVisible();

  await widget.locator("#pdBack").click();
  const refunds = widget.locator("[data-refund]");
  await expect(refunds.locator(".tx-title")).toHaveText(["Refund · Ilé Living", "Refund · Adire Market"]);
  await expect(refunds.locator(".tx-sub").first()).toContainText("· To NGN balance");
  await expect(refunds.locator(".tx-sub").last()).toContainText("· To Visa ••• 4242");
  await expect(refunds.locator(".tx-amt")).toHaveText(["+₦18,135.00", "+$65.00"]);
  await refunds.last().click();
  await expect(widget.locator("#rdAmount")).toHaveText(/\$65\.00\s*USD/);
  await expect(widget.locator(".tx-hero-sub")).toHaveText("Refund · Adire Market");
  await expect(widget.locator("#rdReceipt .receipt-row", { hasText: "Refunded to" })).toContainText("Visa ••• 4242");
  await expect(widget.locator("#rdReceipt .receipt-row", { hasText: "Order" })).toContainText("AM-5510");
  await expect(widget.locator("#rdNote")).toHaveText("Back to Visa ••• 4242 in [refund time]");
  await widget.locator("#rdBack").click();
  await expect(widget.getByRole("heading", { name: "Activity" })).toBeVisible();

  // In the wallet (same account, no reload): the naira refund is in the NGN balance
  await widget.locator("#tabbar").waitFor();
  await page.keyboard.press("Escape");
  await page.locator("#demoToWallet").click();
  await expect(page.locator("#actSend")).toBeVisible();
  const ngn = await page.evaluate(() => (window as any).__ngn.getState().ngnBalance as number);
  expect(ngn).toBe(5000000 + 1813500); // the demo's ₦50,000.00 + the refund
  await page.locator("#tabActivity").click();
  await expect(page.locator("#panelBody [data-refund] .tx-title")).toHaveText(["Refund · Ilé Living", "Refund · Adire Market"]);
});

test("Checkout: a card payment to Ilé Living refunded in full: Refunded, no dispute, the merchant hears payment.refunded", async ({ page }) => {
  const widget = await adaPays(page);
  await widget.locator("#doneView").click();
  await expect(widget.locator("#pdDispute")).toBeVisible();
  await page.locator("#demoBtn").click();
  await expect(widget.locator("#pdStatus")).toHaveText("Refunded");
  await expect(widget.locator("#pdRefunded")).toHaveText("$23.40 to Visa ••• 4242");
  await expect(widget.locator("#pdDispute")).toHaveCount(0);
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.refunded" })).toContainText('"amount":2340,"currency":"USD","full":true,"refunded_to":"card"');
});

/** A dispute already raised on one of Ada's payments (wallet page). */
async function disputed(page: Page, id: string) {
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
  await page.evaluate((pid) => (window as any).__account.getState().update((a: any) => ({ ...a,
    payments: a.payments.map((p: any) => (p.id === pid ? { ...p, status: "disputed", dispute: { reason: "I was charged twice", description: "Charged twice.", at: new Date().toISOString() } } : p)) })), id);
}
const notes = (page: Page) => page.locator("#panelBody [data-notif]");
const events = (page: Page, type: string) => page.getByTestId("events").locator("li", { hasText: type });

test("resolve: refund. A naira bank transfer's dispute refunded to the NGN balance; the merchant and the user are told; it can't be reopened", async ({ page }) => {
  await page.goto("/demo/wallet");
  await disputed(page, "pay_ilv10077");
  const ngn = () => page.evaluate(() => (window as any).__ngn.getState().ngnBalance as number);
  const before = await ngn();
  await page.locator("#tabActivity").click();
  await page.locator('[data-payment="pay_ilv10077"]').click();
  await expect(detailRow(page, "Status")).toContainText("Dispute open");
  await expect(page.locator("#disputeHeld")).toHaveText("₦36,270.00 NGN held while we review.");
  await expect(page.locator("#demoRefundFull")).toHaveCount(0); // while a dispute is open, it's resolved instead
  await page.locator("#demoResolveRefund").click();
  await expect(detailRow(page, "Status")).toContainText("Refunded");
  await expect(page.locator("#disputeHeld")).toHaveCount(0);
  await expect(page.locator("#extRaiseDispute")).toHaveCount(0); // can't be reopened
  await expect(page.locator("#demoResolveRefund")).toHaveCount(0);
  await expect.poll(ngn).toBe(before + 3627000);
  await expect(events(page, "payment.dispute_resolved")).toContainText('"poket_reference":"pay_ilv10077","outcome":"refund","amount":3627000,"currency":"NGN"');
  await expect(events(page, "payment.refunded")).toContainText('"refunded_to":"ngn_balance"');
  await page.locator("#openNotifHeader").click();
  await expect(notes(page)).toHaveCount(1); // the resolution's, not a separate "Refund received"
  await expect(notes(page).first()).toContainText("Dispute resolved in your favor");
  await expect(notes(page).first()).toContainText("₦36,270.00 NGN was added to your NGN balance.");
});

test("resolve: release. Closed, the merchant keeps it, with the reason line; can't be reopened; no event for another merchant's payment", async ({ page }) => {
  await page.goto("/demo/wallet");
  await disputed(page, "pay_mtk2291");
  await page.locator("#tabActivity").click();
  await page.locator('[data-payment="pay_mtk2291"]').click();
  await expect(page.locator("#disputeHeld")).toHaveText("₦65,100.00 NGN held while we review.");
  await page.locator("#demoResolveRelease").click();
  await expect(detailRow(page, "Status")).toContainText("Dispute closed");
  await expect(page.locator("#disputeReleased")).toHaveText("Dispute closed. Mama Tee’s Kitchen keeps the payment. Reason: [reason].");
  await expect(page.locator("#disputeHeld")).toHaveCount(0);
  await expect(page.locator("#extRaiseDispute")).toHaveCount(0); // within the window, but resolved: can't be reopened
  await expect(page.locator("#panelBody [data-refund]")).toHaveCount(0);
  await expect(events(page, "payment.dispute_resolved")).toHaveCount(0); // Mama Tee’s Kitchen isn't the demo's merchant
  await page.locator("#openNotifHeader").click();
  await expect(notes(page).first()).toContainText("Dispute closed");
  await expect(notes(page).first()).toContainText("We couldn’t resolve your dispute with Mama Tee’s Kitchen in your favor.");
});

test("resolve: reversal. A naira bank transfer goes back to the bank account that paid, not the NGN balance", async ({ page }) => {
  await page.goto("/demo/wallet");
  await disputed(page, "pay_ilv10077");
  const ngn = () => page.evaluate(() => (window as any).__ngn.getState().ngnBalance as number);
  const before = await ngn();
  await page.locator("#tabActivity").click();
  await page.locator('[data-payment="pay_ilv10077"]').click();
  await page.locator("#demoResolveReversal").click();
  await expect(detailRow(page, "Status")).toContainText("Reversed");
  await expect(detailRow(page, "Reversed")).toContainText("₦36,270.00 NGN");
  await expect(page.locator("#extRaiseDispute")).toHaveCount(0);
  await expect(events(page, "payment.dispute_resolved")).toContainText('"outcome":"reversal","amount":3627000');
  await expect(events(page, "payment.refunded")).toHaveCount(0); // a reversal isn't a merchant refund
  await page.waitForTimeout(300);
  expect(await ngn()).toBe(before);
  await page.locator("#backFromTxDetail").click();
  const row = page.locator("#panelBody [data-refund]");
  await expect(row.locator(".tx-title")).toHaveText("Reversal · Ilé Living");
  await expect(row.locator(".tx-sub")).toHaveText("Merchant reversal · Ilé Living");
  await row.click();
  await expect(detailRow(page, "To")).toContainText("the bank account that paid");
  await expect(detailRow(page, "Session ID")).toContainText("[session ID]");
  await expect(page.locator("#refundNote")).toHaveText("Back to the bank account that paid in [refund time]");
  await page.locator("#openNotifHeader").click();
  await expect(notes(page).first()).toContainText("Dispute resolved: payment reversed");
  await expect(notes(page).first()).toContainText("₦36,270.00 NGN is on its way back to the bank account that paid.");
});

test("Checkout: raise a dispute, then the DEMO pill's three resolutions; reversal back to the card; the wallet's notification", async ({ page }) => {
  const widget = await adaPays(page);
  await widget.locator("#doneView").click();
  await widget.locator("#pdDispute").click();
  await widget.locator("#dispStart").click();
  await chooseReason(page, widget, "Didn’t authorise");
  await expect(widget.locator(".infobox")).toContainText("If you don’t recognise this payment");
  await widget.locator("#dispDescription").fill("I didn't make this payment.");
  await widget.locator("#dispReview").click();
  await widget.locator("#dispSubmit").click();
  await expect(events(page, "payment.dispute_opened")).toContainText('"reason":"unauthorised"');
  await widget.locator("#dispDone").click();
  await widget.locator("[data-pay]").first().click();
  await expect(widget.locator("#pdHeld")).toHaveText("$23.40 held while we review.");
  await expect(page.locator("#demo button")).toHaveText(["Resolve: refund", "Resolve: release", "Resolve: reversal"]);
  await page.locator("#demoBtn3").click();
  await expect(widget.locator("#pdStatus")).toHaveText("Reversed");
  await expect(widget.locator("#pdReversed")).toHaveText("$23.40 to Visa ••• 4242");
  await expect(widget.locator("#pdHeld")).toHaveCount(0);
  await expect(widget.locator("#pdDispute")).toHaveCount(0);
  await expect(page.locator("#demo button")).toHaveCount(0); // nothing left to resolve or refund
  await expect(events(page, "payment.dispute_resolved")).toContainText('"outcome":"reversal","amount":2340,"currency":"USD"');

  await widget.locator("#pdBack").click();
  const rev = widget.locator("[data-refund]").first();
  await expect(rev.locator(".tx-title")).toHaveText("Reversal · Ilé Living");
  await expect(rev.locator(".tx-sub")).toContainText("· To Visa ••• 4242");
  await rev.click();
  await expect(widget.locator("#rdReceipt .receipt-row", { hasText: "Status" })).toContainText("Reversed");
  await expect(widget.locator("#rdReceipt .receipt-row", { hasText: "Reversed to" })).toContainText("Visa ••• 4242");
  await expect(widget.locator("#rdNote")).toHaveText("Back to Visa ••• 4242 in [refund time]");

  // The user is told in the wallet (the account's notifications)
  await page.keyboard.press("Escape");
  await page.locator("#demoToWallet").click();
  await page.locator("#openNotifHeader").click();
  await expect(notes(page).first()).toContainText("Dispute resolved: payment reversed");
  await expect(notes(page).first()).toContainText("$23.40 USD is on its way back to Visa ••• 4242.");
});

test("Checkout: Resolve: release shows the reason line; Resolve: refund refunds to the card", async ({ page }) => {
  for (const [btn, check] of [["#demoBtn2", "release"], ["#demoBtn", "refund"]] as const) {
    const widget = await adaPays(page);
    await widget.locator("#doneView").click();
    await widget.locator("#pdDispute").click();
    await widget.locator("#dispStart").click();
    await chooseReason(page, widget, "Not as described");
    await widget.locator("#dispDescription").fill("Wrong colour.");
    await widget.locator("#dispReview").click();
    await widget.locator("#dispSubmit").click();
    await widget.locator("#dispDone").click();
    await widget.locator("[data-pay]").first().click();
    await page.locator(btn).click();
    if (check === "release") {
      await expect(widget.locator("#pdStatus")).toHaveText("Dispute closed");
      await expect(widget.locator("#pdReleased")).toHaveText("Dispute closed. Ilé Living keeps the payment. Reason: [reason].");
      await expect(widget.locator("#pdDispute")).toHaveCount(0);
      await expect(events(page, "payment.dispute_resolved")).toContainText('"outcome":"release","amount":0');
    } else {
      await expect(widget.locator("#pdStatus")).toHaveText("Refunded");
      await expect(widget.locator("#pdRefunded")).toHaveText("$23.40 to Visa ••• 4242");
      await expect(events(page, "payment.dispute_resolved").first()).toContainText('"outcome":"refund","amount":2340');
      await expect(events(page, "payment.refunded").first()).toContainText('"refunded_to":"card"');
    }
  }
});
