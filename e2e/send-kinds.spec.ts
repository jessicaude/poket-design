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
