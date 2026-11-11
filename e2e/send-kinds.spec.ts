import { test, expect, type Page } from "@playwright/test";

/**
 * Every kind of send uses the same amount, review, PIN, reservation and status screens. Poket users arrive instantly
 * and are paid at once; stablecoin wallets need Tier 2 and their address is screened before review.
 * Demo balances: ₦50,000.00 NGN; USDC is set per test.
 */

const setHoldings = (page: Page, patch: object) => page.evaluate((p) => (window as any).__holdings.getState().set(p), patch); // eslint-disable-line @typescript-eslint/no-explicit-any
const balances = (page: Page) => page.evaluate(() => {
  const w = window as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const n = w.__ngn.getState(), h = w.__holdings.getState();
  return { ngn: n.ngnBalance as number, reserved: n.ngnReserved as number, usdcBase: h.coins.USDC.Base as number };
});
const keys = async (page: Page, digits: string) => { for (const d of digits) await page.locator(`[data-payoutkey="${d}"]`).click(); };
const rows = (page: Page) => page.locator("#panelBody .receipt-row");
async function start(page: Page) {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
}
async function confirmWithPin(page: Page) {
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
}

test("a Poket user: free, Instantly; paid at once (nothing left on hold)", async ({ page }) => {
  await start(page);
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="poket:pu1"]').click();
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("NGN");
  await keys(page, "100000");
  await expect(page.locator("#theyGet")).toHaveText("₦1,000.00 NGN");
  await page.locator("#payoutReview").click();
  await expect(rows(page).locator(".r-label")).toHaveText(["To", "They get", "Fee", "Delivery", "Total charged"]);
  await expect(rows(page).locator(".r-value")).toHaveText(["tobi@lagos.ng", "₦1,000.00 NGN", "Free", "Instantly", "₦1,000.00 NGN"]);
  await expect(page.locator("#panelBody")).not.toContainText("First payment"); // only for bank accounts
  await confirmWithPin(page);
  await expect(page.locator("#panelBody .step-sub")).toHaveText("Sent to Tobi Bello");
  await expect(rows(page).filter({ hasText: "Estimated delivery" }).locator(".r-value")).toHaveText("Instantly");
  await expect.poll(() => balances(page)).toMatchObject({ ngn: 4900000, reserved: 0 });
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Paid");
  await page.locator("#backFromTxDetail").click();
  await expect(page.locator("#recentActivity .tx-row").first().locator(".tx-title")).toHaveText("To Tobi Bello");
});

test("a saved stablecoin wallet: Tier 2 first; then the address is screened before review; 1.50 USDC fee", async ({ page }) => {
  await start(page);
  await setHoldings(page, { coins: { USDC: { Polygon: 0, Base: 1000 }, USDT: { Polygon: 0, Base: 0 } } });
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="wallet:sw1"]').click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Unlock sending to external wallets");
  await page.locator("#backFromTier2").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Send");

  await page.getByLabel("Tier").selectOption("2");
  await page.locator('[data-sendrecipient="wallet:sw1"]').click();
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("USDC (Base)");
  await expect(page.locator("#cvQuoteCard")).toHaveCount(0);
  await keys(page, "500");
  await expect(page.locator("#theyGet")).toHaveText("5.00 USDC");
  await page.locator("#payoutReview").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Checking this address");
  await expect(rows(page).locator(".r-label")).toHaveText(["To", "They get", "Fee", "Delivery", "Total charged"]);
  await expect(rows(page).locator(".r-value").nth(1)).toHaveText("5.00 USDC");
  await expect(rows(page).locator(".r-value").nth(2)).toHaveText("1.50 USDC");
  await expect(rows(page).locator(".r-value").nth(3)).toHaveText("About 1 minute");
  await expect(rows(page).locator(".r-value").nth(4)).toHaveText("6.50 USDC");
  await confirmWithPin(page);
  await expect(page.locator("#panelBody .step-sub")).toHaveText("Sent to Ledger");
  await expect.poll(() => balances(page)).toMatchObject({ usdcBase: 350, ngn: 5000000, reserved: 0 });
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Sending");
  await expect(page.locator("#withdrawalStatusMsg")).toHaveText("About 1 minute"); // the wallet's own arrival
  await expect(page.locator("#panelBody .step-title")).toHaveText("5.00 USDC");
});

test("a flagged address: screening blocks the send before review", async ({ page }) => {
  await start(page);
  await page.getByLabel("Tier").selectOption("2");
  await setHoldings(page, { coins: { USDC: { Polygon: 0, Base: 1000 }, USDT: { Polygon: 0, Base: 0 } } });
  await page.locator("#actSend").click();
  await page.locator("#newRecipient").click();
  await page.locator('[data-newkind="wallet"]').click();
  await page.locator("#walletAddr").fill("0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
  await page.locator("#walletContinue").click();
  await keys(page, "100");
  await page.locator("#payoutReview").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("We can't send to this address");
  await page.locator("#addressScreeningBlockedClose").click();
  await expect.poll(() => balances(page)).toMatchObject({ usdcBase: 1000 }); // nothing sent
});

test("a USDC wallet paid from NGN: step-up on the naira leaving; the total includes the wallet fee, in naira", async ({ page }) => {
  await start(page);
  await page.getByLabel("Tier").selectOption("2");
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="wallet:sw1"]').click();
  await page.locator("#payFromChip").click();
  await page.locator('[data-payfrom="cash:NGN:open"]').click();
  await keys(page, "2500000"); // ₦25,000.00
  await page.locator("#payoutReview").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Checking this address");
  // 1.50 USDC = ₦2,325.00 at 1,550: in the total, with the conversion's undecided ₦[fee]
  await expect(rows(page).filter({ hasText: "Total charged" }).locator(".r-value")).toHaveText("₦27,325.00 NGN + ₦[fee]");
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  // ₦27,325 (about $17.63) leaves the NGN balance: step-up, though the wallet gets only 16.13 USDC
  await expect(page.locator("#stepupIntroContinue")).toBeVisible();
  await page.locator("#stepupIntroContinue").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
  await expect.poll(() => balances(page)).toMatchObject({ ngn: 2267500, reserved: 2732500 }); // what the total said
});

test("a Poket user over the limit in USDC isn't judged in naira: 100.00 USDC steps up, 10.00 doesn't", async ({ page }) => {
  await start(page);
  await setHoldings(page, { coins: { USDC: { Polygon: 0, Base: 20000 }, USDT: { Polygon: 0, Base: 0 } } });
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="poket:pu1"]').click();
  await page.locator("#payFromChip").click();
  await page.locator('[data-payfrom="coin:USDC:Base"]').click();
  await keys(page, "1000"); // 10.00 USDC = $10.00: under the demo limit (₦20,000 ≈ $12.90)
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await expect(page.locator("#panelBody .otp-box")).toHaveCount(4); // straight to the PIN
  await page.locator("#backToPayoutReview").click();
  await page.locator("#backToPayoutAmount").click();
  await keys(page, "0"); // 100.00 USDC
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await expect(page.locator("#stepupIntroContinue")).toBeVisible();
});

test("a Poket user from merchant-held naira: allowed; their money keeps MERCHANT-HELD", async ({ page }) => {
  await start(page);
  await page.getByLabel("Merchant-held balance").selectOption("yes");
  await page.locator('[data-wallettab="cash"]').click();
  await page.locator('#panelBody [data-holdbucket="merchant"]').click();
  await page.locator("#detailSend").click();
  await page.locator('[data-sendrecipient="poket:pu1"]').click();
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("NGNMERCHANT-HELD");
  await keys(page, "100000");
  await expect(page.locator("#theyGetTag")).toHaveText("MERCHANT-HELD");
  await page.locator("#payoutReview").click();
  await expect(page.locator("#reviewTheyGet")).toHaveText("₦1,000.00 NGNMERCHANT-HELD");
  await confirmWithPin(page);
  await expect(page.locator("#panelBody .step-sub")).toHaveText("Sent to Tobi BelloMERCHANT-HELD");
  await expect.poll(() => page.evaluate(() => (window as any).__ngn.getState().ngnMerchantBalance)).toBe(1100000); // eslint-disable-line @typescript-eslint/no-explicit-any
  await expect.poll(() => balances(page)).toMatchObject({ ngn: 5000000, reserved: 0 }); // the open balance isn't touched
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Paid");
  await expect(page.locator("#withdrawalTag")).toHaveText("MERCHANT-HELD");
});

test("a Poket user from card-funded USD: allowed; their money keeps FIAT-ONLY", async ({ page }) => {
  await start(page);
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="poket:pu1"]').click();
  await page.locator("#payFromChip").click();
  await page.locator('[data-payfrom="cash:USD:fiat"]').click();
  await keys(page, "500");
  await expect(page.locator("#theyGet")).toHaveText("$5.00 USD"); // no conversion: the source's currency
  await expect(page.locator("#theyGetTag")).toHaveText("FIAT-ONLY");
  await page.locator("#payoutReview").click();
  await expect(page.locator("#reviewTheyGet")).toHaveText("$5.00 USDFIAT-ONLY");
  await confirmWithPin(page);
  await expect.poll(() => page.evaluate(() => { const h = (window as any).__holdings.getState(); return [h.cash.USD, h.fiatOnly.USD]; })).toEqual([6060, 1060]); // eslint-disable-line @typescript-eslint/no-explicit-any
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalTag")).toHaveText("FIAT-ONLY");
});
