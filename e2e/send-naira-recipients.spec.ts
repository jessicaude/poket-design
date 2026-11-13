import { press } from "./keypad";
import { passSelfie } from "./selfie";
import { test, expect, type Page } from "@playwright/test";

/**
 * WGT-07, naira to Poket users: a recipient who can hold naira gets naira; one who can't gets USD, converted on
 * receipt, with the quote card before sending. Amara Okafor (pu4) can hold naira; Daniel Cho (pu5) can't; every other
 * Poket user follows the demo bar's "Recipient can hold naira". Demo balances: ₦50,000.00 NGN, $50.00 + $15.60
 * FIAT-ONLY USD. Each test pins the quote at ₦1,550 per $1 (jitter 1) before typing, so amounts are exact.
 */

const keys = async (page: Page, digits: string) => { for (const d of digits) await press(page, d); };
const rows = (page: Page) => page.locator("#panelBody .receipt-row");
const info = (page: Page) => page.locator("#panelBody .info-row");
const activity = (page: Page) => page.getByTestId("recipientActivity");
const exactRate = (page: Page) => page.evaluate(() => (window as any).__payout.setState({ jitter: 1 })); // eslint-disable-line @typescript-eslint/no-explicit-any

async function start(page: Page) {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
}
/** Send → a saved Poket user, then the amount (from the home: the NGN balance first). */
async function sendTo(page: Page, id: string, digits: string) {
  await page.locator("#actSend").click();
  await page.locator(`[data-sendrecipient="poket:${id}"]`).click();
  await exactRate(page);
  await keys(page, digits);
}
async function reviewAndSend(page: Page) {
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
}

test("Amara can hold naira: she gets naira; no notice, no quote; her activity shows naira", async ({ page }) => {
  await start(page);
  await sendTo(page, "pu4", "500000");
  await expect(page.locator("#sendToTitle")).toHaveText("Send to Amara");
  await expect(page.locator("#nairaRecipientNotice")).toHaveCount(0);
  await expect(page.locator("#theyGet")).toHaveText("5,000.00");
  await expect(page.locator("#cvQuoteCard")).toHaveCount(0);
  await reviewAndSend(page);
  await expect(page.locator("#panelBody .step-title")).toHaveText("₦5,000.00 NGN"); // not converted: what she gets
  await expect(page.locator("#doneSent")).toHaveCount(0);
  await expect(page.locator("#doneTheyGet")).toHaveCount(0);
  await page.locator("#viewPayoutTx").click();
  await expect(info(page).locator(":scope > span:first-child")).toHaveText(["Status", "Date", "From", "To", "Method", "Fee", "Reference"]); // no conversion rows, no session ID (not a bank)
  await expect(activity(page).locator('li[data-recipient="pu4"]')).toHaveText("Amara OkaforReceived ₦5,000.00 NGN from Ada Osun");
});

test("Daniel can't hold naira: the notice, They get in USD and the quote; the receipt and his activity in USD", async ({ page }) => {
  await start(page);
  await sendTo(page, "pu5", "500000");
  await expect(page.locator("#nairaRecipientNotice")).toHaveText("Daniel can't hold naira. They'll get USD.");
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("NGN");
  await expect(page.locator("#theyGet")).toHaveText("≈ 3.23");
  // The quote card: rate, fee, They get, 30-second hold
  await expect(page.locator("#cvQuoteCard .r-label")).toHaveText(["Rate", "Fee"]); // They get is in its box
  await expect(page.locator("#cvQuoteCard .r-value")).toHaveText(["1 USD ≈ 1,550.00 NGN", "₦[fee]"]);
  await expect(page.locator("#theyGetChip")).toHaveText("USD");
  await expect(page.locator("#cvTimer")).toHaveText(/^Rate held for 0:(30|29)$/);

  await page.locator("#payoutReview").click();
  await expect(page.locator("#reviewTheyGet")).toHaveText("$3.23 USD");
  await expect(rows(page).filter({ hasText: "You send" }).locator(".r-value")).toHaveText("₦5,000.00 NGN");
  await expect(rows(page).filter({ hasText: "Rate" }).locator(".r-value")).toHaveText("1 USD ≈ 1,550.00 NGN");
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  // Done: what left your balance first, what Daniel gets underneath
  await expect(page.locator("#doneSent")).toHaveText("₦5,000.00 NGN sent");
  await expect(page.locator("#doneTheyGet")).toHaveText("Daniel gets $3.23 USD");
  await expect(page.locator("#panelBody .step-sub").filter({ hasText: "Sent to" })).toHaveText("Sent to Daniel Cho");
  // The naira left the NGN balance, and nothing is on hold (paid at once)
  await expect.poll(() => page.evaluate(() => { const n = (window as any).__ngn.getState(); return [n.ngnBalance, n.ngnReserved]; })).toEqual([4500000, 0]); // eslint-disable-line @typescript-eslint/no-explicit-any

  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Paid");
  // Your receipt leads with what left your balance; They get is a row
  await expect(page.locator("#panelBody .step-title")).toHaveText("₦5,000.00 NGN");
  const receipt = Object.fromEntries(await info(page).evaluateAll((els) => els.map((e) => [e.children[0].textContent, e.children[1].textContent])));
  expect(receipt).toMatchObject({ "You send": "₦5,000.00 NGN", "They get": "$3.23 USD", Rate: "1 USD ≈ 1,550.00 NGN", Fee: "₦[fee] + Free" });
  await expect(activity(page).locator('li[data-recipient="pu5"]')).toHaveText("Daniel ChoReceived $3.23 USD from Ada Osun");

  // Your activity (the NGN balance's history): "To Daniel Cho · ₦5,000.00 NGN → $3.23 USD", and the naira that left
  await page.locator("#backFromTxDetail").click();
  await page.locator('[data-wallettab="cash"]').click();
  await page.locator('#panelBody [data-holdcur="NGN"][data-holdbucket="open"] .tx-title').click();
  const row = page.locator('#panelBody .tx-row[data-txid]:not([data-txid*="seed"])'); // not Ada's seeded history
  await expect(row.locator(".tx-title")).toHaveText(["To Daniel Cho"]);
  await expect(row.locator(".tx-sub")).toHaveText(["₦5,000.00 NGN → $3.23 USD"]); // paid: no status chip
  await expect(row.locator(".tx-amt")).toHaveText(["-₦5,000.00 NGN"]);
  // Only the recipient's record is in USD: yours is in naira
  const mine = await page.evaluate(() => (window as any).__withdrawals.getState().list[0]); // eslint-disable-line @typescript-eslint/no-explicit-any
  expect(mine).toMatchObject({ currency: "NGN", sourceKey: "cash:NGN:open", targetKey: "cash:USD:open" });
});

test("Daniel, held for a quick check ($500 or more, first payment): on hold in naira, listed with what left", async ({ page }) => {
  await start(page);
  await page.evaluate(() => (window as any).__ngn.getState().set({ ngnBalance: 100000000 })); // eslint-disable-line @typescript-eslint/no-explicit-any
  await sendTo(page, "pu5", "77500000"); // ₦775,000.00 = $500.00
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await passSelfie(page); // over the demo step-up limit
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#quickCheck")).toBeVisible();
  await expect(page.locator("#doneSent")).toHaveText("₦775,000.00 NGN sent");
  await expect(page.locator("#doneTheyGet")).toHaveText("Daniel gets $500.00 USD");
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("₦775,000.00 NGN");
  await page.locator("#backFromTxDetail").click();
  await page.locator('[data-wallettab="cash"]').click();
  await page.locator("#homeOnHold").click();
  await expect(page.locator("#panelBody .tx-row .tx-title")).toHaveText(["To Daniel Cho"]);
  await expect(page.locator("#panelBody .tx-row .tx-sub")).toHaveText(["₦775,000.00 NGN → $500.00 USD · Held for a quick check"]);
  await expect(page.locator("#panelBody .tx-row .tx-amt")).toHaveText(["-₦775,000.00 NGN"]);
  await expect(activity(page).locator('li[data-recipient="pu5"]')).toHaveCount(0); // not credited until it's paid
});

test("Daniel: the rate expires after 30 seconds; Refresh rate gives a new one and Review works again", async ({ page }) => {
  await page.clock.install();
  await start(page);
  await sendTo(page, "pu5", "500000");
  await expect(page.locator("#cvTimer")).toHaveText("Rate held for 0:30");
  await page.clock.runFor(30_000);
  await expect(page.locator("#cvTimer")).toHaveText("Rate expired. Refresh to get a new rate.");
  await expect(page.locator("#payoutReview")).toBeDisabled();
  await page.locator("#cvRefresh").click();
  await page.clock.runFor(500);
  await expect(page.locator("#cvTimer")).toHaveText("Rate held for 0:30");
  await expect(page.locator("#theyGet")).toHaveText(/^≈ 3\.2\d$/); // a new quote can move a little
  await expect(page.locator("#payoutReview")).toBeEnabled();
});

test("the NGN-to-stablecoins block doesn't change it: Daniel still gets USD, never a stablecoin", async ({ page }) => {
  await start(page);
  await page.getByLabel("NGN to stablecoins").selectOption("blocked");
  await sendTo(page, "pu5", "310000");
  await expect(page.locator("#theyGet")).toHaveText("≈ 2.00");
  await reviewAndSend(page);
  await expect(activity(page).locator('li[data-recipient="pu5"]')).toHaveText("Daniel ChoReceived $2.00 USD from Ada Osun");
});

test("any other Poket user follows the demo bar: No converts on receipt, Yes gets naira (switching live)", async ({ page }) => {
  await start(page);
  await sendTo(page, "pu1", "310000"); // Tobi Bello
  await expect(page.locator("#nairaRecipientNotice")).toHaveCount(0);
  await expect(page.locator("#theyGet")).toHaveText("3,100.00");
  await page.getByLabel("Recipient can hold naira").selectOption("no");
  await expect(page.locator("#nairaRecipientNotice")).toHaveText("Tobi can't hold naira. They'll get USD.");
  await expect(page.locator("#theyGet")).toHaveText(/^≈ 2\.\d\d$/);
  await expect(page.locator("#cvTimer")).toHaveText(/^Rate held for 0:(30|29)$/);
  await page.getByLabel("Recipient can hold naira").selectOption("yes");
  await expect(page.locator("#nairaRecipientNotice")).toHaveCount(0);
  await expect(page.locator("#theyGet")).toHaveText("3,100.00");
  // Amara and Daniel keep their own setting whatever the bar says
  await page.getByLabel("Recipient can hold naira").selectOption("no");
  await page.locator("#editPayoutRecipient").click();
  await page.locator('[data-sendrecipient="poket:pu4"]').click();
  await expect(page.locator("#nairaRecipientNotice")).toHaveCount(0);
});

test("mock: naira is refused for a recipient who can't hold it; USD is credited instead", async () => {
  const { reservePayout, createPayout, getPoketUserBalances, resetPayoutServer } = await import("@/lib/mock-api");
  resetPayoutServer();
  const r1 = await reservePayout({ currency: "NGN", amount: 310000 });
  await expect(createPayout({ currency: "NGN", amount: 310000, fee: 0, recipientId: "pu5", reservationId: r1.id, kind: "poket", sourceKey: "cash:NGN:open", sourceTotal: 310000 }))
    .rejects.toThrow("recipient_cannot_hold_naira");
  const w = await createPayout({ currency: "USD", amount: 200, fee: 0, recipientId: "pu5", reservationId: r1.id, kind: "poket", sourceKey: "cash:NGN:open", sourceTotal: 310000, targetKey: "cash:USD:open" });
  expect(w.status).toBe("paid");
  expect(getPoketUserBalances("pu5")).toEqual({ "USD:open": 200 });
});
