import { test, expect, type Page } from "@playwright/test";

/**
 * Convert (tConvert in reference/poket-unified.html) with the NGN rules, in the wallet demo. Balances, as in the
 * reference's demo: ₦50,000.00 NGN (open), $15.60 USD (all card-funded, FIAT-ONLY), no stablecoins. The wallet demo
 * also holds $50.00 of open USD, so these tests take it out first (referenceBalances).
 * NGN fees are ₦[fee] and left out of the maths, so ₦10,000.00 → 6.45 USDC (10,000 / 1,550).
 */

const title = (page: Page) => page.locator("#panelBody .step-title").first();
const keys = async (page: Page, digits: string) => { for (const d of digits) await page.locator(`[data-cvkey="${d}"]`).click(); };
const state = (page: Page) => page.evaluate(() => {
  const w = window as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const h = w.__holdings.getState(), n = w.__ngn.getState();
  return { ngn: n.ngnBalance as number, merchant: n.ngnMerchantBalance as number, usd: h.cash.USD as number, eur: h.cash.EUR as number, fiat: h.fiatOnly, usdcBase: h.coins.USDC.Base as number };
});
const setHoldings = (page: Page, patch: object) => page.evaluate((p) => (window as any).__holdings.getState().set(p), patch); // eslint-disable-line @typescript-eslint/no-explicit-any
/** The reference's demo balances: all USD card-funded ($15.60 FIAT-ONLY), none open. */
async function referenceBalances(page: Page) {
  await page.waitForFunction(() => "__holdings" in window);
  await setHoldings(page, { cash: { USD: 1560, EUR: 0, GBP: 0, GHS: 0 } });
}

async function open(page: Page, tier?: string) {
  await page.goto("/demo/wallet");
  await referenceBalances(page);
  if (tier) await page.getByLabel("Tier").selectOption(tier);
  await page.locator("#actConvert").click();
  await expect(title(page)).toHaveText("Convert");
}
async function reviewAndConvert(page: Page) {
  await page.locator("#cvReview").click();
  await page.locator("#cvConfirm").click();
}

test("form: defaults, quote line with ₦[fee], minimum, Max, the ₦[limit] cap and over-balance", async ({ page }) => {
  await open(page);
  const body = page.locator("#panelBody");
  await expect(page.locator("#cvPickFrom .cv-pick-name")).toHaveText("NGN");
  await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("USDC (Base)");
  await expect(body.locator(".cv-box-top").first()).toHaveText("FromAvailable ₦50,000.00 NGN Max");
  await expect(body.locator(".cv-box-top").nth(1)).toHaveText("ToArrives ~15 sec");
  await expect(body.locator(".cv-meta")).toHaveText("1 USDC ≈ 1,550.00 NGNFee: ₦[fee]");
  await expect(page.locator("#cvReview")).toBeDisabled();

  await keys(page, "1000000");
  await expect(page.locator("#cvFromAmt")).toHaveText("10,000.00");
  await expect(page.locator("#cvToAmt")).toHaveText("≈ 6.45");
  await expect(page.locator("#cvReview")).toBeEnabled();

  await page.locator('[data-cvkey="back"]').click();
  await expect(page.locator("#cvHint")).toHaveText("Minimum is ₦[minimum]"); // the demo minimum (₦1,550.00) never shows
  await expect(page.locator("#cvReview")).toBeDisabled();

  // ₦[limit] per conversion (demo value ₦40,000.00, never shown)
  await page.locator("#cvMax").click();
  await expect(page.locator("#cvFromAmt")).toHaveText("50,000.00");
  await expect(page.locator("#cvHint")).toHaveText("Over your limit of ₦[limit] per conversion");
  await expect(page.locator("#cvHint")).toHaveClass(/\berr\b/);
  await expect(page.locator("#cvReview")).toBeDisabled();
  for (let i = 0; i < 7; i++) await page.locator('[data-cvkey="back"]').click();
  await keys(page, "4000000");
  await expect(page.locator("#cvHint")).toHaveText(""); // exactly at the limit
  await keys(page, "0");
  await expect(page.locator("#cvHint")).toHaveText("Exceeds available ₦50,000.00 NGN");
});

test("the rate flips direction when tapped; Swap exchanges From and To; stablecoin rows show arrival times", async ({ page }) => {
  await open(page);
  const rate = page.locator(".cv-meta .cv-rate");
  await rate.click();
  await expect(rate).toHaveText("1 NGN ≈ 0.0006452 USDC");
  await rate.click();
  await page.locator("#cvPickTo").click();
  await expect(page.locator('[data-cvopt="coin:USDT:Polygon"] .t2')).toHaveText("Arrives ~2 min");
  await page.locator("#cvPickBack").click();
  await page.locator("#cvFlip").click();
  await expect(page.locator("#cvPickFrom .cv-pick-name")).toHaveText("USDC (Base)");
  await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("NGN");
  await expect(page.locator(".cv-box-top").nth(1)).toHaveText("ToArrives instantly");
});

test("card-funded cash: no target until chosen; naira and stablecoins greyed out with the reason; tag carries over to EUR", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.5; }); // no FX jitter
  await open(page, "1"); // at Tier 0 every conversion steps up first
  await page.locator("#cvPickFrom").click();
  await expect(page.locator("#panelBody [data-cvopt] .t1")).toHaveText(["US DollarFIAT-ONLY", "Nigerian Naira"]);
  await page.locator('[data-cvopt="cash:USD:fiat"]').click();
  await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("Choose a currency");
  await expect(page.locator("#cvPickTo .badge")).toHaveCount(0);
  await expect(page.locator("#cvToAmt")).toHaveText("—");
  await expect(page.locator(".cv-meta")).toHaveCount(0);
  await expect(page.locator("#cvHint")).toHaveText("");
  await page.locator("#cvMax").click();
  await expect(page.locator("#cvReview")).toBeDisabled();
  await expect(page.locator("#cvFlip")).toBeDisabled(); // nothing to swap with yet

  await page.locator("#cvPickTo").click();
  await expect(page.locator("#panelBody .select-row.sel")).toHaveCount(0);
  const ngn = page.locator('[data-cvopt="cash:NGN:open"]');
  await expect(ngn.locator(".t2")).toHaveText("Card-funded money can't be converted to naira");
  await expect(ngn).toHaveClass(/\bcv-disabled\b/);
  await ngn.click();
  await expect(page.locator("#toastEl .notice-title")).toHaveText("Card-funded money can't be converted to naira");
  await expect(page.locator("#toastEl .notice-body")).toHaveText("Choose another currency.");
  await expect(title(page)).toHaveText("Convert to");
  await expect(page.locator('[data-cvopt="coin:USDC:Base"] .t2')).toHaveText("Card-funded cash can't convert to stablecoins");
  await expect(page.locator('[data-cvopt="cash:GBP:open"] .t2')).toHaveText("Balance £0.00 GBP");
  await page.locator('[data-cvopt="cash:EUR:open"]').click();
  await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("EUR");
  await expect(page.locator("#cvFlip")).toBeEnabled();
  await expect(page.locator(".cv-meta")).toHaveText("1 EUR ≈ 1.08 USDExchange fee (1%): $0.16 USD"); // not naira: the reference's fee
  await reviewAndConvert(page);
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("Added to your Euro balance");
  const s = await state(page);
  expect(s).toMatchObject({ usd: 0, eur: 1430, ngn: 5000000 });
  expect(s.fiat).toMatchObject({ USD: 0, EUR: 1430 });
});

test("opening with NGN as the target and nothing to convert from: NGN stays, with Deposit", async ({ page }) => {
  await page.goto("/demo/wallet?ngn=deposit-method");
  await referenceBalances(page);
  await page.locator("#dmConvert").click();
  await expect(title(page)).toHaveText("Convert");
  await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("NGN");
  await expect(page.locator("#cvEmpty")).toHaveText("You have no USD or USDC to convert yet");
  await expect(page.locator("#cvEmptyDeposit")).toHaveText("Deposit");
  await page.locator("#cvEmptyDeposit").click();
  await expect(page.locator("#toastEl .notice-title")).toHaveText("Not in the prototype yet");
  await expect(page.locator("#toastEl .notice-body")).toHaveText("USD and USDC deposits aren't ported yet.");
  await expect(page.locator("#cvEmpty")).toBeVisible(); // still on the empty state
  await expect(page.locator("#cvPickFrom")).toHaveCount(0);
  await page.locator("#backHome").click();
  await expect(page.locator("#actConvert")).toBeVisible();

  // With open (not card-funded) USD, it converts from USD into NGN
  await setHoldings(page, { fiatOnly: { USD: 0, NGN: 0, EUR: 0, GBP: 0, GHS: 0 } });
  await page.locator('[data-wallettab="cash"]').click(); // NGN is under the Cash tab
  await page.locator('[data-holdcur="NGN"][data-holdbucket="open"] .tx-title').click();
  await page.locator("#detailDeposit").click();
  await page.locator("#dmConvert").click();
  await expect(page.locator("#cvPickFrom .cv-pick-name")).toHaveText("USD");
  await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("NGN");
});

test("quote card: rate, ₦[fee], You get, 30-second countdown, Refresh rate on expiry", async ({ page }) => {
  await page.clock.install();
  await open(page);
  await keys(page, "1000000");
  await page.locator("#cvReview").click();
  const card = page.locator("#cvQuoteCard");
  await expect(card.locator(".r-label")).toHaveText(["You convert", "Rate", "Fee", "Network", "You get"]);
  await expect(card.locator(".r-value")).toHaveText(["₦10,000.00 NGN", "1 USDC ≈ 1,550.00 NGN", "₦[fee]", "Base · ~15 sec", "6.45 USDC"]);
  await expect(page.locator("#cvTimerLeft")).toHaveText("0:30");
  await page.clock.runFor(1000);
  await expect(page.locator("#cvTimerLeft")).toHaveText("0:29");
  await page.clock.fastForward("00:30");
  await expect(page.locator("#cvTimer")).toHaveText("Rate expired. Refresh to get a new rate.");
  await expect(page.locator("#cvConfirm")).toHaveCount(0);
  await page.locator("#cvRefresh").click();
  await page.clock.runFor(500);
  await expect(page.locator("#cvTimerLeft")).toHaveText("0:30");
});

test("quote card from a coin: the fee is the coin equivalent, [fee] USDC", async ({ page }) => {
  await open(page, "1");
  await setHoldings(page, { coins: { USDC: { Polygon: 0, Base: 1000 }, USDT: { Polygon: 0, Base: 0 } } });
  await page.evaluate(() => (window as any).__convert.getState().start({ from: "coin:USDC:Base", to: "cash:NGN:open" })); // eslint-disable-line @typescript-eslint/no-explicit-any
  await page.locator("#cvMax").click();
  await expect(page.locator(".cv-meta > span")).toHaveText("Fee: [fee] USDC");
  await page.locator("#cvReview").click();
  await expect(page.locator("#cvQuoteCard .r-value")).toHaveText(["10.00 USDC", "1 USDC ≈ 1,550.00 NGN", "[fee] USDC", "₦15,500.00 NGN"]);
  await page.locator("#cvConfirm").click();
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("Added to your Nigerian Naira balance");
  expect(await state(page)).toMatchObject({ ngn: 5000000 + 1550000, usdcBase: 0 });
});

test("NGN to stablecoins blocked (demo): USD by default; choosing USDC or USDT explains and offers USD", async ({ page }) => {
  await page.goto("/demo/wallet");
  await referenceBalances(page);
  await page.getByLabel("NGN to stablecoins").selectOption("blocked");
  await page.locator("#actConvert").click();
  await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("USD");
  const msg = "Converting naira to stablecoins isn't available yet. You can convert to USD.";
  for (const coin of ["coin:USDC:Base", "coin:USDT:Polygon"]) {
    await page.locator("#cvPickTo").click();
    await page.locator(`[data-cvopt="${coin}"]`).click();
    await expect(page.locator("#cvCoinsBlocked")).toContainText(msg);
    await keys(page, "1000000");
    await expect(page.locator("#cvReview")).toBeDisabled();
    await page.locator("#cvUseUsd").click();
    await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("USD");
    await expect(page.locator("#cvCoinsBlocked")).toHaveCount(0);
    await expect(page.locator("#cvReview")).toBeEnabled();
    for (let i = 0; i < 7; i++) await page.locator('[data-cvkey="back"]').click();
  }
  // Allowed again: stablecoins are fine
  await page.getByLabel("NGN to stablecoins").selectOption("allowed");
  await page.locator("#cvPickTo").click();
  await page.locator('[data-cvopt="coin:USDT:Base"]').click();
  await expect(page.locator("#cvCoinsBlocked")).toHaveCount(0);
});

test("limit and tier check: Tier 0 steps up before converting; Cancel returns to review; Continue converts", async ({ page }) => {
  await open(page); // Tier 0
  await keys(page, "1000000");
  await reviewAndConvert(page);
  await expect(title(page)).toHaveText("Additional verification needed");
  await expect(page.locator("#panelBody .alert.warn")).toHaveText("This is above what Tier 0: Registered allows (up to ₦[limit] per transaction). A quick additional step is needed to continue.");
  await expect(page.locator("#panelBody .step-sub")).toHaveText("To reach Tier 1: Basic, you'll need to provide:");
  expect(await state(page)).toMatchObject({ ngn: 5000000, usdcBase: 0 });
  await page.locator("#stepupCancel").click();
  await expect(page.locator("#cvQuoteCard")).toBeVisible();
  await page.locator("#cvConfirm").click();
  await page.locator("#stepupIntroContinue").click();
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("Added to your USDC on Base balance");
  expect(await state(page)).toMatchObject({ ngn: 4000000, usdcBase: 645 });
});

test("limit and tier check: over Tier 1's $2,000 steps up to Tier 2; over Tier 3 is blocked", async ({ page }) => {
  await open(page, "1");
  await setHoldings(page, { cash: { USD: 6000000, EUR: 0, GBP: 0, GHS: 0 }, fiatOnly: { USD: 0, NGN: 0, EUR: 0, GBP: 0, GHS: 0 } });
  await page.evaluate(() => (window as any).__convert.getState().start({ from: "cash:USD:open", to: "coin:USDC:Base" })); // eslint-disable-line @typescript-eslint/no-explicit-any
  await keys(page, "300000"); // $3,000.00
  await reviewAndConvert(page);
  await expect(page.locator("#panelBody .alert.warn")).toHaveText("This is above what Tier 1: Basic allows (up to $2,000.00 USD per transaction). A quick additional step is needed to continue.");
  await expect(page.locator("#panelBody .alert.warn .cur-code")).toHaveText("USD"); // the code is grey
  await expect(page.locator("#panelBody .step-sub")).toHaveText("To reach Tier 2: Standard, you'll need to provide:");
  await page.locator("#stepupCancel").click();
  await page.locator("#cvBackToForm").click();
  await page.locator("#cvMax").click(); // $60,000.00
  await reviewAndConvert(page);
  await expect(title(page)).toHaveText("This exceeds Poket's limits");
  await expect(page.locator("#panelBody .step-sub")).toHaveText("$60,000.00 USD is more than Poket allows per transaction, even at Tier 3: Enhanced. Try a smaller amount.");
  await page.locator("#limitBlockedClose").click();
  await expect(page.locator("#actConvert")).toBeVisible();
});

test("merchant-held naira converts to USD or USDC; the merchant-held Convert button opens it as the source", async ({ page }) => {
  await page.goto("/demo/wallet");
  await referenceBalances(page);
  await page.getByLabel("Tier").selectOption("1");
  await page.getByLabel("Merchant-held balance").selectOption("yes");
  await page.locator('[data-wallettab="cash"]').click(); // NGN is under the Cash tab
  await page.locator('#panelBody [data-holdbucket="merchant"]').click();
  await page.locator("#detailSend").click();
  await page.locator('[data-sendrecipient="bank:r6"]').click(); // a bank: the "not available" screen
  await page.locator("#withdrawUseConvert").click();
  await expect(title(page)).toHaveText("Convert");
  await expect(page.locator("#cvPickFrom .cv-pick-name")).toHaveText("NGNMERCHANT-HELD");
  await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("USDC (Base)");
  await expect(page.locator(".cv-box-top").first()).toHaveText("FromAvailable ₦12,000.00 NGN Max");

  await page.locator("#cvPickFrom").click();
  await expect(page.locator("#panelBody [data-cvopt] .t1")).toHaveText(["US DollarFIAT-ONLY", "Nigerian Naira", "Nigerian NairaMERCHANT-HELD"]);
  await page.locator("#cvPickBack").click();
  await page.locator("#cvPickTo").click();
  const eur = page.locator('[data-cvopt="cash:EUR:open"]');
  await expect(eur.locator(".t2")).toHaveText("Merchant-held naira converts only to USD or USDC");
  await expect(eur).toHaveClass(/\bcv-disabled\b/);
  await expect(page.locator('[data-cvopt="coin:USDT:Base"]')).toHaveClass(/\bcv-disabled\b/);
  await expect(page.locator('[data-cvopt="cash:USD:open"]')).not.toHaveClass(/\bcv-disabled\b/);
  await page.locator("#cvPickBack").click();

  await keys(page, "1000000");
  await reviewAndConvert(page);
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("Added to your USDC on Base balance");
  expect(await state(page)).toMatchObject({ merchant: 200000, ngn: 5000000, usdcBase: 645 });
});

test("conversions in the NGN balance history; View transaction opens the receipt", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page, "1");
  await keys(page, "1000000");
  await reviewAndConvert(page);
  await page.locator("#cvViewTx").click();
  const body = page.locator("#panelBody");
  await expect(title(page)).toHaveText("6.45 USDC");
  await expect(body.locator(".step-sub")).toHaveText("Converted NGN to USDC");
  // The reference's transaction detail: an icon before each label, monospace right-aligned values
  const rows = body.locator("#cvReceipt .info-row");
  await expect(rows.locator("> span:first-child")).toHaveText(["Status", "Date", "From", "To", "Rate", "Fee", "Reference"]);
  await expect(rows.locator(".detail-ic")).toHaveCount(7);
  await expect(rows.locator("> span:last-child")).toContainText(["Completed", /^\d{2} [A-Z][a-z]{2}, \d{4}, \d{1,2}:\d{2} [AP]M/, "₦10,000.00 NGN", "6.45 USDC on Base", "1 USDC ≈ 1,550.00 NGN", "₦[fee]", /^TXN-\d{6}\s*$/]);
  const status = rows.filter({ hasText: "Completed" }).locator("> span:last-child");
  await expect(status).toHaveClass(/\bmono\b/);
  await expect(status).toHaveCSS("text-align", "right");
  await expect(status).toHaveCSS("color", "rgb(13, 145, 71)"); // --ok-600
  await expect(status).toHaveCSS("font-weight", "600");
  await expect(rows.filter({ hasText: "Date" }).locator("em")).toHaveCount(1); // the part after " - " in italics
  // The Reference chip copies
  const chip = page.locator("#copyRefBtn");
  const ref = (await chip.textContent())!.trim();
  await chip.click();
  await expect(page.locator("#toastEl")).toHaveText("Reference copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ref);
  await page.locator("#backFromTxDetail").click();

  await page.locator('[data-wallettab="cash"]').click(); // NGN is under the Cash tab
  await page.locator('[data-holdcur="NGN"][data-holdbucket="open"] .tx-title').click();
  const row = page.locator("#panelBody .section-card .tx-row");
  await expect(row.locator(".tx-title")).toHaveText(["Converted NGN to USDC"]);
  await expect(row.locator(".tx-sub")).toHaveText(["₦10,000.00 NGN → 6.45 USDC"]);
  await expect(row.locator(".tx-amt")).toHaveText(["+6.45 USDC"]);
  await row.click();
  await expect(body.locator("#cvReceipt")).toBeVisible();
});
