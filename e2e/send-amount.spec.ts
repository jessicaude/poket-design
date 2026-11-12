import { press } from "./keypad";
import { test, expect, type Page } from "@playwright/test";

/**
 * Send's amount screen: "You send" (the balance chip and Max), "They get" in the recipient's currency, inline
 * conversion with the quote card. Demo balances: ₦50,000.00 NGN, $65.60 USD ($50.00 open, $15.60 card-funded), no
 * stablecoins.
 */

const setHoldings = (page: Page, patch: object) => page.evaluate((p) => (window as any).__holdings.getState().set(p), patch); // eslint-disable-line @typescript-eslint/no-explicit-any
const usd = (page: Page) => page.evaluate(() => {
  const h = (window as any).__holdings.getState(); // eslint-disable-line @typescript-eslint/no-explicit-any
  return { usd: h.cash.USD as number, fiat: h.fiatOnly.USD as number };
});
async function approve(page: Page) {
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
}
const ngn = (page: Page) => page.evaluate(() => {
  const w = window as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const n = w.__ngn.getState(), h = w.__holdings.getState();
  return { balance: n.ngnBalance as number, reserved: n.ngnReserved as number, usdcBase: h.coins.USDC.Base as number };
});
const chipOptions = (page: Page) => page.locator("#panelBody [data-payfrom]");
async function sendTo(page: Page, recipient: string) {
  await page.locator("#actSend").click();
  await page.locator(`[data-sendrecipient="${recipient}"]`).click();
  await expect(page.locator("#payFromChip")).toBeVisible();
}
const keys = async (page: Page, digits: string) => { for (const d of digits) await press(page, d); };

test("same currency: You send from NGN, They get the same; Max; over the balance", async ({ page }) => {
  await page.goto("/demo/wallet");
  await sendTo(page, "bank:r6");
  await expect(page.locator("#panelBody .cv-box-top > span:first-child")).toHaveText(["You send", "They get"]);
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("NGN");
  await expect(page.locator("#cvQuoteCard")).toHaveCount(0); // no conversion
  await keys(page, "1250000");
  await expect(page.locator("#youSend")).toHaveText("12,500.00");
  await expect(page.locator("#theyGet")).toHaveText("12,500.00");
  await page.locator("#payoutMaxAmt").click();
  await expect(page.locator("#theyGet")).toHaveText("50,000.00");
  await keys(page, "0");
  await expect(page.locator("#payoutAmtHint")).toHaveText("More than your Nigerian Naira balance.");
  await expect(page.locator("#youSend")).toHaveClass(/\berr\b/);
  await expect(page.locator("#payoutReview")).toBeDisabled();
});

test("the chip only offers balances that can pay: no card-funded money for a Nigerian bank", async ({ page }) => {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await setHoldings(page, { coins: { USDC: { Polygon: 0, Base: 1000 }, USDT: { Polygon: 0, Base: 0 } } });
  await sendTo(page, "bank:r6");
  await page.locator("#payFromChip").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Send from");
  await expect(chipOptions(page).locator(".t1")).toHaveText(["US Dollar", "Nigerian Naira", "USDC · Base"]); // open USD converts inline
  await expect(chipOptions(page).locator(".t2")).toHaveText(["Available $50.00 USD", "Available ₦50,000.00 NGN", "Available 10.00 USDC"]);
  // Not offered: card-funded USD (it can't become naira)
  await expect(page.locator('[data-payfrom="cash:USD:fiat"]')).toHaveCount(0);
  await expect(page.locator('[data-payfrom="cash:NGN:open"]')).toHaveClass(/\bsel\b/);
});

test("from another currency: the quote card (rate, ₦[fee] in the coin, They get, 30 seconds); converted at the PIN", async ({ page }) => {
  await page.clock.install();
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await setHoldings(page, { coins: { USDC: { Polygon: 0, Base: 1000 }, USDT: { Polygon: 0, Base: 0 } } });
  await sendTo(page, "bank:lb2");
  await page.locator("#payFromChip").click();
  await page.locator('[data-payfrom="coin:USDC:Base"]').click();
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("USDC (Base)");
  await page.locator("#payoutMaxAmt").click();
  await expect(page.locator("#youSend")).toHaveText("10.00");
  await expect(page.locator("#theyGet")).toHaveText("≈ 15,500.00");
  const card = page.locator("#cvQuoteCard");
  await expect(card.locator(".r-label")).toHaveText(["Rate", "Fee"]); // They get is in its own box
  await expect(card.locator(".r-value")).toHaveText(["1 USDC ≈ 1,550.00 NGN", "[fee] USDC"]);
  await expect(page.locator("#cvTimerLeft")).toHaveText("0:30");
  await page.clock.fastForward("00:31");
  await expect(page.locator("#cvTimer")).toHaveText("Rate expired. Refresh to get a new rate.");
  await expect(page.locator("#payoutReview")).toBeDisabled();
  await page.locator("#cvRefresh").click();
  await page.clock.runFor(500);
  await expect(page.locator("#cvTimerLeft")).toHaveText("0:30");

  await page.locator("#payoutReview").click();
  await page.clock.runFor(600);
  const rows = page.locator("#panelBody .receipt-row");
  await expect(rows.locator(".r-label")).toHaveText(["To", "They get", "You send", "Rate", "Network", "Fee", "Arrives", "Debited from balance"]);
  await expect(rows.filter({ hasText: "Network" }).locator(".r-value")).toHaveText("Base"); // the paying coin's
  await expect(page.locator("#confirmPayout")).toHaveText("Send 10.00 USDC");
  await expect(rows.filter({ hasText: "You send" }).locator(".r-value")).toHaveText("10.00 USDC");
  await expect(rows.filter({ hasText: "Debited from balance" }).locator(".r-value")).toHaveText("10.00 USDC + [fee] USDC");
  // Review holds the same quote: its countdown, and on expiry Refresh rate before Send
  await page.locator("#payoutAckCheck").check();
  await expect(page.locator("#cvTimerLeft")).toHaveText(/^0:(2\d|30)$/);
  await page.clock.fastForward("00:31");
  await expect(page.locator("#cvTimer")).toHaveText("Rate expired. Refresh to get a new rate.");
  await expect(page.locator("#confirmPayout")).toBeDisabled();
  await page.locator("#cvRefresh").click();
  await page.clock.runFor(500);
  await expect(page.locator("#cvTimerLeft")).toHaveText("0:30");
  await expect(page.locator("#confirmPayout")).toBeEnabled();
  await page.locator("#confirmPayout").click();
  await page.clock.runFor(600);
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await page.clock.runFor(2500);
  // USDC left; the naira it bought is reserved for the send (the NGN balance itself is unchanged)
  await expect.poll(() => ngn(page)).toEqual({ balance: 5000000, reserved: 1550000, usdcBase: 0 });

  // One activity record: "To {name} · {source} → {target}", no separate conversion row
  await page.locator("#viewPayoutTx").click();
  const info = page.locator("#panelBody .info-row");
  await expect(info.locator("> span:first-child")).toHaveText(["Status", "Date", "To", "You send", "They get", "Rate", "Fee", "Reference"]);
  await expect(info.filter({ hasText: "You send" }).locator("> span:last-child")).toHaveText("10.00 USDC");
  await expect(info.filter({ hasText: "Rate" }).locator("> span:last-child")).toHaveText("1 USDC ≈ 1,550.00 NGN");
  await expect(info.filter({ hasText: "Fee" }).locator("> span:last-child")).toHaveText("[fee] USDC + ₦[fee]");
  await page.locator("#backFromTxDetail").click();
  const recent = page.locator("#recentActivity .tx-row");
  await expect(recent.first().locator(".tx-title")).toHaveText("To Naira account");
  await expect(recent.first().locator(".tx-sub")).toHaveText("10.00 USDC → ₦15,500.00 NGN · Sending"); // the conversion, then the chip
  await expect(recent.locator(".tx-title", { hasText: "Converted" })).toHaveCount(0);
});

test("a US bank: starts on open USD (card-funded is offered too, not NGN); one speed, 1 to 3 business days, $[fee]", async ({ page }) => {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await sendTo(page, "bank:r4");
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("USD");
  await page.locator("#payFromChip").click();
  await expect(chipOptions(page).locator(".t1")).toHaveText(["US DollarFIAT-ONLY", "US Dollar"]); // card-funded and open; no NGN for a non-Nigerian bank
  await page.locator('[data-payfrom="cash:USD:open"]').click();
  // No speed choice: one speed (first payment: held for [hold] first)
  await expect(page.locator("#panelBody [data-speed]")).toHaveCount(0);
  await expect(page.locator("#theyGetArrival")).toHaveText("After [hold]");
  // Max is the whole balance: the fee is undecided ($[fee]), so it counts as 0
  await page.locator("#payoutMaxAmt").click();
  await expect(page.locator("#youSend")).toHaveText("50.00");
  await keys(page, "0");
  await expect(page.locator("#payoutAmtHint")).toHaveText("More than your US Dollar balance.");
  for (let i = 0; i < 5; i++) await press(page, "back");
  await keys(page, "1000");
  await expect(page.locator("#theyGet")).toHaveText("10.00");
  await expect(page.locator("#theyGetChip")).toHaveText("USD");
  await page.locator("#payoutReview").click();
  const rows = page.locator("#panelBody .receipt-row");
  await expect(rows.locator(".r-label")).toHaveText(["To", "They get", "Fee", "Delivery", "Total charged"]); // no Speed row
  await expect(rows.locator(".r-value")).toHaveText(["Chase Bank · •••• 4821", "$10.00 USD", "$[fee]", "After [hold]", "$10.00 USD + $[fee]"]);
  await expect(page.locator("#confirmPayout")).toHaveText("Send $10.00 USD");
  await expect(page.locator("#panelBody")).toContainText("First payment to a new account sends after [hold]");
  await approve(page);
  await expect(page.locator("#panelBody .step-sub")).toHaveText("Sends to Jordan Blake after [hold]");
  // Taken from open USD until it's paid, given back if it fails
  await expect.poll(() => usd(page)).toEqual({ usd: 5560, fiat: 1560 });
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Scheduled");
  await expect(page.locator("#panelBody .step-title")).toHaveText("$10.00 USD");
  await page.getByRole("button", { name: "Release first-payment hold" }).click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Sending");
  await expect(page.locator("#withdrawalStatusMsg")).toHaveText("1 to 3 business days"); // the US bank's own arrival, not the naira one
  await page.getByRole("button", { name: "Fail", exact: true }).click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Failed");
  await expect.poll(() => usd(page)).toEqual({ usd: 6560, fiat: 1560 });
});

test("a debit card: only USD pays it; $[fee], Instantly", async ({ page }) => {
  await page.goto("/demo/wallet?send=card");
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.locator("#cardNum").fill("4242424242424242");
  await page.locator("#cardName").fill("Kemi Adeyemi"); // someone else's card
  await page.locator("#cardZip").fill("10001");
  await page.locator("#cardContinue").click();
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("USD");
  await page.locator("#payFromChip").click();
  await expect(chipOptions(page).locator(".t1")).toHaveText(["US DollarFIAT-ONLY", "US Dollar"]); // card-funded and open USD only
  await page.locator('[data-payfrom="cash:USD:open"]').click();
  await expect(page.locator("#panelBody [data-speed]")).toHaveCount(0); // no speed choice
  await keys(page, "2500");
  await page.locator("#payoutReview").click();
  const rows = page.locator("#panelBody .receipt-row");
  await expect(rows.locator(".r-label")).toHaveText(["To", "They get", "Fee", "Delivery", "Total charged"]);
  await expect(rows.locator(".r-value")).toHaveText(["Visa · •••• 4242", "$25.00 USD", "$[fee]", "Instantly", "$25.00 USD + $[fee]"]);
  await expect(page.locator("#firstPaymentNotice")).toHaveCount(0); // the hold is for bank accounts
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#stepupIntroContinue").click(); // $25.00 leaves USD: over the step-up limit
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#panelBody .step-sub")).toHaveText("Sent to Kemi Adeyemi");
  await expect.poll(() => usd(page)).toEqual({ usd: 4060, fiat: 1560 });
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Sending");
  await expect(page.locator("#withdrawalStatusMsg")).toHaveText("Instantly"); // the card's own arrival
});

test("USD to a Nigerian bank: converts inline at the quote; one record; the naira reserved", async ({ page }) => {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await sendTo(page, "bank:lb2"); // Naira account, paid before
  await page.locator("#payFromChip").click();
  await expect(page.locator('[data-payfrom="cash:USD:fiat"]')).toHaveCount(0); // card-funded money can't become naira
  await page.locator('[data-payfrom="cash:USD:open"]').click();
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("USD");
  await keys(page, "1000"); // under the demo step-up (₦20,000.00)
  await expect(page.locator("#youSend")).toHaveText("10.00");
  await expect(page.locator("#theyGet")).toHaveText(/^≈ 1\d,\d{3}\.\d{2}$/); // at about 1,550 NGN per USD, less the conversion fee
  const card = page.locator("#cvQuoteCard");
  await expect(card.locator(".r-label")).toHaveText(["Rate", "Fee"]); // They get is in its own box
  await expect(card.locator(".r-value").first()).toHaveText(/^1 USD ≈ 1,5\d\d\.\d{2} NGN$/);
  const theyGet = `₦${(await page.locator("#theyGet").textContent())!.replace("≈ ", "")} NGN`; // the They get box (chip: NGN)
  await page.locator("#payoutReview").click();
  const rows = page.locator("#panelBody .receipt-row");
  await expect(rows.locator(".r-label")).toHaveText(["To", "They get", "You send", "Rate", "Fee", "Arrives", "Debited from balance"]);
  await expect(rows.filter({ hasText: "They get" }).locator(".r-value")).toHaveText(theyGet);
  await expect(rows.filter({ hasText: "You send" }).locator(".r-value")).toHaveText("$10.00 USD");
  await expect(rows.filter({ hasText: "Arrives" }).locator(".r-value")).toHaveText("Usually within seconds");
  await expect(rows.filter({ hasText: "Debited from balance" }).locator(".r-value")).toHaveText("$10.00 USD + $[fee]");
  await approve(page);
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
  // USD left; the naira it bought is reserved for the send (the NGN balance itself is unchanged)
  const received = Math.round(Number(theyGet.replace(/[^\d.]/g, "")) * 100);
  await expect.poll(() => usd(page)).toEqual({ usd: 5560, fiat: 1560 });
  await expect.poll(() => ngn(page)).toMatchObject({ balance: 5000000, reserved: received });
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#panelBody .info-row").filter({ hasText: "You send" }).locator("> span:last-child")).toHaveText("$10.00 USD");
  await page.locator("#backFromTxDetail").click();
  await expect(page.locator("#recentActivity .tx-row").first().locator(".tx-title")).toHaveText("To Naira account");
  await expect(page.locator("#recentActivity .tx-row").first().locator(".tx-sub")).toHaveText(new RegExp(`^\\$10\\.00 USD → ${theyGet.replace(/[.$]/g, "\\$&")}`));
});

test("a balance screen preselects its balance when it can pay the recipient", async ({ page }) => {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible(); // the demo hooks are set
  await setHoldings(page, { coins: { USDC: { Polygon: 0, Base: 1000 }, USDT: { Polygon: 0, Base: 0 } } });
  await page.locator('[data-holdasset="USDC"][data-holdnet="Base"]').click();
  await page.locator("#detailSend").click();
  await expect(page.locator("#sendFrom")).toHaveText("From USDC on Base");
  await page.locator('[data-sendrecipient="bank:r6"]').click();
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("USDC (Base)");
  await expect(page.locator("#cvQuoteCard")).toBeVisible();
});

test("keypad: hidden until You send's amount is tapped; Done or a tap elsewhere hides it; Review sits under the amounts", async ({ page }) => {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await sendTo(page, "bank:r6");
  const keypad = page.locator("#sendKeypad");
  await expect(keypad).toHaveCount(0);
  // Review right under the amounts (and the first-payment notice)
  const below = async () => {
    const box = await page.locator("#theyGetBox").boundingBox(), review = await page.locator("#payoutReview").boundingBox();
    return Math.round(review!.y - (box!.y + box!.height));
  };
  expect(await below()).toBeLessThan(120);

  await page.locator("#youSend").click();
  await expect(keypad).toBeVisible();
  await expect(page.locator("#youSend")).toHaveAttribute("aria-expanded", "true");
  for (const d of "2500") await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await expect(page.locator("#youSend")).toHaveText("25.00");
  await expect(page.locator("#theyGet")).toHaveText("25.00");
  expect(await below()).toBeGreaterThan(250); // the keypad is between them
  await page.locator("#keypadDone").click();
  await expect(keypad).toHaveCount(0);

  // A tap elsewhere in the wallet hides it; so does a tap outside the wallet
  await page.locator("#youSend").click();
  await page.locator("#sendToTitle").click();
  await expect(keypad).toHaveCount(0);
  await page.locator("#youSend").click();
  await page.mouse.click(5, 600);
  await expect(keypad).toHaveCount(0);

  // With the keypad open, Review still works first time (the keypad closes after the tap, not under it)
  await page.locator("#youSend").click();
  await page.locator("#payoutReview").click();
  await expect(page.locator("#confirmPayout")).toBeVisible();
});

test("They get: the same box as You send, with a fixed chip (currency mark, name, tag) and the amount", async ({ page }) => {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await sendTo(page, "bank:r6");
  await expect(page.locator("#panelBody .cv-box")).toHaveCount(2);
  await expect(page.locator("#theyGetChip")).toHaveText("NGN");
  await expect(page.locator("#theyGetChip")).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#theyGetChip .asset-icon-wrap, #theyGetChip svg").first()).toBeVisible(); // the currency mark
  await expect(page.locator("#theyGetArrival")).toHaveText("After [hold]");
  await expect(page.locator("#cvQuoteCard")).toHaveCount(0); // not converting
  // The two amounts are the same size
  const size = (sel: string) => page.locator(sel).evaluate((e) => getComputedStyle(e).fontSize);
  expect(await size("#theyGet")).toBe(await size("#youSend"));
});
