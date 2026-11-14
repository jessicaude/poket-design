import { test, expect, type Page } from "@playwright/test";

/**
 * Deposit (reference/poket-unified.html: tCardFund 'select', tDepositMethod, tVa, tCardFund, tAddMoney) for
 * everything but NGN, which keeps its own flow: choose a currency or a stablecoin; bank transfer to the currency's
 * account details (the deposit fee, 0.40% capped, out of what arrives), card (the card fee on top, FIAT-ONLY), or a
 * stablecoin's deposit address on its network.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
async function wallet(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
}
const body = (page: Page) => page.locator("#panelBody");
const title = (page: Page) => body(page).locator(".step-title").first();
const holdings = (page: Page) => page.evaluate(() => { const s = (window as any).__holdings.getState(); return { cash: s.cash, fiat: s.fiatOnly, coins: s.coins }; });
const row = (page: Page, sel: string, label: string) => page.locator(`${sel} .receipt-row`).filter({ hasText: label }).locator(".r-value");

test("Deposit from the home: every currency and every stablecoin on every network, with search; NGN keeps its flow", async ({ page }) => {
  await wallet(page);
  await page.locator("#actDeposit").click();
  await expect(title(page)).toHaveText("Deposit");
  await expect(body(page).locator("> .screen-fade > .step-sub")).toHaveCount(0); // the title says it
  await expect(page.locator("[data-depositcash] .t1")).toHaveText(["US Dollar", "Nigerian Naira", "Euro", "British Pound", "Ghanaian Cedi"]);
  await expect(page.locator("[data-depositasset] .t1")).toHaveText(["USDC on Polygon", "USDC on Base", "USDT on Polygon", "USDT on Base"]);
  await expect(page.locator("[data-depositasset] .t2").first()).toHaveText("Deposit address");
  await expect(page.locator('[data-depositcash="USD"]')).toHaveClass(/\bsel\b/); // USD to start
  await page.locator("#depositSearch").fill("base");
  await expect(page.locator("[data-depositcash]")).toHaveCount(0);
  await expect(page.locator("[data-depositasset] .t1")).toHaveText(["USDC on Base", "USDT on Base"]);
  await page.locator("#depositSearch").fill("zzz");
  await expect(body(page)).toContainText("No matches for “zzz”.");
  await page.locator("#depositSearch").fill("naira");
  await page.locator('[data-depositcash="NGN"]').click();
  await page.locator("#depositSelectContinue").click();
  // NGN: its own methods (bank transfer, Convert)
  await expect(title(page)).toHaveText("Deposit NGN");
  await expect(page.locator("#dmConvert")).toBeVisible();
});

test("USD by bank transfer: verify first, the intro with the deposit fee, set-up, then details; a transfer arrives less the fee", async ({ page }) => {
  await wallet(page);
  await page.locator("#actDeposit").click();
  await page.locator("#depositSelectContinue").click();
  await expect(title(page)).toHaveText("Deposit USD");
  await expect(page.locator("#dmBank .t2")).toHaveText("Get your own USD account details. 0.40% fee, up to $4.00.");
  await expect(page.locator("#dmCard .t2")).toHaveText("Instant. Card fees may apply.");
  await expect(body(page)).toContainText("Card deposits can’t be converted to stablecoins. Bank transfers can.");
  await page.locator("#dmBank").click();
  // Tier 0: verify first
  await expect(title(page)).toHaveText("Verify your identity first");
  await page.locator("#vaVerify").click();
  await expect(page.locator("#stepupWarning")).toHaveText("Account details are in your verified name.");
  await page.locator("#stepupIntroContinue").click();
  await expect(title(page)).toHaveText("Get USD account details");
  await expect(page.locator("#vaIntroRows .r-label")).toHaveText(["Name on account", "Receive by", "Arrives", "Fees"]);
  await expect(page.locator("#vaIntroRows .r-value")).toHaveText(["Ada Osun", "ACH or wire", "ACH 1-3 business days", "0.40% fee, up to $4.00"]);
  await expect(page.locator("#vaCreate")).toBeDisabled();
  await page.locator("#vaAgree").check();
  await page.locator("#vaCreate").click();
  await expect(title(page)).toHaveText("Creating your USD account");
  // USD isn't instant: the partner bank reviews it
  await expect(title(page)).toHaveText("We’re setting up your USD account");
  await expect(page.locator("#demoVaTransfer")).toHaveCount(0);
  await page.locator("#demoVaApprove").click();
  await expect(title(page)).toHaveText("USD account details");
  await expect(page.locator("#vaDetails .va-k")).toHaveText(["Account name", "Account number", "Routing number (ACH)", "Routing number (wire)", "Bank", "Account type"]);
  await expect(page.locator("#vaDetails [data-vacopy]")).toHaveCount(5); // not the account type
  await page.locator('[data-vacopy="1"]').click();
  await expect(page.locator('[data-vacopy="1"]')).toHaveText("Copied");
  await expect(page.locator("#vaNote")).toHaveText("Anyone can send to these details. Money you receive can be converted to stablecoins. 0.40% fee, up to $4.00, out of what arrives.");
  // $500.00 arrives: the $2.00 fee comes out of it
  await page.locator("#demoVaTransfer").click();
  expect((await holdings(page)).cash.USD).toBe(6560 + 50000 - 200);
  const ledger = await page.evaluate(() => (window as any).__ledger.getState().entries.filter((e: any) => e.currency === "USD").map((e: any) => [e.description, e.delta]));
  expect(ledger).toEqual([["Bank transfer from Ada Osun", 50000], ["Fee · Bank transfer from Ada Osun", -200]]);
  // Back to the balance: the account card is ready; the transfer is in its history
  await page.locator("#vaBack").click();
  await page.locator("#backToDepositSelect").click();
  await page.locator("#backHome").click();
  await page.locator('[data-holdcur="USD"][data-holdbucket="open"] .tx-title').click();
  await expect(page.locator("#vaOpen .va-status")).toHaveText("Ready");
  await expect(page.locator("#vaOpen .t2")).toHaveText(/^Account number ••\d{4} · Lead Bank$/);
  const dep = page.locator("#balanceHistory [data-deposit]");
  await expect(dep.locator(".tx-title")).toHaveText("Bank transfer from Ada Osun");
  await expect(dep.locator(".tx-sub")).toHaveText("ACH");
  await expect(dep.locator(".tx-amt")).toHaveText("+$498.00 USD");
  await dep.click();
  const rows = page.locator("#txDetail .info-row");
  await expect(rows.filter({ hasText: "Amount sent" })).toContainText("$500.00");
  await expect(rows.filter({ hasText: "Deposit fee" })).toContainText("$2.00");
  await expect(rows.filter({ hasText: "Added" })).toContainText("$498.00");
  // The notification: what was added, from whom
  await page.locator("#openNotifHeader").click();
  await expect(page.locator("#panelBody [data-notif] .settings-row-title > span:first-child").first()).toHaveText("Transfer received");
  await expect(page.locator("#panelBody .settings-row-sub").first()).toHaveText("$498.00 from Ada Osun added to your USD balance.");
});

test("EUR and GHS account details are ready at once; the account card opens them", async ({ page }) => {
  await wallet(page);
  await page.getByLabel("Tier").selectOption("1");
  for (const [cur, fee, first] of [["EUR", "0.40% fee, up to €3.70", "IBAN"], ["GHS", "0.40% fee, up to GH₵62.00", "Account number"]]) {
    await page.locator(`[data-holdcur="${cur}"][data-holdbucket="open"] .tx-title`).click();
    await page.locator("#vaOpen").click();
    await expect(page.locator("#vaFee")).toHaveText(fee);
    await page.locator("#vaAgree").check();
    await page.locator("#vaCreate").click();
    await expect(title(page)).toHaveText(`${cur} account details`);
    await expect(page.locator("#vaDetails .va-k").nth(1)).toHaveText(first);
    // Back from where it opened: the balance
    await page.locator("#vaBack").click();
    await expect(page.locator("#vaOpen .va-status")).toHaveText("Ready");
    await page.locator("#backFromDetail").click();
  }
  // €300.00 arrives: 0.40% is €1.20, under the cap
  await page.locator('[data-holdcur="EUR"][data-holdbucket="open"] .tx-title').click();
  await page.locator("#vaOpen").click();
  await page.locator("#demoVaTransfer").click();
  expect((await holdings(page)).cash.EUR).toBe(30000 - 120);
});

test("USD by card: the amount, the card fee on top, a saved card, the passcode, the step-up; added as card money", async ({ page }) => {
  await wallet(page);
  await page.locator('[data-holdcur="USD"][data-holdbucket="open"] .tx-title').click();
  await page.locator("#detailDeposit").click(); // from the balance: straight to its methods
  await expect(title(page)).toHaveText("Deposit USD");
  await page.locator("#dmCard").click();
  await expect(title(page)).toHaveText("Add USD");
  await expect(body(page)).toContainText("Tap the amount to enter how much to add.");
  await page.locator("#amountTapTarget").click();
  await expect(page.locator("#cardFundAmtContinue")).toBeDisabled();
  for (const k of "2500") await page.locator(`[data-key="${k}"]`).click();
  await expect(page.locator("#cardFundFeeCard .info-row")).toHaveText([
    "Amount$25.00 USD", "Card funding fee (2.9% + $0.30)$1.03 USD", "Total charged$26.03 USD",
  ]);
  await page.locator("#cardFundAmtContinue").click();
  await expect(title(page)).toHaveText("Pay with");
  await expect(body(page).locator(".step-sub").first()).toHaveText("$26.03 USD will be charged to this card.");
  await expect(page.locator("[data-cardpick] .t1")).toHaveText(["Personal Visa", "Work Mastercard"]);
  await expect(page.locator("#cardPickContinue")).toBeDisabled();
  await page.locator('[data-cardpick="card1"]').click();
  await page.locator("#cardPickContinue").click();
  await expect(title(page)).toHaveText("Enter passcode");
  await expect(page.locator("#verify3ds")).toBeDisabled();
  for (let i = 0; i < 6; i++) await page.locator("#threeDsRow .otp-box").nth(i).fill(String(i + 1));
  await page.locator("#verify3ds").click();
  // Tier 0: over the limit, so the step-up first
  await expect(page.locator("#stepupWarning")).toBeVisible();
  await page.locator("#stepupIntroContinue").click();
  await expect(title(page)).toHaveText("Authorizing payment");
  await expect(page.locator("#depositDoneAmount")).toHaveText("$25.00 USD");
  await expect(body(page)).toContainText("Added to your USD balance");
  await expect(page.locator("#cardFundDoneCard .r-label")).toHaveText(["Card", "Card fee", "Reference", "Total charged"]);
  await expect(row(page, "#cardFundDoneCard", "Card fee")).toHaveText("$1.03 USD");
  await expect(row(page, "#cardFundDoneCard", "Total charged")).toHaveText("$26.03 USD");
  await expect(row(page, "#cardFundDoneCard", "Reference")).toHaveText(/^TXN-\d{6}$/);
  await expect(body(page)).toContainText("This will appear on your bank statement as POKET.");
  const h = await holdings(page);
  expect([h.cash.USD, h.fiat.USD]).toEqual([6560 + 2500, 1560 + 2500]); // FIAT-ONLY: card money
  await page.locator("#cardFundDone").click();
  // Back on the balance it started from; the record is under card-funded USD
  await expect(page.locator("#balanceAmount")).toBeVisible();
  await page.locator("#backFromDetail").click();
  await page.locator('[data-holdcur="USD"][data-holdbucket="fiat"] .tx-title').click();
  const dep = page.locator("#balanceHistory [data-deposit]");
  await expect(dep.locator(".tx-title")).toHaveText("USD deposit");
  await expect(dep.locator(".tx-sub")).toHaveText("Visa ••• 4242");
  await expect(dep.locator(".tx-amt")).toHaveText("+$25.00 USD");
});

test("a new card: the brand, its checks, the name must be the account holder's", async ({ page }) => {
  await wallet(page);
  await page.getByLabel("Tier").selectOption("3");
  await page.locator("#actDeposit").click();
  await page.locator('[data-depositcash="GBP"]').click();
  await page.locator("#depositSelectContinue").click();
  await page.locator("#dmCard").click();
  await page.locator("#amountTapTarget").click();
  for (const k of "1000") await page.locator(`[data-key="${k}"]`).click();
  await expect(page.locator("#cardFundFeeCard .info-row").nth(1)).toHaveText("Card funding fee (2.9% + £0.24)£0.53 GBP");
  await page.locator("#cardFundAmtContinue").click();
  await page.locator("#addNewCardBtn").click();
  await expect(title(page)).toHaveText("Add new card");
  await page.locator("#cardNumberInput").fill("9999");
  await expect(page.locator("#cardNumHint")).toBeVisible();
  await page.locator("#cardNumberInput").fill("5555555555554444");
  await expect(page.locator("#cardNumberInput")).toHaveValue("5555 5555 5555 4444");
  await expect(page.locator("#cardNumHint")).toHaveCount(0);
  await page.locator("#cardExpiryInput").fill("012020");
  await expect(page.locator("#expiryHint")).toHaveText("Card has expired");
  await page.locator("#cardExpiryInput").fill("122030");
  await expect(page.locator("#cardExpiryInput")).toHaveValue("12/2030");
  await page.locator("#cardCvvInput").fill("123");
  await page.locator("#cardZipInput").fill("94107");
  await page.locator("#cardNameInput").fill("Someone Else");
  await expect(page.locator("#nameMatchHint")).toHaveText("Must match account holder: Ada Osun");
  await page.locator("#termsCheck").check();
  await expect(page.locator("#cardContinue")).toBeDisabled();
  await page.locator("#cardNameInput").fill("Ada Osun");
  await expect(page.locator("#nameMatchHint")).toHaveText("Matches verified account holder");
  await page.locator("#cardContinue").click();
  await expect(title(page)).toHaveText("Enter passcode");
  for (let i = 0; i < 6; i++) await page.locator("#threeDsRow .otp-box").nth(i).fill("1");
  await page.locator("#verify3ds").click();
  await expect(page.locator("#cardFundDoneCard .r-value").first()).toHaveText("Mastercard ••• 4444");
  expect((await holdings(page)).cash.GBP).toBe(1000);
});

test("a stablecoin: its address on its network, Copy, then a deposit credited after confirming", async ({ page }) => {
  await wallet(page);
  await page.getByLabel("Tier").selectOption("3");
  await page.locator("#actDeposit").click();
  await page.locator('[data-depositasset="USDC"][data-depositnet="Base"]').click();
  await page.locator("#depositSelectContinue").click();
  await expect(title(page)).toHaveText("Deposit USDC");
  await expect(body(page).locator(".step-sub").first()).toHaveText("Send only USDC on Base to this address.");
  await expect(page.locator(".qr-wrap svg")).toHaveCount(2); // the code, and the network's icon in it
  await expect(page.locator("#depositAddress")).toHaveText("0x8f3E2b91…E77Fc341");
  await page.locator("#copyAddr").click();
  await expect(page.locator("#copyAddr")).toHaveText("Copied");
  await expect(page.locator("#addressRows .r-label")).toHaveText(["Network", "Minimum deposit", "Credited after"]);
  await expect(page.locator("#addressRows .r-value")).toHaveText(["Base", "1.00 USDC", "12 confirmations (~15 sec)"]);
  await expect(body(page)).toContainText("Waiting for deposit on Base…");
  await page.locator("#simulateDeposit").click();
  await expect(title(page)).toHaveText("Confirming on Base");
  await expect(page.locator("#depositDoneAmount")).toHaveText("25.00 USDC");
  expect((await holdings(page)).coins.USDC.Base).toBe(2500);
  await page.locator("#viewFundTx").click();
  const rows = page.locator("#txDetail .info-row");
  await expect(rows.filter({ hasText: "Asset" })).toContainText("USDC");
  await expect(rows.filter({ hasText: "Network" })).toContainText("Base");
  await page.locator("#backFromTxDetail").click();
  await page.locator('[data-wallettab="assets"]').click();
  await page.locator('[data-holdasset="USDC"][data-holdnet="Base"]').click();
  await expect(page.locator("[data-deposit] .tx-title")).toHaveText("USDC deposit");
});

test("Back walks the flow; from a balance it returns to the balance", async ({ page }) => {
  await wallet(page);
  await page.locator("#actDeposit").click();
  await page.locator('[data-depositasset="USDT"][data-depositnet="Polygon"]').click();
  await page.locator("#depositSelectContinue").click();
  await expect(page.locator("#addressRows .r-value").last()).toHaveText("128 confirmations (~2 min)");
  await page.locator("#backFundSelect").click();
  await expect(title(page)).toHaveText("Deposit");
  await page.locator("#backHome").click();
  await expect(page.locator("#actDeposit")).toBeVisible();
  await page.locator('[data-holdcur="EUR"][data-holdbucket="open"] .tx-title').click();
  await page.locator("#detailDeposit").click();
  await expect(title(page)).toHaveText("Deposit EUR");
  await page.locator("#backToDepositSelect").click();
  await expect(page.locator("#balanceAmount")).toBeVisible();
});
