import { test, expect, type Page } from "@playwright/test";

/**
 * Convert (tConvert in reference/poket-unified.html) in the wallet demo. Balances, as in the reference's demo:
 * ₦50,000.00 NGN (open), $15.60 USD (all card-funded, FIAT-ONLY), no stablecoins. So Convert opens as NGN → USDC (Base).
 */

const title = (page: Page) => page.locator("#panelBody .step-title").first();
const keys = async (page: Page, digits: string) => { for (const d of digits) await page.locator(`[data-cvkey="${d}"]`).click(); };
const state = (page: Page) => page.evaluate(() => {
  const w = window as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const h = w.__holdings.getState();
  return { ngn: w.__ngn.getState().ngnBalance as number, usd: h.cash.USD as number, fiat: h.fiatOnly, usdcBase: h.coins.USDC.Base as number };
});

async function open(page: Page) {
  await page.goto("/demo/wallet");
  await page.locator("#actConvert").click();
  await expect(title(page)).toHaveText("Convert");
}

test("form: defaults, keypad, quote line, minimum, Max and over-balance", async ({ page }) => {
  await open(page);
  const body = page.locator("#panelBody");
  await expect(body.locator(".step-sub")).toHaveText("Move money between your currencies and stablecoins.");
  await expect(page.locator("#cvPickFrom .cv-pick-name")).toHaveText("NGN");
  await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("USDC (Base)");
  await page.locator("#cvPickTo").click(); // a stablecoin's row shows its network's arrival time
  await expect(page.locator('[data-cvopt="coin:USDT:Polygon"] .t2')).toHaveText("Arrives ~2 min");
  await page.locator("#cvPickBack").click();
  await expect(body.locator(".cv-box-top").first()).toHaveText("FromAvailable ₦50,000.00 NGN Max");
  await expect(body.locator(".cv-box-top").nth(1)).toHaveText("ToArrives ~15 sec");
  await expect(page.locator("#cvFromAmt")).toHaveText("0.00");
  await expect(page.locator("#cvToAmt")).toHaveText("≈ 0.00");
  await expect(body.locator(".cv-meta")).toHaveText("1 USDC ≈ 1,550.00 NGNProcessing fee (0.5%): ₦0.00 NGN");
  await expect(page.locator("#cvReview")).toBeDisabled();

  await keys(page, "10000005");
  await page.locator('[data-cvkey="back"]').click();
  await expect(page.locator("#cvFromAmt")).toHaveText("10,000.00");
  await expect(page.locator("#cvToAmt")).toHaveText("≈ 6.42");
  await expect(body.locator(".cv-meta > span")).toHaveText("Processing fee (0.5%): ₦50.00 NGN");
  await expect(page.locator("#cvReview")).toBeEnabled();

  // Below the $1.00 minimum
  await page.locator(`[data-cvkey="back"]`).click();
  await expect(page.locator("#cvFromAmt")).toHaveText("1,000.00");
  await expect(page.locator("#cvHint")).toHaveText("Minimum is ₦1,550.00 NGN");
  await expect(page.locator("#cvHint")).toHaveClass(/\berr\b/);
  await expect(page.locator("#cvReview")).toBeDisabled();

  await page.locator("#cvMax").click();
  await expect(page.locator("#cvFromAmt")).toHaveText("50,000.00");
  await expect(page.locator("#cvHint")).toHaveText("");
  await keys(page, "0");
  await expect(page.locator("#cvFromAmt")).toHaveClass(/\berr\b/);
  await expect(page.locator("#cvHint")).toHaveText("Exceeds available ₦50,000.00 NGN");
  await expect(page.locator("#cvReview")).toBeDisabled();
});

test("the rate flips direction when tapped; Swap exchanges From and To", async ({ page }) => {
  await open(page);
  const rate = page.locator(".cv-meta .cv-rate");
  await rate.click();
  await expect(rate).toHaveText("1 NGN ≈ 0.0006452 USDC");
  await rate.click();
  await expect(rate).toHaveText("1 USDC ≈ 1,550.00 NGN");

  await page.locator("#cvFlip").click();
  await expect(page.locator("#cvPickFrom .cv-pick-name")).toHaveText("USDC (Base)");
  await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("NGN");
  await expect(page.locator(".cv-box-top").first()).toHaveText("FromAvailable 0.00 USDC Max");
  await expect(page.locator(".cv-box-top").nth(1)).toHaveText("ToArrives instantly");
});

test("pickers: From lists balances you hold; To explains rows you can't choose; search", async ({ page }) => {
  await open(page);
  await page.locator("#cvPickFrom").click();
  await expect(title(page)).toHaveText("Convert from");
  await expect(page.locator("#panelBody .cv-group")).toHaveText(["Cash"]); // no stablecoin balances
  const rows = page.locator("#panelBody [data-cvopt]");
  await expect(rows.locator(".t1")).toHaveText(["US DollarFIAT-ONLY", "Nigerian Naira"]);
  await expect(rows.locator(".t2")).toHaveText(["Available $15.60 USD", "Available ₦50,000.00 NGN"]);
  await expect(page.locator('[data-cvopt="cash:NGN:open"]')).toHaveClass(/\bsel\b/);

  // Card-funded USD can't become a stablecoin, so To moves to NGN
  await page.locator('[data-cvopt="cash:USD:fiat"]').click();
  await expect(page.locator("#cvPickFrom .cv-pick-name")).toHaveText("USDFIAT-ONLY");
  await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("NGN");

  await page.locator("#cvPickTo").click();
  await expect(title(page)).toHaveText("Convert to");
  await expect(page.locator("#panelBody .cv-group")).toHaveText(["Cash", "Stablecoins"]);
  const usd = page.locator('[data-cvopt="cash:USD:open"]');
  await expect(usd.locator(".t2")).toHaveText("Same as the balance you convert from");
  await expect(usd).toHaveClass(/\bcv-disabled\b/);
  await usd.click();
  await expect(title(page)).toHaveText("Convert to"); // can't choose it
  const coin = page.locator('[data-cvopt="coin:USDC:Base"]');
  await expect(coin.locator(".t2")).toHaveText("Card-funded cash can't convert to stablecoins");
  await coin.click();
  await expect(page.locator("#toastEl .notice-title")).toHaveText("Card-funded cash can't convert to stablecoins");
  await expect(page.locator("#toastEl .notice-body")).toHaveText("Choose cash, or convert from a balance without the FIAT-ONLY tag.");
  await expect(page.locator('[data-cvopt="cash:EUR:open"] .t2')).toHaveText("Balance €0.00 EUR");
  await expect(page.locator('[data-cvopt="coin:USDT:Polygon"] .t2')).toHaveText("Card-funded cash can't convert to stablecoins"); // every stablecoin

  await page.locator("#cvSearch").fill("eur");
  await expect(page.locator("#panelBody [data-cvopt] .t1")).toHaveText(["Euro"]);
  await page.locator("#cvSearch").fill("zzz");
  await expect(page.locator("#panelBody")).toContainText('No matches for "zzz".');
  await page.locator("#cvSearch").fill("cedi");
  await page.locator('[data-cvopt="cash:GHS:open"]').click();
  await expect(page.locator("#cvPickTo .cv-pick-name")).toHaveText("GHS");
  await page.locator("#cvPickTo").click();
  await page.locator("#cvPickBack").click();
  await expect(title(page)).toHaveText("Convert");
});

test("NGN → USDC: review, convert, done; balances move", async ({ page }) => {
  await open(page);
  await keys(page, "1000000");
  await page.locator("#cvReview").click();
  const body = page.locator("#panelBody");
  await expect(title(page)).toHaveText("6.42 USDC");
  await expect(body.locator(".step-sub").first()).toHaveText("You'll receive in USDC · Base");
  await expect(body.locator(".receipt-row .r-label")).toHaveText(["You convert", "Rate", "Processing fee (0.5%)", "Network", "You'll receive"]);
  await expect(body.locator(".receipt-row .r-value")).toHaveText(["₦10,000.00 NGN", "1 USDC ≈ 1,550.00 NGN", "₦50.00 NGN", "Base · ~15 sec", "6.42 USDC"]);
  await expect(page.locator("#cvTimer")).toHaveText(/^Rate held for 0:(30|29)$/);
  await page.locator("#cvConfirm").click();
  await expect(title(page)).toHaveText("Converting…");
  await expect(body.locator(".step-sub")).toHaveText("₦10,000.00 NGN to USDC");

  await expect(title(page)).toHaveText("6.42 USDC");
  await expect(body.locator(".step-sub")).toHaveText("Added to your USDC on Base balance");
  await expect(body.locator(".receipt-row .r-label")).toHaveText(["Converted", "Rate", "Processing fee (0.5%)", "Confirmation"]);
  await expect(body.locator(".receipt-row .r-value").last()).toHaveText(/^TXN-\d{6}$/);
  expect(await state(page)).toMatchObject({ ngn: 4000000, usdcBase: 642, usd: 1560 });
  await page.locator("#cvDone").click();
  await expect(page.locator('#panelBody [data-holdbucket="open"] .tx-amt')).toHaveText("₦40,000.00 NGN");
});

test("card-funded USD → NGN (FX): the FIAT-ONLY tag carries over", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.5; }); // no FX jitter: the rate is exactly 1,550
  await open(page);
  await page.locator("#cvPickFrom").click();
  await page.locator('[data-cvopt="cash:USD:fiat"]').click();
  await page.locator("#cvMax").click();
  await expect(page.locator("#cvFromAmt")).toHaveText("15.60");
  await expect(page.locator(".cv-meta")).toHaveText("1 USD ≈ 1,550.00 NGNExchange fee (1%): $0.16 USD");
  await expect(page.locator("#cvToAmt")).toHaveText("≈ 23,932.00");
  await page.locator("#cvReview").click();
  await expect(page.locator("#panelBody")).toContainText("These funds stay card-funded (FIAT-ONLY) after conversion.");
  await page.locator("#cvConfirm").click();
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("Added to your Nigerian Naira balance");
  const s = await state(page);
  expect(s).toMatchObject({ ngn: 5000000 + 2393200, usd: 0 });
  expect(s.fiat).toMatchObject({ USD: 0, NGN: 2393200 });
});

test("the rate holds 30 seconds, then must be refreshed", async ({ page }) => {
  await page.clock.install();
  await open(page);
  await keys(page, "1000000");
  await page.locator("#cvReview").click();
  await expect(page.locator("#cvTimerLeft")).toHaveText("0:30");
  await page.clock.runFor(1000);
  await expect(page.locator("#cvTimerLeft")).toHaveText("0:29");
  await page.clock.fastForward("00:30");
  await expect(page.locator("#cvTimer")).toHaveText("Rate expired. Refresh to get a new rate.");
  await expect(page.locator("#cvTimer")).toHaveClass(/\bexpired\b/);
  await expect(page.locator("#cvConfirm")).toHaveCount(0);
  await page.locator("#cvRefresh").click();
  await page.clock.runFor(500);
  await expect(page.locator("#cvTimerLeft")).toHaveText("0:30");
  await expect(page.locator("#cvConfirm")).toBeVisible();
  await page.locator("#cvBackToForm").click();
  await expect(page.locator("#cvFromAmt")).toHaveText("10,000.00");
});

test("entry points: Deposit NGN's Convert and the NGN balance's Convert; Back returns to the wallet", async ({ page }) => {
  await page.goto("/demo/wallet?ngn=deposit-method");
  await page.locator("#dmConvert").click();
  await expect(title(page)).toHaveText("Convert");
  await page.locator("#backHome").click();
  await expect(page.locator("#actConvert")).toBeVisible(); // the NGN flow is closed too

  await page.locator('[data-holdbucket="open"] .tx-title').click();
  await page.locator("#detailConvert").click();
  await expect(page.locator("#cvPickFrom .cv-pick-name")).toHaveText("NGN");
  await page.locator("#backHome").click();
  await expect(page.locator("#actConvert")).toBeVisible();
});
