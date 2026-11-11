import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * NGN checkout on the Ilé Living demo: the demo bar's order currency and merchant settings, the naira rails on
 * add-method, the naira card form, bank transfer into a one-time account ("Dynamic") or the merchant's pool,
 * paying in USD converted (quote card), and the $500 ID rule on the USD value of the naira total.
 */

async function enterCode(page: Page, code = "123456") {
  const boxes = page.locator("#otp input");
  for (let i = 0; i < 6; i++) await boxes.nth(i).fill(code[i]);
}

test("demo bar: an NGN order shows in naira on the page and in the widget", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await expect(page.locator("#orderTotal")).toHaveText("$23.40");
  await page.getByLabel("Order currency").selectOption("NGN");
  await expect(page.locator("#orderTotal")).toHaveText("₦36,270.00"); // the merchant page: no code
  await expect(page.locator(".summary")).toContainText("₦24,490.00"); // Adire throw cushion, $15.80
  await expect(page.locator(".ship")).toContainText("₦9,300.00"); // Express, $6.00

  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await expect(widget.getByRole("heading", { name: "Pay ₦36,270.00 to Ilé Living" })).toBeVisible();
  await expect(widget.locator(".line", { hasText: "Order total" })).toHaveText(/₦36,270\.00\s*NGN/);
  await expect(page.getByTestId("events")).toContainText('"currency":"NGN"');
  await widget.locator("#payGo").click();
  await expect(widget.getByRole("heading", { name: "Paid ₦36,270.00 to Ilé Living" })).toBeVisible();
});

test("demo bar: the widget reads what the merchant accepts and its bank transfer account", async ({ page }) => {
  await page.goto("/demo/ile-living");
  const settings = () => page.evaluate(() => (window as any).__checkout.getState().settings); // eslint-disable-line @typescript-eslint/no-explicit-any
  const accepts = page.getByRole("group", { name: "Merchant accepts" });
  for (const l of ["NGN card", "NGN bank transfer", "Conversion"]) await expect(accepts.getByLabel(l)).toBeChecked();
  await expect(page.getByLabel("Bank transfer account")).toHaveValue("dynamic");

  await accepts.getByLabel("NGN card").uncheck();
  await accepts.getByLabel("Conversion").uncheck();
  await page.getByLabel("Bank transfer account").selectOption("pool");
  await page.locator("#payWithPoket").click();
  expect(await settings()).toEqual({ accepts: { ngnCard: false, ngnBank: true, conversion: false }, bankTransferAccount: "pool" });

  // Read when the widget opens: changing the bar later applies to the next checkout
  await page.getByTestId("checkout-widget").getByRole("button", { name: "Close" }).click();
  await accepts.getByLabel("NGN card").check();
  await page.getByLabel("Bank transfer account").selectOption("dynamic");
  await page.locator("#payWithPoket").click();
  expect(await settings()).toEqual({ accepts: { ngnCard: true, ngnBank: true, conversion: false }, bankTransferAccount: "dynamic" });
});

test("the $500 ID check uses an NGN order's USD value", async () => {
  const { orderUsdCents, formatOrder } = await import("@/lib/money");
  expect(orderUsdCents(50000 * 1550, "NGN")).toBe(50000);
  expect(orderUsdCents(49999 * 1550, "NGN")).toBe(49999);
  expect(orderUsdCents(77499999, "NGN")).toBe(49999); // ₦774,999.99 is under $500 (rounded down)
  expect(orderUsdCents(2340, "USD")).toBe(2340);
  expect(formatOrder(3627000, "NGN")).toBe("₦36,270.00"); // running text: no code
  expect(formatOrder(2340, "USD")).toBe("$23.40");
});

/** A new user on an NGN order, signed up and on "Add a payment method". */
async function ngnAddMethod(page: Page, setBar?: () => Promise<void>) {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Order currency").selectOption("NGN");
  if (setBar) await setBar();
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();
  await enterCode(page);
  await expect(widget.getByRole("heading", { name: "Add a payment method" })).toBeVisible();
  return widget;
}
const rows = (widget: Locator) => widget.locator(".methods .method").allInnerTexts().then((a) => a.map((t) => t.replace(/\s+/g, " ").replace(" ›", "").trim()));

test("NGN order: the naira rails first, then the merchant's other rails marked as converted", async ({ page }) => {
  const widget = await ngnAddMethod(page);
  await expect.poll(() => rows(widget)).toEqual([
    "Card Nigerian debit or credit card",
    "Bank transfer Pay into an account we show you",
    "CardPaid in USD, converted Debit or credit card",
    "Pay by BankPaid in USD, converted Link your bank account",
    "Apple PayPaid in USD, converted Use a card in your Apple Wallet",
    "Google PayPaid in USD, converted Use a card in your Google Wallet",
    "$ Cash App PayPaid in USD, converted Pay from your Cash App",
  ]);
  await expect(widget.locator(".method[data-converted] .chip")).toHaveCount(5);

  // The NGN card: same form and validation, Verve supported
  await widget.locator('[data-addpm="ngn-card"]').click();
  await expect(widget.getByRole("heading", { name: "Add a card" })).toBeVisible();
  await widget.locator("#cNum").fill("1234");
  await expect(widget).toContainText("We don’t recognise this card. Poket accepts Visa, Mastercard, Amex, Discover and Verve.");
  await widget.locator("#cNum").fill("5061020000000000");
  await expect(widget.locator("#cNum")).toHaveValue("5061 0200 0000 0000");
  await expect(widget.locator("#cBrandLbl")).toHaveText("Verve card");
  await widget.locator("#cExp").fill("122029");
  await expect(widget.locator("#cZip")).toHaveCount(0); // naira cards: number, expiry and CVC only
  await expect(widget.locator("#cGo")).toBeDisabled();
  await widget.locator("#cCvc").fill("123");
  await expect(widget.locator("#cGo")).toBeEnabled();
  await widget.locator("#cGo").click();
  await expect(widget.getByRole("radio", { name: /Verve ••• 0000/ })).toHaveAttribute("aria-checked", "true");
  const methods = await page.evaluate(() => (window as any).__account.getState().account.methods); // eslint-disable-line @typescript-eslint/no-explicit-any
  expect(methods.map((m: { currency?: string }) => m.currency)).toEqual(["NGN"]);

  // Paying with it: no quote; the merchant's event names the rail
  await expect(widget.locator("#quoteCard")).toHaveCount(0);
  await widget.locator("#payGo").click();
  await expect(widget.getByRole("heading", { name: "Paid ₦36,270.00 to Ilé Living" })).toBeVisible();
  const ev = page.getByTestId("events").locator("li", { hasText: "payment.succeeded" });
  await expect(ev).toContainText('"amount":3627000,"currency":"NGN"');
  await expect(ev).toContainText('"rail":"ngn_card"');
  await expect(ev).not.toContainText("account_type");
  await expect(ev).not.toContainText("charged_amount");
});

test("NGN order: only the rails the merchant accepts; no converted rails without Conversion", async ({ page }) => {
  const accepts = page.getByRole("group", { name: "Merchant accepts" });
  let widget = await ngnAddMethod(page, async () => { await accepts.getByLabel("Conversion").uncheck(); await accepts.getByLabel("NGN card").uncheck(); });
  await expect.poll(() => rows(widget)).toEqual(["Bank transfer Pay into an account we show you"]);

  widget = await ngnAddMethod(page, async () => { await accepts.getByLabel("NGN bank transfer").uncheck(); await accepts.getByLabel("NGN card").uncheck(); });
  await expect.poll(() => rows(widget)).toHaveLength(5);
  await expect(widget.locator(".method[data-converted]")).toHaveCount(5);

  widget = await ngnAddMethod(page, async () => { for (const l of ["NGN card", "NGN bank transfer", "Conversion"]) await accepts.getByLabel(l).uncheck(); });
  await expect.poll(() => rows(widget)).toEqual([]);
  await expect(widget.locator("#noMethods")).toHaveText("Ilé Living can’t take payment for this order right now.");
});

test("USD order: the add-method list is unchanged", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();
  await enterCode(page);
  await expect.poll(() => rows(widget)).toEqual([
    "Card Debit or credit card", "Pay by Bank Link your bank account", "Apple Pay Use a card in your Apple Wallet",
    "Google Pay Use a card in your Google Wallet", "$ Cash App Pay Pay from your Cash App",
  ]);
  await expect(widget.locator(".chip")).toHaveCount(0);
});

test("NGN order: a dollar card (paid in USD, converted) keeps the ZIP code", async ({ page }) => {
  const widget = await ngnAddMethod(page);
  await widget.locator('[data-addpm="card"]').click();
  await widget.locator("#cNum").fill("4242424242424242");
  await widget.locator("#cExp").fill("122029");
  await widget.locator("#cCvc").fill("123");
  await expect(widget.locator("#cZip")).toBeVisible();
  await expect(widget.locator("#cGo")).toBeDisabled();
  await widget.locator("#cZip").fill("10001");
  await expect(widget.locator("#cGo")).toBeEnabled();
  await widget.locator("#cGo").click();
  const methods = await page.evaluate(() => (window as any).__account.getState().account.methods); // eslint-disable-line @typescript-eslint/no-explicit-any
  expect(methods.map((m: { currency?: string }) => m.currency)).toEqual([undefined]);
});

test("bank transfer (Dynamic): a one-time account for the exact amount; the transfer arriving pays the order", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const widget = await ngnAddMethod(page);
  await expect(page.locator("#demoTransferArrives")).toHaveCount(0); // only on the transfer screen
  await widget.locator('[data-addpm="ngn-bank"]').click();
  await expect(widget.locator("#transferDetails")).toBeVisible();
  await expect(widget.getByRole("heading", { name: "Pay ₦36,270.00 by bank transfer" })).toBeVisible();

  const fields = await widget.locator(".va-field").allInnerTexts();
  expect(fields.map((t) => t.replace(/\s+/g, " ").trim())).toEqual([
    expect.stringMatching(/^Amount to send exactly ₦36,270\.00 NGN Copy$/),
    expect.stringMatching(/^Account number \d{10} Copy$/),
    "Bank [Partner bank]",
    "Account name Ilé Living via Poket Copy",
  ]);
  await expect(widget.locator("#transferCount")).toHaveText(/^(30:00|29:5\d)$/);
  await expect(widget.locator(".sub")).toContainText("[time]");
  await expect(widget.locator("#transferWaiting")).toHaveText("We’ll confirm as soon as it arrives");
  await expect(widget.locator("#transferOnce")).toHaveText("Use it once. A transfer for a different amount, or after it expires, is [handling].");

  const num = (await widget.locator(".va-field").nth(1).locator(".va-v").innerText()).trim();
  await widget.locator('[data-transfercopy="1"]').click();
  await expect(widget.locator('[data-transfercopy="1"]')).toHaveText("Copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(num);
  await widget.locator('[data-transfercopy="3"]').click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("Ilé Living via Poket");

  await page.locator("#demoTransferArrives").click();
  await expect(widget.getByRole("heading", { name: "Paid ₦36,270.00 to Ilé Living" })).toBeVisible();
  await expect(widget.locator(".sumbox")).toContainText("Bank transfer");
  await expect(page.getByTestId("events")).toContainText('"method":"bank_transfer"');
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.succeeded" })).toContainText('"rail":"ngn_bank_transfer","account_type":"dynamic"');
  await expect(page.locator("#demoTransferArrives")).toHaveCount(0);
});

test("bank transfer (Dynamic): an expired account offers a new one", async ({ page }) => {
  const widget = await ngnAddMethod(page);
  await widget.locator('[data-addpm="ngn-bank"]').click();
  await expect(widget.locator("#transferDetails")).toBeVisible();
  const first = (await widget.locator(".va-field").nth(1).locator(".va-v").innerText()).trim();

  await page.locator("#demoTransferExpire").click();
  await expect(widget.getByRole("heading", { name: "This account expired" })).toBeVisible();
  await expect(page.locator("#demoTransferArrives")).toHaveCount(0);

  await widget.locator("#transferAgain").click();
  await expect(widget.locator("#transferDetails")).toBeVisible();
  const second = (await widget.locator(".va-field").nth(1).locator(".va-v").innerText()).trim();
  expect(second).not.toBe(first);
  await expect(widget.locator("#transferCount")).toHaveText(/^(30:00|29:5\d)$/);
});

test("bank transfer (Dynamic): the countdown running out expires the account", async ({ page }) => {
  await page.clock.install();
  const widget = await ngnAddMethod(page);
  await widget.locator('[data-addpm="ngn-bank"]').click();
  await page.clock.runFor(1500); // the account is created
  await expect(widget.locator("#transferCount")).toHaveText(/^(30:00|29:5\d)$/);
  await page.clock.runFor(30 * 60 * 1000);
  await expect(widget.getByRole("heading", { name: "This account expired" })).toBeVisible();
});

/** NGN order, Merchant pool, on the bank transfer screen. */
async function poolTransfer(page: Page) {
  const widget = await ngnAddMethod(page, () => page.getByLabel("Bank transfer account").selectOption("pool").then(() => {}));
  await widget.locator('[data-addpm="ngn-bank"]').click();
  await expect(widget.locator("#transferDetails")).toBeVisible();
  return widget;
}
const fieldTexts = (widget: Locator) =>
  widget.locator(".va-field").allInnerTexts().then((a) => a.map((t) => t.replace(/\s+/g, " ").trim()));

test("bank transfer (Merchant pool): the merchant's account and the exact amount, no countdown; the exact amount pays", async ({ page }) => {
  const widget = await poolTransfer(page);
  expect(await fieldTexts(widget)).toEqual([
    "Amount to send exactly ₦36,270.00 NGN Copy",
    "Account number 2045118830 Copy",
    "Bank [Partner bank]",
    "Account name Ilé Living via Poket Copy",
  ]);
  await expect(widget.locator(".sub")).toHaveText("From any Nigerian bank app.");
  await expect(widget.locator("#transferCount")).toHaveCount(0);
  await expect(widget.locator("#transferOnce")).toHaveCount(0); // the pool isn't used once
  await expect(widget.locator("#transferWaiting")).toHaveText("We’ll confirm as soon as it arrives");
  // The one-time account's actions don't apply to the pool
  await expect(page.locator("#demoTransferExpire")).toHaveCount(0);
  await expect(page.locator("#demoTransferArrives")).toHaveCount(0);

  await page.locator("#demoPoolExact").click();
  await expect(widget.getByRole("heading", { name: "Paid ₦36,270.00 to Ilé Living" })).toBeVisible();
  await expect(widget.locator(".sumbox")).toContainText("Bank transfer");
  await expect(page.getByTestId("events")).toContainText('"method":"bank_transfer"');
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.succeeded" })).toContainText('"rail":"ngn_bank_transfer","account_type":"pool"');
});

test("bank transfer (Merchant pool): less than the order shows what arrived and [handling]", async ({ page }) => {
  const widget = await poolTransfer(page);
  await page.locator("#demoPoolLess").click();
  await expect(widget.locator("#transferResult")).toHaveText("We received ₦32,643.00. [handling]");
  await expect(widget.locator("#transferWaiting")).toHaveCount(0);
  await expect(page.locator("#demoPoolExact")).toHaveCount(0); // matched: no more transfers to simulate
  await expect(page.getByTestId("events")).not.toContainText("payment.succeeded");
  // The merchant hears about it: expected and received amounts, and the order reference
  const mismatch = page.getByTestId("events").locator("li", { hasText: "payment.amount_mismatch" });
  await expect(mismatch).toContainText('"order_reference":"ILV-10482"');
  await expect(mismatch).toContainText('"expected_amount":3627000');
  await expect(mismatch).toContainText('"received_amount":3264300');
  await expect(mismatch).toContainText('"rail":"ngn_bank_transfer","account_type":"pool"');
  // Close under the note
  await widget.locator("#transferClose").click();
  await expect(widget).toHaveCount(0);
  await expect(page.getByTestId("events")).toContainText('"reason":"amount_mismatch"');
});

test("bank transfer (Merchant pool): more than the order shows what arrived and [handling]", async ({ page }) => {
  const widget = await poolTransfer(page);
  await page.locator("#demoPoolMore").click();
  await expect(widget.locator("#transferResult")).toHaveText("We received ₦39,897.00. [handling]");
  await expect(page.getByTestId("events")).not.toContainText("payment.succeeded");
  await expect(page.getByTestId("events")).toContainText('"expected_amount":3627000,"received_amount":3989700');
  await expect(widget.locator("#transferClose")).toHaveText("Close");
});

test("demo bar: wraps onto a second row instead of cutting labels off; the page sits below it", async ({ page }) => {
  const measure = () => page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>(".pbar")!;
    const cut = [...bar.querySelectorAll("select")].filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.getAttribute("aria-label"));
    return { h: bar.offsetHeight, v: getComputedStyle(document.documentElement).getPropertyValue("--bar").trim(), overflow: bar.scrollWidth > bar.clientWidth, cut,
      caption: getComputedStyle(bar.querySelector(".pbar-group-lbl")!).display !== "none" };
  });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/demo/ile-living");
  await expect.poll(measure).toEqual({ h: 44, v: "44px", overflow: false, cut: [], caption: true }); // one row

  await page.setViewportSize({ width: 1280, height: 900 });
  const widget = await poolTransfer(page);
  const m = await measure();
  expect(m.h).toBeGreaterThan(44); // a second row
  expect(m).toMatchObject({ v: `${m.h}px`, overflow: false, cut: [], caption: true });
  expect(await page.locator(".scrim").evaluate((e) => e.getBoundingClientRect().top)).toBe(m.h);
  await expect(widget).toBeInViewport();
});

test("mock: CentryOS matches a pool transfer to the order by amount", async () => {
  const { getMerchantPoolAccount, simulateCheckoutTransfer } = await import("@/lib/mock-api");
  const { demoTransferAmount } = await import("@/features/checkout/useCheckout");
  const p = { amount: 3627000, merchant: "Ilé Living", orderRef: "ILV-10482" };
  expect(demoTransferAmount(3627000, "less")).toBe(3264300);
  expect(demoTransferAmount(3627000, "more")).toBe(3989700);
  let va = await getMerchantPoolAccount(p);
  expect(va).toMatchObject({ kind: "pool", num: "2045118830", expiresAt: null, accountName: "Ilé Living via Poket" });
  expect(await simulateCheckoutTransfer(va.id, 3627000)).toMatchObject({ status: "paid", received: 3627000 });
  await expect(simulateCheckoutTransfer(va.id, 3627000)).rejects.toThrow("no_virtual_account"); // matched once
  va = await getMerchantPoolAccount(p);
  expect(await simulateCheckoutTransfer(va.id, 3264300)).toMatchObject({ status: "underpaid", received: 3264300 });
  va = await getMerchantPoolAccount(p);
  expect(await simulateCheckoutTransfer(va.id, 3989700)).toMatchObject({ status: "overpaid", received: 3989700 });
});

/** Ada (remembered: Visa ••• 4242, Chase checking ••• 6789) on an NGN order. */
async function ngnReturning(page: Page, setBar?: () => Promise<void>) {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Order currency").selectOption("NGN");
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  if (setBar) await setBar();
  await page.locator("#payWithPoket").click();
  return page.getByTestId("checkout-widget");
}
const squash = (l: Locator) => l.innerText().then((t) => t.replace(/\s+/g, " ").trim());

test("converted: a USD card on an NGN order sees the quote before Pay; done shows both amounts", async ({ page }) => {
  const widget = await ngnReturning(page);
  await expect(widget.getByRole("heading", { name: "Pay ₦36,270.00 to Ilé Living" })).toBeVisible();
  await expect(widget.locator("#quoteRate")).toHaveText("1 USD ≈ 1,550.00 NGN");
  await expect(widget.locator("#quoteFee")).toHaveText("Covered by Ilé Living");
  await expect(widget.locator(".sumbox .line", { hasText: "Fees" })).toContainText("Covered by Ilé Living");
  expect(await squash(widget.locator("#quoteYouPay"))).toBe("You pay $23.40 USD for ₦36,270.00 NGN");
  await expect(widget.locator("#quoteTimer")).toHaveText(/^Rate held for 0:(30|29|28)$/);
  await expect(widget.locator(".sumbox .line", { hasText: "You pay" })).toHaveText(/\$23\.40\s*USD/);
  await expect(widget.locator("#payGo")).toHaveText("Pay $23.40");
  await expect(widget.locator(".mandate")).toHaveCount(0); // a card: no debit line

  await widget.locator("#payGo").click();
  await expect(widget.locator("#processingAmount")).toHaveText("$23.40"); // the dollars being charged
  await expect(widget.getByRole("heading", { name: "Paid ₦36,270.00 to Ilé Living" })).toBeVisible();
  await expect(widget.locator("#donePaidUsd")).toHaveText(/You paid\s*\$23\.40\s*USD/);
  await expect(widget.locator(".sumbox .line", { hasText: "Total" })).toHaveText(/₦36,270\.00\s*NGN/);
  await expect(widget.locator(".sumbox")).toContainText("1 USD ≈ 1,550.00 NGN");
  const p = await page.evaluate(() => (window as any).__account.getState().account.payments[0]); // eslint-disable-line @typescript-eslint/no-explicit-any
  expect(p).toMatchObject({ amount: 3627000, currency: "NGN", charged: { amount: 2340, currency: "USD" } });
  // The merchant's event: the naira order plus what was charged and the rate
  const ev = page.getByTestId("events").locator("li", { hasText: "payment.succeeded" });
  await expect(ev).toContainText('"amount":3627000,"currency":"NGN"');
  await expect(ev).toContainText('"charged_amount":2340,"charged_currency":"USD","fx_rate":1550');
  await expect(ev).not.toContainText('"rail"'); // a dollar card, not a naira rail
});

test("converted: paying from a US bank, the debit line names the dollars debited", async ({ page }) => {
  const widget = await ngnReturning(page);
  await widget.locator('[data-pm="pm_bank"]').click();
  await expect(widget.locator(".mandate")).toHaveText("By paying, you authorize Poket to debit Chase checking ••• 6789 for $23.40 USD.");
  await expect(widget.locator("#quoteCard")).toBeVisible();
  await widget.locator("#payGo").click();
  await expect(widget.locator("#donePaidUsd")).toHaveText(/\$23\.40\s*USD/);
});

test("converted: after 30 seconds the rate expires and Refresh rate replaces Pay", async ({ page }) => {
  await page.clock.install();
  const widget = await ngnReturning(page);
  await expect(widget.locator("#quoteTimer")).toHaveText("Rate held for 0:30");
  await page.clock.runFor(10_000);
  await expect(widget.locator("#quoteTimer")).toHaveText("Rate held for 0:20");
  await page.clock.runFor(20_000);
  await expect(widget.locator("#quoteTimer")).toHaveText("Rate expired. Refresh to get a new rate.");
  await expect(widget.locator("#payGo")).toHaveCount(0);
  // The store refuses a payment on an expired rate too
  await page.evaluate(() => (window as any).__checkout.getState().pay()); // eslint-disable-line @typescript-eslint/no-explicit-any
  await expect(widget.locator("#quoteRefresh")).toHaveText("Refresh rate");

  await widget.locator("#quoteRefresh").click();
  await expect(widget.locator("#quoteTimer")).toHaveText("Rate held for 0:30");
  await expect(widget.locator("#quoteRate")).toHaveText(/^1 USD ≈ 1,5\d\d\.\d\d NGN$/); // a new quote can move a little
  await expect(widget.locator("#payGo")).toHaveText(/^Pay \$23\.\d\d$/);
});

test("Conversion off: dollar methods are disabled with why and can't be selected; a naira card still pays", async ({ page }) => {
  const widget = await ngnReturning(page, () => page.getByRole("group", { name: "Merchant accepts" }).getByLabel("Conversion").uncheck());
  for (const id of ["pm_visa", "pm_bank"]) {
    const row = widget.locator(`[data-pm="${id}"]`);
    await expect(row).toHaveClass(/\boff\b/);
    await expect(row).toHaveAttribute("aria-disabled", "true");
    await expect(row).toHaveAttribute("aria-checked", "false");
    await expect(row.locator("small")).toHaveText("Ilé Living only accepts naira for this order.");
  }
  await widget.locator('[data-pm="pm_bank"]').click({ force: true });
  await expect(widget.locator('[data-pm="pm_bank"]')).toHaveAttribute("aria-checked", "false");
  await page.evaluate(() => (window as any).__checkout.getState().select("pm_visa")); // eslint-disable-line @typescript-eslint/no-explicit-any
  await expect(widget.locator('[data-pm="pm_visa"]')).toHaveAttribute("aria-checked", "false");
  await expect(widget.locator("#payGo")).toBeDisabled();
  await expect(widget.locator("#quoteCard")).toHaveCount(0);
  await expect(widget.locator(".mandate")).toHaveCount(0);

  // A naira card is selectable and pays the naira amount
  await page.evaluate(() => (window as any).__account.getState().update((a: any) => ({ ...a, methods: [...a.methods, // eslint-disable-line @typescript-eslint/no-explicit-any
    { id: "pm_ngn", kind: "card", brand: "verve", last4: "0000", name: "Verve ••• 0000", sub: "Debit", currency: "NGN" }] })));
  await widget.locator('[data-pm="pm_ngn"]').click();
  await expect(widget.locator('[data-pm="pm_ngn"]')).toHaveAttribute("aria-checked", "true");
  await expect(widget.locator('[data-pm="pm_ngn"]')).not.toHaveClass(/\boff\b/);
  await widget.locator("#payGo").click();
  await expect(widget.getByRole("heading", { name: "Paid ₦36,270.00 to Ilé Living" })).toBeVisible();
  await expect(widget.locator("#donePaidUsd")).toHaveCount(0);
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.succeeded" })).not.toContainText("charged_amount");
});

test("no quote: an NGN card, or a USD order", async ({ page }) => {
  const widget = await ngnReturning(page);
  await expect(widget.locator("#quoteCard")).toBeVisible();
  await page.evaluate(() => (window as any).__account.getState().update((a: any) => ({ ...a, methods: [...a.methods, // eslint-disable-line @typescript-eslint/no-explicit-any
    { id: "pm_ngn", kind: "card", brand: "verve", last4: "0000", name: "Verve ••• 0000", sub: "Debit", currency: "NGN" }] })));
  await widget.locator('[data-pm="pm_ngn"]').click();
  await expect(widget.locator("#quoteCard")).toHaveCount(0);
  await expect(widget.locator("#payGo")).toHaveText("Pay ₦36,270.00");

  await page.goto("/demo/ile-living");
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  await expect(page.getByTestId("checkout-widget").locator("#payGo")).toHaveText("Pay $23.40");
  await expect(page.getByTestId("checkout-widget").locator("#quoteCard")).toHaveCount(0);
});

test("bank transfer (Dynamic): getting the account, then the transfer arriving (demo actions disabled meanwhile)", async ({ page }) => {
  await page.clock.install();
  const widget = await ngnAddMethod(page);
  await widget.locator('[data-addpm="ngn-bank"]').click();
  await expect(widget.getByRole("heading", { name: "Getting your account" })).toBeVisible();
  await expect(widget.locator(".spinner")).toBeVisible();
  await expect(page.locator("#demoTransferArrives")).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(widget.locator("#transferDetails")).toBeVisible();

  await page.locator("#demoTransferArrives").click();
  await expect(page.locator("#demoTransferArrives")).toBeDisabled();
  await expect(page.locator("#demoTransferExpire")).toBeDisabled();
  await expect(widget.locator("#transferWaiting")).toBeVisible();
  await page.clock.runFor(1200);
  await expect(widget.getByRole("heading", { name: "Paid ₦36,270.00 to Ilé Living" })).toBeVisible();
});

test("bank transfer (Merchant pool): getting the account, then the pool's actions disabled while a transfer arrives", async ({ page }) => {
  await page.clock.install();
  const widget = await ngnAddMethod(page, () => page.getByLabel("Bank transfer account").selectOption("pool").then(() => {}));
  await widget.locator('[data-addpm="ngn-bank"]').click();
  await expect(widget.getByRole("heading", { name: "Getting your account" })).toBeVisible();
  await page.clock.runFor(600);
  await expect(widget.locator("#transferDetails")).toBeVisible();
  await page.locator("#demoPoolMore").click();
  for (const id of ["#demoPoolExact", "#demoPoolLess", "#demoPoolMore"]) await expect(page.locator(id)).toBeDisabled();
  await page.clock.runFor(1200);
  await expect(widget.locator("#transferResult")).toHaveText("We received ₦39,897.00. [handling]");
});

/** A new (Tier 0) user signs up for an NGN order of `kobo`. */
async function newUserNgnOrder(page: Page, kobo: number) {
  await page.goto("/demo/ile-living");
  await page.waitForFunction(() => (window as any).__checkout); // eslint-disable-line @typescript-eslint/no-explicit-any
  await page.evaluate((amount) => (window as any).__checkout.getState().start({ // eslint-disable-line @typescript-eslint/no-explicit-any
    merchant: "Ilé Living", orderRef: "ILV-10482", amount, currency: "NGN", customer: { email: "kemi.adeyemi@gmail.com", first: "Kemi", last: "Adeyemi" } }), kobo);
  const widget = page.getByTestId("checkout-widget");
  await widget.locator("#suTerms").check();
  await widget.locator("#suGo").click();
  await enterCode(page);
  return widget;
}

test("$500 rule (Tier 0): a naira total worth under $500 needs no ID check", async ({ page }) => {
  const widget = await newUserNgnOrder(page, 77499999); // ₦774,999.99 = $499.9999
  await expect(widget.getByRole("heading", { name: "Add a payment method" })).toBeVisible();
  await expect(widget.locator('[data-addpm="ngn-card"]')).toBeVisible();
});

test("$500 rule (Tier 0): a naira total worth $500 or more goes to the ID check", async ({ page }) => {
  let widget = await newUserNgnOrder(page, 77500000); // ₦775,000.00 = $500.00
  await expect(widget.getByRole("heading", { name: "Verify your identity" })).toBeVisible();
  await expect(widget).toContainText("Payments of $500 or more need a quick ID check (this one is ₦775,000.00).");

  widget = await newUserNgnOrder(page, 155000000); // ₦1,550,000.00 = $1,000
  await expect(widget.getByRole("heading", { name: "Verify your identity" })).toBeVisible();
});

test("$500 rule: a verified (Tier 1) user pays a naira order of $500 or more", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.waitForFunction(() => (window as any).__checkout); // eslint-disable-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => (window as any).__checkout.getState().start({ merchant: "Ilé Living", orderRef: "ILV-10482", amount: 77500000, currency: "NGN" })); // eslint-disable-line @typescript-eslint/no-explicit-any
  await expect(page.getByTestId("checkout-widget").getByRole("heading", { name: "Pay ₦775,000.00 to Ilé Living" })).toBeVisible();
});

test("bank transfer (Dynamic): less than the order shows what arrived and [handling], tells the merchant, and closes", async ({ page }) => {
  const widget = await ngnAddMethod(page);
  await widget.locator('[data-addpm="ngn-bank"]').click();
  await expect(widget.locator("#transferDetails")).toBeVisible();
  await page.locator("#demoTransferLess").click();
  await expect(widget.locator("#transferResult")).toHaveText("We received ₦32,643.00. [handling]");
  await expect(widget.locator("#transferWaiting")).toHaveCount(0);
  await expect(page.locator("#demoTransferArrives")).toHaveCount(0); // matched: nothing more to simulate
  const ev = page.getByTestId("events").locator("li", { hasText: "payment.amount_mismatch" });
  await expect(ev).toContainText('"order_reference":"ILV-10482"');
  await expect(ev).toContainText('"expected_amount":3627000,"received_amount":3264300,"rail":"ngn_bank_transfer","account_type":"dynamic"');
  await expect(page.getByTestId("events")).not.toContainText("payment.succeeded");
  // Matched: the countdown is gone (it doesn't later turn into "expired")
  await expect(widget.locator("#transferCount")).toHaveCount(0);
  await expect(widget.locator(".sub")).toHaveText("From any Nigerian bank app.");
  await widget.locator("#transferClose").click();
  await expect(widget).toHaveCount(0);
  await expect(page.getByTestId("events")).toContainText('"reason":"amount_mismatch"');
});

test("bank transfer (Dynamic): more than the order shows what arrived and [handling]", async ({ page }) => {
  await page.clock.install();
  const widget = await ngnAddMethod(page);
  await widget.locator('[data-addpm="ngn-bank"]').click();
  await page.clock.runFor(1000);
  await page.locator("#demoTransferMore").click();
  await page.clock.runFor(1200);
  await expect(widget.locator("#transferResult")).toHaveText("We received ₦39,897.00. [handling]");
  await expect(page.getByTestId("events").locator("li", { hasText: "payment.amount_mismatch" })).toContainText('"received_amount":3989700,"rail":"ngn_bank_transfer","account_type":"dynamic"');
  await page.clock.runFor(31 * 60 * 1000); // past the account's expiry: the result stays
  await expect(widget.locator("#transferResult")).toBeVisible();
  await expect(widget.getByRole("heading", { name: "This account expired" })).toHaveCount(0);
});

test("copy: curly apostrophes on the expired account and the declined card", async ({ page }) => {
  const widget = await ngnAddMethod(page);
  await widget.locator('[data-addpm="ngn-bank"]').click();
  await expect(widget.locator("#transferDetails")).toBeVisible();
  await page.locator("#demoTransferExpire").click();
  await expect(widget.locator("#transferExpired")).toContainText("Don’t send to the old account number.");
});
