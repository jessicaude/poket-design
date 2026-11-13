import { test, expect, type Page } from "@playwright/test";

/**
 * WGT-11, NGN history, receipts and statements. History: the reference’s activity rows, grouped by day, with status
 * chips and the filter All, Money in, Money out (a conversion shows under All only). Detail: every transaction has
 * the same rows in the same order (Status, Date, From, To, Method, You send, They get, Rate, Refunded, Reversed,
 * Fee, Reference, Session ID), a unique reference in the copyable chip and, for a bank transfer, the bank’s session
 * ID as "[session ID]". The audit found naira coming into the NGN balance with no record at all (temporary-account
 * top-ups, transfers to the account details, delayed transfers, naira from Poket users, recovered recalls): each is
 * now its own record with a receipt.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const FIELD_ORDER = ["Status", "Date", "From", "To", "Method", "You send", "They get", "Rate", "Refunded", "Reversed", "Fee", "Reference", "Session ID"];
const ngn = (page: Page) => page.evaluate(() => (window as any).__ngn.getState().ngnBalance as number);

async function wallet(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
}
/** The open detail’s row labels. */
const labels = (page: Page) => page.locator("#txDetail .info-row > span:first-child").allTextContents();
/** Labels in FIELD_ORDER’s order, none unknown. */
function inOrder(ls: string[]) {
  const idx = ls.map((l) => FIELD_ORDER.indexOf(l.trim()));
  expect(idx.every((i) => i >= 0), `unknown label in ${ls.join(", ")}`).toBe(true);
  expect(idx).toEqual([...idx].sort((a, b) => a - b));
}
async function openNgnBalance(page: Page) {
  await page.locator('[data-wallettab="cash"]').click();
  await page.locator('[data-holdcur="NGN"][data-holdbucket="open"] .tx-title').click();
  await expect(page.locator("#ngnBalanceAmount")).toBeVisible();
}

test("Activity: rows grouped by day; All, Money in, Money out", async ({ page }) => {
  await wallet(page);
  await page.locator("#tabActivity").click();
  const h = page.locator("#activityHistory");
  const filters = h.locator("[data-histfilter]");
  await expect(filters).toHaveText(["All", "Money in", "Money out"]);
  await expect(filters.first()).toHaveAttribute("aria-pressed", "true");
  // Day headings, newest first; every row sits under one
  const days = h.locator("[data-histday]");
  for (const d of await days.allTextContents()) expect(d).toMatch(/^(Today|Yesterday|[A-Z][a-z]{2} \d{1,2}, \d{4})$/);
  expect(new Set(await days.allTextContents()).size).toBe(await days.count());
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  await expect(h.locator(`[data-histday="${twoDaysAgo}"] + .section-card [data-payment="pay_mtk2291"]`)).toHaveCount(1);
  // The reference’s 3 records, Ada’s 4 Checkout payments and her 8 seeded naira records (3 credits, 3 sends, a
  // conversion, a refund)
  await expect(h.locator(".tx-row")).toHaveCount(15);
  const titles = async () => (await h.locator(".tx-title").allTextContents()).sort();

  await h.locator('[data-histfilter="in"]').click();
  await expect(h.locator('[data-histfilter="in"]')).toHaveAttribute("aria-pressed", "true");
  expect(await titles()).toEqual(["From Chinedu Eze", "Refund · Kola Books", "Refund · Mama Tee’s Kitchen", "Top-up · Bank transfer", "Top-up · Bank transfer", "Top-up · Visa ····4242"]);
  for (const a of await h.locator(".tx-amt").allTextContents()) expect(a).toMatch(/^\+/);
  await h.locator('[data-histfilter="out"]').click();
  expect(await titles()).toEqual(["Adire Market", "Ilé Living", "Mama Tee’s Kitchen", "Mama Tee’s Kitchen", "Sooyah Bistro", "To Amara Okafor", "To Naira account", "To Tobi Bello"]);
  for (const a of await h.locator(".tx-amt").allTextContents()) expect(a).toMatch(/^-/);
  // Tobi Bello’s send failed: its chip says so
  await expect(h.locator('[data-txid="wd_seed3"] .va-status')).toHaveText("Failed");
  await h.locator('[data-histfilter="all"]').click();
  await expect(h.locator(".tx-row")).toHaveCount(15);
  await expect(h.locator('[data-txid="cv_seed1"] .tx-title')).toHaveText("Converted NGN to USD"); // under All only
});

test("a payment’s row carries its status chip unless it’s completed", async ({ page }) => {
  await wallet(page);
  await page.locator("#tabActivity").click();
  await expect(page.locator('[data-payment="pay_ilv10077"] .va-status')).toHaveCount(0);
  await page.locator('[data-payment="pay_ilv10077"]').click();
  await page.locator("#demoRefundFull").click();
  await page.locator("#backFromTxDetail").click();
  await expect(page.locator('[data-payment="pay_ilv10077"] .va-status')).toHaveText("Refunded");
});

test("deposits and transfers in are records: top-up, account details, delayed, Poket user; their receipts", async ({ page }) => {
  await wallet(page);
  const before = await ngn(page);
  // A temporary-account top-up (₦10,000.00), as the Deposit flow makes it
  await page.evaluate(async () => { const s = (window as any).__ngn.getState(); await s.createTemp(1000000); await s.transferArrives(); (window as any).__ngn.getState().close(); });
  // The NGN account details: a transfer in
  await page.evaluate(() => (window as any).__ngn.getState().set({ dedicated: { status: "ready", num: "0123456789" } }));
  await page.locator("#demoAccountTransfer").click();
  // Naira from a Poket user
  await page.locator("#demoPoketTransfer").click();
  // One that arrived while the partner was down: credited when it’s back
  await page.getByLabel("Naira partner").selectOption("down");
  await expect(page.locator("#demoAccountTransfer")).toHaveCount(0);
  await page.locator("#demoQueuedArrival").click();
  await page.getByLabel("Naira partner").selectOption("up");
  await expect.poll(() => ngn(page)).toBe(before + 1000000 + 2500000 + 1000000 + 2500000);

  await openNgnBalance(page);
  const h = page.locator("#ngnHistory");
  await expect(h.locator('[data-credit]:not([data-txid*="seed"])')).toHaveCount(4);
  await expect(h.locator('[data-credit]:not([data-txid*="seed"]) .tx-title')).toHaveText(["From Chinedu Eze", "From Amara Okafor", "From Chinedu Eze", "Top-up · Bank transfer"]);
  await expect(h.locator('[data-credit]:not([data-txid*="seed"]) .tx-sub')).toHaveText(["NGN account details · Delayed", "Poket", "NGN account details", "Temporary account"]);
  await expect(h.locator('[data-credit]:not([data-txid*="seed"]) .tx-amt')).toHaveText(["+₦25,000.00 NGN", "+₦10,000.00 NGN", "+₦25,000.00 NGN", "+₦10,000.00 NGN"]);
  await expect(h.locator("[data-histday]").first()).toHaveText("Today");
  await h.locator('[data-histfilter="out"]').click();
  // Money out: Ada’s seeded sends, none of the credits
  await expect(h.locator(".tx-row")).not.toHaveCount(0);
  await expect(h.locator("[data-credit]")).toHaveCount(0);
  for (const a of await h.locator(".tx-amt").allTextContents()) expect(a).toMatch(/^-/);
  await h.locator('[data-histfilter="in"]').click();

  const refs = new Set<string>();
  const expectations: [string, string, string, boolean][] = [
    ["delayed", "Chinedu Eze · Zenith Bank", "Bank transfer · NGN account details", true],
    ["poket", "Amara Okafor", "Poket", false],
    ["account", "Chinedu Eze · Zenith Bank", "Bank transfer · NGN account details", true],
    ["temp", "Ada Osun", "Bank transfer · Temporary account", true],
  ];
  for (const [kind, from, method, bank] of expectations) {
    await h.locator(`[data-credit="${kind}"]:not([data-txid*="seed"])`).click();
    const ls = await labels(page);
    inOrder(ls);
    expect(ls).toEqual(["Status", "Date", "From", "To", "Method", "Fee", "Reference", ...(bank ? ["Session ID"] : [])]);
    const row = (l: string) => page.locator(`#txDetail .info-row[data-label="${l}"] > span:last-child`);
    await expect(row("Status")).toHaveText("Completed");
    await expect(row("From")).toHaveText(from);
    await expect(row("To")).toHaveText("NGN balance");
    await expect(row("Method")).toHaveText(method);
    await expect(row("Fee")).toHaveText("Free");
    if (bank) await expect(row("Session ID")).toHaveText("[session ID]");
    await expect(page.locator("#creditDelayed")).toHaveCount(kind === "delayed" ? 1 : 0);
    const ref = (await page.locator("#copyRefBtn").textContent())!.trim();
    expect(ref).toMatch(/^TXN-\d{6}$/);
    refs.add(ref);
    await page.locator("#copyRefBtn").click();
    await expect(page.locator("#toastEl")).toHaveText("Reference copied");
    await page.locator("#backFromTxDetail").click();
  }
  expect(refs.size).toBe(4);
  // A notification for each transfer in
  await page.locator("#openNotifHeader").click();
  await expect(page.locator("#panelBody [data-notif]").filter({ hasText: "₦10,000.00 from Amara Okafor added to your NGN balance." })).toHaveCount(1);
  await expect(page.locator("#panelBody [data-notif]").filter({ hasText: "₦25,000.00 from Chinedu Eze added to your NGN balance." })).toHaveCount(1);
});

test("the NGN balance’s history: what moved the balance, not card payments", async ({ page }) => {
  await wallet(page);
  await page.locator("#demoPoketTransfer").click();
  await openNgnBalance(page);
  const h = page.locator("#ngnHistory");
  // Ada’s 8 seeded records that moved it (the refund into it, not the payment it refunds), and today’s
  await expect(h.locator(".tx-row")).toHaveCount(9);
  await expect(h.locator('.tx-row:not([data-txid*="seed"])')).toHaveCount(1);
  await expect(h.locator('[data-refund="rf_seedmtk"]')).toHaveCount(1);
  await expect(h.locator("[data-payment]")).toHaveCount(0);
  await expect(h.locator("[data-histfilter]")).toHaveText(["All", "Money in", "Money out"]);
});

test("mock: references are unique; a credit needs a positive amount", async () => {
  const api = await import("@/lib/mock-api");
  const refs = new Set(Array.from({ length: 5000 }, () => api.genRef()));
  expect(refs.size).toBe(5000);
  const c = api.recordNgnCredit({ kind: "poket", amount: 100, from: "Amara Okafor" });
  expect(c.ref).toMatch(/^TXN-\d{6}$/);
  expect(api.listNgnCredits()[0].id).toBe(c.id);
  expect(() => api.recordNgnCredit({ kind: "poket", amount: 0, from: "x" })).toThrow();
});
