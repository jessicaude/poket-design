import { test, expect, type Page } from "@playwright/test";

/**
 * The Card tab (tCard in reference/poket-unified.html): locked below Tier 3 with what each tier takes and "Increase
 * my limits"; the first card (a nickname, the balance it spends from); its details behind the eye, with Copy;
 * freeze and unfreeze (with a confirmation); the tier's limits; Simulate purchase approves against the balance (or
 * declines) and records a card transaction in the card's activity, Activity and the balance's history.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
async function wallet(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
}
const toast = (page: Page) => page.locator("#toastEl");
const body = (page: Page) => page.locator("#panelBody");
async function firstCard(page: Page, pick = '[data-cardcash="USD"]') {
  await page.getByLabel("Tier").selectOption("3");
  await page.locator("#tabCard").click();
  await page.locator(pick).click();
  await page.locator("#issueCard").click();
  await expect(page.locator("#cardTitle")).toBeVisible();
}

test("below Tier 3: the lock, what each tier takes, and Increase my limits (one tier at a time)", async ({ page }) => {
  await wallet(page);
  await page.locator("#tabCard").click();
  await expect(body(page).locator(".step-title")).toHaveText("Virtual cards need Tier 3: Enhanced");
  await expect(body(page).locator(".step-sub")).toHaveText("Per Poket’s certified controls, virtual cards and wire transfers unlock at Tier 3: Enhanced. You’re currently at Tier 0: Registered.");
  await expect(page.locator("#cardNeeds .info-row")).toHaveText(["Tier 1Scan your ID and take a selfie", "Tier 2Add proof of address", "Tier 3Add a source of funds declaration"]);
  await expect(page.locator("#unlockTier3FromCard")).toHaveText("Increase my limits (Tier 1: Basic)");
  // At Tier 2: one step left
  await page.getByLabel("Tier").selectOption("2");
  await expect(page.locator("#cardNeeds .info-row")).toHaveText(["Tier 3Add a source of funds declaration"]);
  await page.locator("#unlockTier3FromCard").click();
  await expect(page.locator("#stepupLine")).toHaveText("Add a source of funds declaration to reach Tier 3.");
  await page.locator("#stepupIntroContinue").click();
  // Tier 3: the first card
  await expect(body(page).locator(".step-title").first()).toHaveText("Virtual card");
  await expect(page.getByLabel("Tier")).toHaveValue("3");
  // The Wallet tab still shows the home
  await page.locator("#tabHome").click();
  await expect(page.locator("#actDeposit")).toBeVisible();
});

test("the first card: a balance to spend from, Personal by default; details behind the eye, with Copy", async ({ page }) => {
  await wallet(page);
  await page.getByLabel("Tier").selectOption("3");
  await page.locator("#tabCard").click();
  await expect(body(page).locator(".vcard .vcard-num")).toHaveText("•••• •••• •••• ••••");
  await expect(body(page).locator(".vcard-bottom b").first()).toHaveText("ADA OSUN");
  // Every cash balance and every stablecoin on every network
  await expect(page.locator("[data-cardcash]")).toHaveCount(5);
  await expect(page.locator("[data-cardasset]")).toHaveCount(4);
  await expect(page.locator('[data-cardcash="USD"] .t2')).toHaveText("Available $65.60 USD");
  await expect(page.locator("#issueCard")).toBeDisabled();
  await page.locator('[data-cardcash="USD"]').click();
  await expect(page.locator('[data-cardcash="USD"]')).toHaveClass(/\bsel\b/);
  await expect(page.locator("#issueCard")).toHaveText("Activate virtual card");
  await page.locator("#issueCard").click();
  await expect(toast(page)).toHaveText("Virtual card activated");
  await expect(page.locator("#cardTitle")).toHaveText("Personal");
  await expect(body(page).locator(".step-sub").first()).toHaveText("Spends live from USD cash balance of $65.60 USD.");
  // Masked: the last four only, no CVV, no Copy
  await expect(page.locator("#cardNumber")).toHaveText(/^•••• •••• •••• \d{4}$/);
  await expect(page.locator("#cardCvv")).toHaveCount(0);
  await expect(page.locator("#cardExpiry")).toHaveText("••/••••");
  await expect(page.locator("#cardCopyNumber")).toHaveCount(0);
  const last4 = (await page.locator("#cardNumber").textContent())!.slice(-4);
  await page.locator("#cardEyeToggle").click();
  await expect(page.locator("#cardNumber")).toHaveText(new RegExp(`^4242 \\d{4} \\d{4} ${last4}$`));
  await expect(page.locator("#cardCvv")).toHaveText(/^\d{3}$/);
  await expect(page.locator("#cardExpiry")).toHaveText("08/2029");
  await page.locator("#cardCopyNumber").click();
  await expect(toast(page)).toHaveText("Card number copied");
  await page.locator("#cardEyeToggle").click();
  await expect(page.locator("#cardNumber")).toHaveText(`•••• •••• •••• ${last4}`);
  // The tier's limits, and no spend yet
  await expect(page.locator("#cardLimits")).toContainText("Tier 3: Enhanced limits");
  await expect(page.locator("#cardLimits .info-row")).toHaveText(["Per transaction$50,000.00 USD", "Per day$100,000.00 USD", "Per month$500,000.00 USD"]);
  await expect(body(page)).toContainText("No card spend yet.");
});

test("freeze asks first and declines new transactions; unfreeze is one tap", async ({ page }) => {
  await wallet(page);
  await firstCard(page);
  await page.locator("#freezeCard").click();
  await expect(page.locator("#freezeConfirm")).toContainText("Freeze this card? New transactions will be declined until you unfreeze it.");
  await page.locator("#cancelFreeze").click();
  await expect(page.locator("#freezeConfirm")).toHaveCount(0);
  await page.locator("#freezeCard").click();
  await page.locator("#confirmFreeze").click();
  await expect(toast(page)).toHaveText("Card frozen");
  await expect(page.locator("#cardFrozen")).toHaveText("This card is frozen. New transactions will be declined.");
  await expect(page.locator("#simulatePurchase")).toBeDisabled();
  await expect(page.locator("#freezeCard")).toHaveText("Unfreeze card");
  await page.locator("#freezeCard").click();
  await expect(toast(page)).toHaveText("Card unfrozen");
  await expect(page.locator("#cardFrozen")).toHaveCount(0);
  await expect(page.locator("#simulatePurchase")).toBeEnabled();
});

test("a purchase spends from the balance (card money first) and is a card transaction everywhere", async ({ page }) => {
  await wallet(page);
  await firstCard(page);
  await page.evaluate(() => { Math.random = () => 0; }); // Blue Bottle Coffee, $6.50
  await page.locator("#simulatePurchase").click();
  await expect(page.locator("#simulatePurchase")).toHaveText("Authorizing…");
  await expect(toast(page)).toHaveText("Approved: Blue Bottle Coffee · $6.50");
  const h = await page.evaluate(() => { const s = (window as any).__holdings.getState(); return { usd: s.cash.USD, fiat: s.fiatOnly.USD }; });
  expect(h).toEqual({ usd: 5910, fiat: 910 }); // $65.60 - $6.50, from the $15.60 card-funded first
  await expect(body(page).locator(".step-sub").first()).toHaveText("Spends live from USD cash balance of $59.10 USD.");
  const row = page.locator("#cardActivity [data-cardtx]");
  await expect(row.locator(".tx-title")).toHaveText("Blue Bottle Coffee");
  await expect(row.locator(".tx-sub")).toHaveText(/^Personal ••• \d{4}$/);
  await expect(row.locator(".tx-amt")).toHaveText("-$6.50 USD");
  await expect(row.locator(".tx-ic")).toHaveAttribute("data-dir", "out");
  // The detail
  await row.click();
  const rows = page.locator("#txDetail .info-row");
  await expect(rows.filter({ hasText: "Status" })).toContainText("Approved");
  await expect(rows.locator("> span:first-child")).toHaveText(["Status", "Date", "From", "To", "Method", "Reference"]);
  await expect(rows.filter({ hasText: "From" })).toContainText(/Personal ••• \d{4} · USD balance/);
  await expect(rows.filter({ hasText: "To" })).toContainText("Blue Bottle Coffee");
  await expect(rows.filter({ hasText: "Method" })).toContainText("Virtual card");
  await expect(page.locator("#txDetail")).toContainText(/TXN-\d{6}/);
  await expect(page.locator("#shareReceipt")).toBeVisible();
  await page.locator("#backFromTxDetail").click();
  // Activity, and the card-funded USD balance's history
  await page.locator("#tabActivity").click();
  await expect(page.locator("#activityHistory [data-cardtx]")).toHaveCount(1);
  await page.locator("#tabHome").click();
  await page.locator('[data-holdcur="USD"][data-holdbucket="fiat"] .tx-title').click();
  await expect(page.locator("#balanceHistory [data-cardtx]")).toHaveCount(1);
  // The statement's line
  const entries = await page.evaluate(() => (window as any).__ledger.getState().entries.filter((e: any) => e.currency === "USD").map((e: any) => [e.description, e.delta]));
  expect(entries).toEqual([["Card · Blue Bottle Coffee", -650]]);
});

test("a purchase over the balance is declined; nothing moves", async ({ page }) => {
  await wallet(page);
  await page.evaluate(() => (window as any).__holdings.getState().set({ cash: { USD: 100, EUR: 0, GBP: 0, GHS: 0 }, fiatOnly: { USD: 0, NGN: 0, EUR: 0, GBP: 0, GHS: 0 } }));
  await firstCard(page);
  await page.evaluate(() => { Math.random = () => 0; });
  await page.locator("#simulatePurchase").click();
  await expect(toast(page)).toHaveText("Declined: Blue Bottle Coffee exceeds available balance");
  expect(await page.evaluate(() => (window as any).__holdings.getState().cash.USD)).toBe(100);
  await expect(body(page)).toContainText("No card spend yet.");
});

test("another card: its own balance and name; switch between cards", async ({ page }) => {
  await wallet(page);
  await firstCard(page);
  await page.locator("#addAnotherCardBtn").click();
  await expect(body(page).locator(".step-title")).toHaveText("Add a card");
  await page.locator("#cancelCreateCard").click();
  await expect(page.locator("#cardTitle")).toHaveText("Personal");
  await page.locator("#addAnotherCardBtn").click();
  await page.locator('[data-cardasset="USDC"][data-cardnet="Base"]').click();
  await expect(page.locator("#issueCard")).toHaveText("Create card");
  await page.locator("#issueCard").click();
  await expect(toast(page)).toHaveText("Card created");
  await expect(page.locator("#cardTitle")).toHaveText("USDC card");
  await expect(body(page).locator(".step-sub").first()).toHaveText("Spends live from USDC on Base balance of $0.00 USD.");
  await expect(page.locator("[data-cardswitch]")).toHaveText(["Personal", "USDC card"]);
  await page.locator("[data-cardswitch]").first().click();
  await expect(page.locator("#cardTitle")).toHaveText("Personal");
  // A named card
  await page.locator("#addAnotherCardBtn").click();
  await page.locator("#cardNicknameInput").fill("Subscriptions");
  await page.locator('[data-cardcash="NGN"]').click();
  await page.locator("#issueCard").click();
  await expect(page.locator("#cardTitle")).toHaveText("Subscriptions");
  await expect(body(page).locator(".step-sub").first()).toHaveText("Spends live from NGN cash balance of ₦50,000.00 NGN.");
});
