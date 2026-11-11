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
const keys = async (page: Page, digits: string) => { for (const d of digits) await page.locator(`[data-payoutkey="${d}"]`).click(); };

test("same currency: You send from NGN, They get the same; Max; over the balance", async ({ page }) => {
  await page.goto("/demo/wallet");
  await sendTo(page, "bank:r6");
  await expect(page.locator("#panelBody .field-label")).toHaveText(["You send", "They get"]);
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("NGN");
  await expect(page.locator("#cvQuoteCard")).toHaveCount(0); // no conversion
  await keys(page, "1250000");
  await expect(page.locator("#youSend")).toHaveText("12,500.00");
  await expect(page.locator("#theyGet")).toHaveText("₦12,500.00 NGN");
  await page.locator("#payoutMaxAmt").click();
  await expect(page.locator("#theyGet")).toHaveText("₦50,000.00 NGN");
  await keys(page, "0");
  await expect(page.locator("#payoutAmtHint")).toHaveText("More than your Nigerian Naira balance.");
  await expect(page.locator("#youSend")).toHaveClass(/\berr\b/);
  await expect(page.locator("#payoutReview")).toBeDisabled();
});

test("the chip only offers balances that can pay: no card-funded money or merchant-held naira for a Nigerian bank", async ({ page }) => {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("Merchant-held balance").selectOption("yes");
  await setHoldings(page, { coins: { USDC: { Polygon: 0, Base: 1000 }, USDT: { Polygon: 0, Base: 0 } } });
  await sendTo(page, "bank:r6");
  await page.locator("#payFromChip").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Send from");
  await expect(chipOptions(page).locator(".t1")).toHaveText(["US Dollar", "Nigerian Naira", "USDC · Base"]); // open USD converts inline
  await expect(chipOptions(page).locator(".t2")).toHaveText(["Available $50.00 USD", "Available ₦50,000.00 NGN", "Available 10.00 USDC"]);
  // Not offered: card-funded USD (naira), merchant-held naira (a bank)
  await expect(page.locator('[data-payfrom="cash:USD:fiat"]')).toHaveCount(0);
  await expect(page.locator('[data-payfrom="cash:NGN:merchant"]')).toHaveCount(0);
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
  await expect(page.locator("#theyGet")).toHaveText("≈ ₦15,500.00 NGN");
  const card = page.locator("#cvQuoteCard");
  await expect(card.locator(".r-label")).toHaveText(["Rate", "Fee", "They get"]);
  await expect(card.locator(".r-value")).toHaveText(["1 USDC ≈ 1,550.00 NGN", "[fee] USDC", "₦15,500.00 NGN"]);
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
  await expect(recent.first().locator(".tx-title")).toHaveText("To Naira account · 10.00 USDC → ₦15,500.00 NGN");
  await expect(recent.locator(".tx-title", { hasText: "Converted" })).toHaveCount(0);
});

test("a US bank: starts on open USD (card-funded is offered too, not NGN or merchant-held); the speed and its fee per send", async ({ page }) => {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("Merchant-held balance").selectOption("yes");
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await sendTo(page, "bank:r4");
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("USD");
  await expect(page.locator("#payoutSpeedPill")).toHaveCount(0); // naira rules don't apply
  await page.locator("#payFromChip").click();
  await expect(chipOptions(page).locator(".t1")).toHaveText(["US DollarFIAT-ONLY", "US Dollar"]); // card-funded and open; no NGN for a non-Nigerian bank
  await page.locator('[data-payfrom="cash:USD:open"]').click();

  // Instant: $1.50, and Max leaves room for it
  await page.locator('[data-speed="rtp"]').click();
  await page.locator("#payoutMaxAmt").click();
  await expect(page.locator("#youSend")).toHaveText("48.50");
  await keys(page, "0");
  await expect(page.locator("#payoutAmtHint")).toHaveText("More than your US Dollar balance."); // with the fee
  for (let i = 0; i < 5; i++) await page.locator('[data-payoutkey="back"]').click();
  await keys(page, "1000");
  await expect(page.locator("#theyGet")).toHaveText("$10.00 USD");
  await page.locator("#payoutReview").click();
  const rows = page.locator("#panelBody .receipt-row");
  await expect(rows.locator(".r-label")).toHaveText(["To", "Speed", "They get", "Fee", "Delivery", "Total charged"]);
  await expect(rows.locator(".r-value")).toHaveText(["Chase Bank · •••• 4821", "Instant", "$10.00 USD", "$1.50 USD", "After [hold]", "$11.50 USD"]); // first payment: held
  await expect(page.locator("#confirmPayout")).toHaveText("Send $10.00 USD");
  await expect(page.locator("#panelBody")).toContainText("First payment to a new account sends after [hold]");
  // Back to the amount: Standard is free
  await page.locator("#backToPayoutAmount").click();
  await page.locator('[data-speed="ach"]').click();
  await page.locator("#payoutReview").click();
  await expect(rows.locator(".r-value")).toHaveText(["Chase Bank · •••• 4821", "Standard", "$10.00 USD", "Free", "After [hold]", "$10.00 USD"]);
  await approve(page);
  await expect(page.locator("#panelBody .step-sub")).toHaveText("Sends to Jordan Blake after [hold]");
  // Taken from open USD until it's paid, given back if it fails
  await expect.poll(() => usd(page)).toEqual({ usd: 5560, fiat: 1560 });
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Scheduled");
  await expect(page.locator("#panelBody .step-title")).toHaveText("$10.00 USD");
  await page.getByRole("button", { name: "Release first-payment hold" }).click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Sending");
  await expect(page.locator("#withdrawalStatusMsg")).toHaveText("1 to 3 business days"); // Standard's own arrival, not the naira one
  await page.getByRole("button", { name: "Fail", exact: true }).click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Failed");
  await expect.poll(() => usd(page)).toEqual({ usd: 6560, fiat: 1560 });
});

test("a US bank by wire: $15.00 and the recipient's address, sent with it", async ({ page }) => {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await sendTo(page, "bank:r4");
  await keys(page, "2000");
  await page.locator('[data-speed="wire"]').click();
  await expect(page.locator("#payoutReview")).toBeDisabled();
  await page.locator("#usStreet").fill("1 Main St");
  await page.locator("#usCity").fill("Austin");
  await page.locator("#usState").fill("TX");
  await page.locator("#usZip").fill("78701");
  await page.locator("#payoutReview").click();
  const rows = page.locator("#panelBody .receipt-row");
  await expect(rows.locator(".r-value")).toHaveText(["Chase Bank · •••• 4821", "Wire", "$20.00 USD", "$15.00 USD", "After [hold]", "$35.00 USD"]);
  // $35.00 leaves the USD balance: over the step-up limit (judged on the USD value leaving, fee included)
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#stepupIntroContinue").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
  await expect.poll(() => usd(page)).toEqual({ usd: 3060, fiat: 1560 });
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
  await expect(page.locator("#panelBody [data-speed]")).toHaveCount(0); // one speed
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
  await expect(page.locator("#theyGet")).toHaveText(/^≈ ₦1\d,\d{3}\.\d{2} NGN$/); // at about 1,550 NGN per USD, less the conversion fee
  const card = page.locator("#cvQuoteCard");
  await expect(card.locator(".r-label")).toHaveText(["Rate", "Fee", "They get"]);
  await expect(card.locator(".r-value").first()).toHaveText(/^1 USD ≈ 1,5\d\d\.\d{2} NGN$/);
  const theyGet = (await card.locator(".r-value").last().textContent())!;
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
  await expect(page.locator("#recentActivity .tx-row").first().locator(".tx-title")).toHaveText(`To Naira account · $10.00 USD → ${theyGet}`);
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
