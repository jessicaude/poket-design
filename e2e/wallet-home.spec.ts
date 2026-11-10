import { test, expect, type Page } from "@playwright/test";

/**
 * Wallet home (tWalletHome in reference/poket-unified.html). Demo balances: ₦50,000.00 NGN, $15.60 USD (card-funded),
 * no stablecoins, so the total is $47.86 USD (15.60 + 50,000 / 1,550). Recent activity: the reference's three records.
 */

const body = (page: Page) => page.locator("#panelBody");
const setHoldings = (page: Page, patch: object) => page.evaluate((p) => (window as any).__holdings.getState().set(p), patch); // eslint-disable-line @typescript-eslint/no-explicit-any
const cashTab = (page: Page) => page.locator('[data-wallettab="cash"]').click();

test.beforeEach(async ({ page }) => {
  await page.goto("/demo/wallet");
  await expect(page.locator("#totalBalance")).toBeVisible();
});

test("balance card: total in USD, the eye hides it, the email chip", async ({ page }) => {
  await expect(page.locator(".bh-label")).toHaveText("Total balance");
  await expect(page.locator("#totalBalance")).toHaveText("$47.86 USD");
  await expect(page.locator("#totalBalance .cur-code")).toHaveText("USD");
  await expect(page.locator(".bh-sub .badge-pill")).toHaveText("ada@osun.co");
  await page.locator("#eyeBtn").click();
  await expect(page.locator("#totalBalance")).toHaveText("$ ••••");
  await page.locator("#eyeBtn").click();
  await expect(page.locator("#totalBalance")).toHaveText("$47.86 USD");
});

test("actions: Send and Convert open their flows; Deposit isn't ported", async ({ page }) => {
  await expect(body(page).locator(".action-row .action-btn")).toHaveText(["Deposit", "Send", "Convert"]); // Send replaces Transfer and Payout
  await page.locator("#actDeposit").click();
  await expect(page.locator("#toastEl .notice-title")).toHaveText("Not in the prototype yet");
  await expect(page.locator("#toastEl .notice-body")).toHaveText("Use Deposit on the Nigerian Naira balance.");
  await page.locator("#actConvert").click();
  await expect(body(page).locator(".step-title").first()).toHaveText("Convert");
  await page.locator("#backHome").click();
  await page.locator("#actSend").click();
  await expect(body(page).locator(".step-title").first()).toHaveText("Send");
  await expect(page.locator("#sendFrom")).toHaveCount(0); // from the home: no source preselected
});

test("Stablecoins tab: coins by network, sorted by balance, with the day's drift on held coins", async ({ page }) => {
  await expect(page.locator('[data-wallettab="assets"]')).toHaveClass(/\bsel\b/);
  await expect(body(page).locator(".assets-header > span").first()).toHaveText("Stablecoins");
  const rows = body(page).locator('[data-holdtype="crypto"]');
  await expect(rows.locator(".tx-title")).toHaveText(["USD Coin", "USD Coin", "Tether", "Tether"]);
  await expect(rows.locator(".tx-sub")).toHaveText(["0.00 USDC · Base", "0.00 USDC · Polygon", "0.00 USDT · Base", "0.00 USDT · Polygon"]);
  await expect(rows.locator(".tx-amt")).toHaveText(Array(4).fill("$0.00 USD"));
  await expect(rows.locator(".badge-network")).toHaveCount(4);
  await expect(rows.locator(".asset-delta")).toHaveCount(0);

  await setHoldings(page, { coins: { USDC: { Polygon: 0, Base: 0 }, USDT: { Polygon: 2500, Base: 0 } } });
  await expect(rows.first().locator(".tx-sub")).toHaveText("25.00 USDT · Polygon");
  await expect(rows.first().locator(".tx-amt")).toHaveText("$25.00 USD");
  await expect(rows.first().locator(".asset-delta")).toHaveText(/^[+-](\$\d+\.\d{2} USD|<\$0\.01) \([+-]?\d\.\d{2}%\)$/);
  await expect(page.locator("#totalBalance")).toHaveText("$72.86 USD");
});

test("Cash tab: currencies by value with flags; FIAT-ONLY tag and note; merchant-held NGN", async ({ page }) => {
  await cashTab(page);
  const rows = body(page).locator('[data-holdtype="cash"]');
  await expect(rows.locator(".tx-title")).toHaveText(["Nigerian Naira", "US Dollar", "Euro", "British Pound", "Ghanaian Cedi"]);
  await expect(rows.locator(".tx-sub")).toHaveText(["₦50,000.00 NGN", "15.60 USDFIAT-ONLY", "0.00 EUR", "0.00 GBP", "0.00 GHS"]);
  await expect(rows.locator(".tx-amt")).toHaveText(["₦50,000.00 NGN", "$15.60 USD", "€0.00 EUR", "£0.00 GBP", "GH₵0.00 GHS"]);
  await expect(rows.locator(".badge svg")).toHaveCount(5);
  await expect(body(page).locator(".fiat-note")).toHaveText("FIAT-ONLYCash added by card. You can spend it or withdraw it, but it can’t be converted to stablecoin.");
  await body(page).locator("[data-fiatinfo]").click();
  await expect(page.locator("#toastEl .notice-title")).toHaveText("FIAT-ONLY");

  await page.getByLabel("Merchant-held balance").selectOption("yes");
  await expect(rows.locator(".tx-title")).toHaveText(["Nigerian Naira", "US Dollar", "Nigerian Naira", "Euro", "British Pound", "Ghanaian Cedi"]); // $7.74 sorts after $15.60
  await expect(body(page).locator('[data-holdbucket="merchant"] .tx-sub')).toHaveText("₦12,000.00 NGNMERCHANT-HELD");
  await expect(page.locator("#totalBalance")).toHaveText("$55.60 USD"); // merchant-held counts toward the total
});

test("filter hides zero balances; View all lists every balance", async ({ page }) => {
  await cashTab(page);
  const gear = page.locator("#assetSettingsGear");
  await expect(gear).toHaveAttribute("aria-expanded", "false");
  await gear.click();
  await expect(gear).toHaveAttribute("aria-expanded", "true");
  await expect(gear).toHaveClass(/\bon\b/);
  await expect(body(page).locator(".settings-panel")).toHaveText("Hide zero-balance currencies");
  await page.locator("#hideZeroToggle").check();
  await expect(body(page).locator('[data-holdtype="cash"] .tx-title')).toHaveText(["Nigerian Naira", "US Dollar"]);

  await page.locator("#viewAllAssets").click();
  await expect(body(page).locator(".step-title")).toHaveText("Cash");
  await expect(body(page).locator(".step-sub")).toHaveText("All cash balances held in this wallet.");
  await expect(page.locator("#hideZeroToggle2")).toBeChecked(); // the same filter
  await page.locator("#hideZeroToggle2").uncheck();
  await expect(body(page).locator('[data-holdtype="cash"]')).toHaveCount(5);
  await page.locator("#backHome").click();
  await page.locator('[data-wallettab="assets"]').click();
  await page.locator("#viewAllAssets").click();
  await expect(body(page).locator(".step-title")).toHaveText("Stablecoins");
  await expect(body(page).locator(".step-sub")).toHaveText("All stablecoin balances held in this wallet.");
});

test("rows open their balance screens: USD (with account details card and history), a coin, NGN, merchant-held", async ({ page }) => {
  await cashTab(page);
  await page.locator('[data-holdcur="USD"]').click();
  await expect(page.locator("#backFromDetail")).toHaveText("Cash");
  await expect(body(page).locator(".step-sub").first()).toHaveText("US DollarFIAT-ONLY");
  await expect(page.locator("#holdingAmount")).toHaveText("$15.60 USD");
  await expect(body(page).locator(".action-row .action-btn")).toHaveText(["Deposit", "Send", "Convert"]);
  await page.locator("#detailSend").click();
  await expect(page.locator("#sendFrom")).toHaveText("From US DollarFIAT-ONLY"); // this balance is the source
  await page.locator('[data-sendrecipient="bank:r6"]').click();
  await expect(page.locator("#toastEl .notice-body")).toHaveText("Sending from US Dollar isn't ported yet.");
  await page.locator("#backFromSend").click();
  await expect(page.locator("#vaOpen")).toHaveText("Get USD account detailsReceive USD by ACH or wire. Free to receive.›");
  await expect(body(page).locator(".section-card .tx-title")).toHaveText(["Refund · Kola Books", "Sooyah Bistro", "Top-up · Visa ····4242"]);
  await page.locator("#detailConvert").click();
  await expect(page.locator("#cvPickFrom .cv-pick-name")).toHaveText("USDFIAT-ONLY");
  await page.locator("#backHome").click();

  await page.locator('[data-holdcur="EUR"]').click();
  await expect(body(page)).toContainText("No activity yet.");
  await page.locator("#backFromDetail").click();

  await page.locator('[data-holdcur="NGN"][data-holdbucket="open"] .tx-title').click();
  await expect(page.locator("#ngnBalanceAmount")).toHaveText("₦50,000.00 NGN"); // NGN keeps its own screen
  await page.locator("#backFromDetail").click();

  await page.getByLabel("Merchant-held balance").selectOption("yes");
  await page.locator('[data-holdbucket="merchant"]').click();
  await expect(body(page).locator(".step-sub").first()).toHaveText("Nigerian NairaMERCHANT-HELD");
  await expect(page.locator("#vaOpen")).toHaveCount(0);
  await page.locator("#backFromDetail").click();

  await page.locator('[data-wallettab="assets"]').click();
  await page.locator('[data-holdasset="USDC"][data-holdnet="Base"]').click();
  await expect(page.locator("#backFromDetail")).toHaveText("Stablecoins");
  await expect(body(page).locator(".step-sub").first()).toHaveText("USD Coin · Base");
  await expect(page.locator("#holdingAmount")).toHaveText("$0.00 USD");
  await expect(body(page).locator(".action-row .action-btn")).toHaveText(["Send", "Convert"]);
  await page.locator("#detailSend").click();
  await expect(page.locator("#sendFrom")).toHaveText("From USDC on Base");
  await page.locator("#backFromSend").click();
  await expect(body(page)).toContainText("No USDC on Base activity yet.");
});

test("Recent activity: the latest four, newest first; View all opens the Activity tab; a record's detail", async ({ page }) => {
  const recent = page.locator("#recentActivity .tx-row");
  await expect(recent.locator(".tx-title")).toHaveText(["Refund · Kola Books", "Sooyah Bistro", "Top-up · Visa ····4242"]);
  await expect(recent.locator(".tx-amt")).toHaveText(["+$4.50 USD", "-$7.20 USD", "+$50.00 USD"]);

  // A conversion now tops the list
  await page.getByLabel("Tier").selectOption("1");
  await page.locator("#actConvert").click();
  for (const d of "1000000") await page.locator(`[data-cvkey="${d}"]`).click();
  await page.locator("#cvReview").click();
  await page.locator("#cvConfirm").click();
  await page.locator("#cvDone").click();
  await expect(recent.locator(".tx-title")).toHaveText(["Converted NGN to USDC", "Refund · Kola Books", "Sooyah Bistro", "Top-up · Visa ····4242"]);
  await expect(page.locator("#totalBalance")).toHaveText("$47.86 USD"); // ₦10,000.00 → 6.45 USDC, no fee: the same total

  await page.locator("#viewAllTx").click();
  await expect(page.locator("#tabActivity")).toHaveClass(/\bon\b/);
  await expect(body(page).locator(".step-title")).toHaveText("Activity");
  await expect(body(page).locator(".tx-row")).toHaveCount(4);
  await page.locator('[data-txid="t1"]').click();
  const rows = page.locator("#txDetail .info-row");
  await expect(rows.locator("> span:first-child")).toHaveText(["Status", "Date", "Currency", "Merchant", "Context", "Reference"]);
  await expect(rows.locator("> span:last-child")).toContainText(["Completed", /\d{4}/, "USD", "Kola Books", "Checkout", /^TXN-\d{6}/]);
  await expect(rows.filter({ hasText: "Currency" }).locator(".icon-16 svg")).toHaveCount(1); // the flag
  await expect(body(page).locator(".step-title")).toHaveText("$4.50 USD");
  await page.locator("#backFromTxDetail").click();
  await expect(body(page).locator(".step-title")).toHaveText("Activity");
  await page.locator("#tabHome").click();
  await expect(page.locator("#totalBalance")).toBeVisible();
});
