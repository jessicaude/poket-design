import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * NGN statements: "Statement" on the NGN balance; a period (This month, Last month, Last 3 months, or a custom range up
 * to 12 months) and a format (PDF or CSV), then Download statement. The PDF: the account holder, the NGN account
 * details when there are any, the period, opening and closing balances, money in and out, and every transaction with
 * date, description, reference, amount and running balance. The CSV has the same columns. An empty period still
 * downloads, saying "No transactions in this period". Opening plus money in minus money out is the closing balance.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const DAY = 86400000;

/* ---------- the maths (lib/statement.ts) ---------- */

test("mock: opening and closing balances add up; running balances; periods", async () => {
  const st = await import("@/lib/statement");
  const now = new Date(2026, 10, 13, 15, 0); // Nov 13, 2026
  // A ledger from ₦50,000.00: September, October and November
  let bal = 5000000;
  const mk = (d: Date, delta: number, description: string) => { bal += delta; return { id: description, at: d.getTime(), delta, balance: bal, description, reference: "TXN-" + description.length }; };
  const entries = [
    mk(new Date(2026, 8, 20), 2500000, "From Chinedu Eze"),
    mk(new Date(2026, 9, 2), -500000, "To Ngozi Eze"),
    mk(new Date(2026, 9, 15), 1000000, "From Amara Okafor"),
    mk(new Date(2026, 9, 31, 23, 30), -1550000, "Converted NGN to USDC"),
    mk(new Date(2026, 10, 3), 300000, "Refund · Ilé Living"),
  ];
  const who = { holder: "Ada Osun", account: null };
  const last = st.buildStatement(entries, bal, st.periodRange("last_month", now), who);
  expect(last.opening).toBe(7500000); // after September's transfer
  expect(last.rows.map((r) => r.description)).toEqual(["To Ngozi Eze", "From Amara Okafor", "Converted NGN to USDC"]);
  expect(last.moneyIn).toBe(1000000);
  expect(last.moneyOut).toBe(2050000);
  expect(last.closing).toBe(last.opening + last.moneyIn - last.moneyOut);
  expect(last.closing).toBe(entries[3].balance); // the balance after October's last change
  expect(last.rows.map((r) => r.balance)).toEqual([7000000, 8000000, 6450000]);
  // Each period's closing is the next one's opening
  const thisMonth = st.buildStatement(entries, bal, st.periodRange("this_month", now), who);
  expect(thisMonth.opening).toBe(last.closing);
  expect(thisMonth.closing).toBe(bal);
  // Three months: from Aug 14
  const three = st.buildStatement(entries, bal, st.periodRange("last_3_months", now), who);
  expect(st.isoDay(three.from)).toBe("2026-08-14");
  expect(three.opening).toBe(5000000);
  expect(three.rows).toHaveLength(5);
  expect(three.closing).toBe(three.opening + three.moneyIn - three.moneyOut);
  // Nothing in it: opening is closing, and the files say so
  const empty = st.buildStatement(entries, bal, st.customRange("2026-08-01", "2026-08-31"), who);
  expect(empty.rows).toEqual([]);
  expect(empty.opening).toBe(5000000);
  expect(empty.closing).toBe(5000000);
  expect(st.statementCsv(empty).split("\r\n")).toEqual([
    "Date,Description,Reference,Status,Amount,Currency,Balance", "2026-08-01,Opening balance,,,,NGN,50000.00", ",No transactions in this period,,,,,", "2026-08-31,Closing balance,,,,NGN,50000.00", "",
  ]);
  // Status: its own, else Completed; a send's (by its id) as it is now
  expect(last.rows.map((r) => r.status)).toEqual(["Completed", "Completed", "Completed"]);
  const sendLine = { ...entries[1], withdrawalId: "wd_1" }, heldLine = { ...entries[2], status: "Held" as const };
  const resolved = st.buildStatement([entries[0], sendLine, heldLine, entries[3]], bal, st.periodRange("last_month", now), who, (e) => (e.withdrawalId ? "Reversed" : e.status ?? "Completed"));
  expect(resolved.rows.map((r) => r.status)).toEqual(["Reversed", "Held", "Completed"]);
  const csv = st.statementCsv(resolved).split("\r\n")[2].split(",");
  expect(csv.slice(1)).toEqual(["To Ngozi Eze", "TXN-12", "Reversed", "-5000.00", "NGN", "70000.00"]);
  expect(csv[0]).toMatch(/^2026-10-02 \d{2}:\d{2}$/);
  // No ledger at all: today's balance
  const none = st.buildStatement([], 1234500, st.periodRange("this_month", now), who);
  expect([none.opening, none.closing]).toEqual([1234500, 1234500]);
});

test("mock: a custom range is up to 12 months, in order, not in the future", async () => {
  const st = await import("@/lib/statement");
  const now = new Date(2026, 10, 13);
  expect(st.customRangeProblem("2025-11-14", "2026-11-13", now)).toBeNull(); // 12 months
  expect(st.customRangeProblem("2025-11-13", "2026-11-13", now)).toBe("Choose a range of up to 12 months.");
  expect(st.customRangeProblem("2026-11-10", "2026-11-01", now)).toBe("The end date can’t be before the start date.");
  expect(st.customRangeProblem("2026-11-01", "2026-11-20", now)).toBe("The end date can’t be in the future.");
  expect(st.customRangeProblem("", "2026-11-01", now)).toBe("Choose a start and end date.");
});

test("mock: the PDF is a valid text PDF with the statement on it", async () => {
  const st = await import("@/lib/statement");
  const at = new Date(2026, 10, 5).getTime();
  const s = st.buildStatement([{ id: "a", at, delta: 1000000, balance: 6000000, description: "From Amara Okafor", reference: "TXN-123456" }], 6000000,
    st.customRange("2026-11-01", "2026-11-13"), { holder: "Ada Osun", account: [["Account number", "0123456789"], ["Bank", "[Partner bank]"]] });
  const pdf = Buffer.from(st.statementPdf(s, "Ilé Living")).toString("latin1");
  expect(pdf.startsWith("%PDF-1.4")).toBe(true);
  const startxref = Number(/startxref\n(\d+)/.exec(pdf)![1]);
  expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
  pdfText(pdf); // parses
  expect(pdfText(pdf)).toEqual(expect.arrayContaining(["Ilé Living", "NGN statement", "Account holder", "Ada Osun", "Account number", "0123456789",
    "Period", "Nov 1, 2026 to Nov 13, 2026", "Opening balance", "NGN 50,000.00", "Money in", "NGN 10,000.00", "Money out", "NGN 0.00", "Closing balance", "NGN 60,000.00",
    "Date", "Description", "Reference", "Status", "Amount (NGN)", "Balance (NGN)",
    "From Amara Okafor", "TXN-123456", "Completed", "+10,000.00", "60,000.00", "Payments by Poket", "Page 1 of 1"]));
});

test("mock: a long statement runs onto more pages, the table's heading on each", async () => {
  const st = await import("@/lib/statement");
  let bal = 0;
  const entries = Array.from({ length: 120 }, (_, i) => { bal += 100000; return { id: String(i), at: new Date(2026, 10, 1, 9, i).getTime(), delta: 100000, balance: bal, description: `From Amara Okafor ${i}`, reference: `TXN-${100000 + i}` }; });
  const s = st.buildStatement(entries, bal, st.customRange("2026-11-01", "2026-11-13"), { holder: "Ada Osun", account: null });
  const t = pdfText(Buffer.from(st.statementPdf(s, "Poket")).toString("latin1"));
  const pages = Number(/^Page 1 of (\d+)$/.exec(t.find((x) => x.startsWith("Page 1 of "))!)![1]);
  expect(pages).toBeGreaterThan(1);
  expect(t.filter((x) => x === "Balance (NGN)")).toHaveLength(pages);
  expect(t.filter((x) => x === "Payments by Poket")).toHaveLength(pages);
  expect(t.filter((x) => /^TXN-1\d{5}$/.test(x))).toHaveLength(120);
  expect(t).toContain("120,000.00"); // the last running balance
});

/** The strings a PDF draws (Tj), with WinAnsi octal escapes decoded. */
function pdfText(pdf: string): string[] {
  const WIN: Record<number, string> = { 0x92: "’", 0x85: "…", 0x95: "•", 0x96: "–" };
  return [...pdf.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((m) => m[1].replace(/\\([0-7]{3}|.)/g, (_, e: string) => {
    if (e.length === 3) { const c = parseInt(e, 8); return WIN[c] ?? String.fromCharCode(c); }
    return e;
  }));
}

test("mock: Ada's seeded history: about three months, every kind, ending at the starting balance", async () => {
  const st = await import("@/lib/statement");
  const api = await import("@/lib/mock-api");
  const now = new Date(2026, 10, 13, 15, 0);
  const h = api.buildAdaHistory(now);
  const seed = h.lines.map((l, i) => ({ id: String(i), ...l }));
  // From nothing to ₦50,000.00, each balance following from the one before
  expect(seed[0].balance - seed[0].delta).toBe(0);
  seed.forEach((e, i) => { if (i) expect(e.balance).toBe(seed[i - 1].balance + e.delta); });
  expect(seed.at(-1)!.balance).toBe(5000000);
  expect(seed.every((e) => e.at < now.getTime())).toBe(true);
  const d = seed.map((e) => e.description);
  for (const kind of [/^Top-up/, /^To Naira account$/, /^To Amara Okafor$/, /^Converted NGN to/, /^Refund · /, /^Returned · /]) expect(d.some((x) => kind.test(x))).toBe(true);
  // A send that came back: both lines Returned, one reference; every other reference unique
  const back = seed.filter((e) => e.status === "Returned");
  expect(back.map((e) => e.delta)).toEqual([-800000, 800000]);
  expect(back[0].reference).toBe(back[1].reference);
  expect(new Set(seed.map((e) => e.reference)).size).toBe(seed.length - 1);
  // Every period has transactions, and adds up
  const who = { holder: "Ada Osun", account: null };
  for (const p of ["this_month", "last_month", "last_3_months"] as const) {
    const s = st.buildStatement(seed, 5000000, st.periodRange(p, now), who);
    expect(s.rows.length, p).toBeGreaterThan(0);
    expect(s.closing).toBe(s.opening + s.moneyIn - s.moneyOut);
  }
  expect(st.buildStatement(seed, 5000000, st.periodRange("this_month", now), who).closing).toBe(5000000);
  // Early in a month there's still one this month
  const first = new Date(2026, 10, 1, 8, 0);
  const early = api.buildAdaHistory(first).lines.map((l, i) => ({ id: String(i), ...l }));
  expect(st.buildStatement(early, 5000000, st.periodRange("this_month", first), who).rows).toHaveLength(1);

  // Each line is a real record with the same reference and time: credits, sends (Tobi Bello's failed), the
  // conversion, the payment's refund into the NGN balance
  const byRef = (r: string) => seed.filter((e) => e.reference === r);
  for (const c of h.credits) expect(byRef(c.ref).map((e) => [e.at, e.delta])).toEqual([[c.at, c.amount]]);
  expect(h.sends.map((w) => [w.recipientName, w.status])).toEqual([["Naira account", "paid"], ["Amara Okafor", "paid"], ["Tobi Bello", "failed"]]);
  for (const w of h.sends) expect(byRef(w.ref)[0]).toMatchObject({ at: w.createdAt, delta: -w.amount, withdrawalId: w.id });
  expect(byRef(h.sends[2].ref).map((e) => e.description)).toEqual(["To Tobi Bello", "Returned · To Tobi Bello"]);
  const cv = h.conversions[0];
  expect(byRef(cv.ref)).toEqual([expect.objectContaining({ at: cv.createdAt, delta: -cv.amount, description: "Converted NGN to USD" })]);
  const pay = h.payments[0], refund = pay.refunds![0];
  expect(pay).toMatchObject({ merchant: "Mama Tee’s Kitchen", currency: "NGN", methodKind: "bank" });
  expect(new Date(pay.at).getTime()).toBeLessThan(new Date(refund.at).getTime());
  expect(refund).toMatchObject({ to: "ngn", inBalance: true });
  expect(byRef(refund.id)).toEqual([expect.objectContaining({ at: new Date(refund.at).getTime(), delta: refund.amount })]);
  // Every line has its record
  const refs = new Set([...h.credits.map((c) => c.ref), ...h.sends.map((w) => w.ref), cv.ref, refund.id]);
  expect(seed.every((e) => refs.has(e.reference))).toBe(true);
});

/* ---------- the wallet ---------- */

async function wallet(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
}
const ngn = (page: Page) => page.evaluate(() => (window as any).__ngn.getState().ngnBalance as number);
async function openStatement(page: Page) {
  await page.locator('[data-wallettab="cash"]').click();
  await page.locator('[data-holdcur="NGN"][data-holdbucket="open"] .tx-title').click();
  await page.locator("#ngnStatement").click();
  await expect(page.locator("#panelBody .step-title")).toHaveText("Statement");
}
async function download(page: Page, format: "pdf" | "csv") {
  await page.locator(`[data-format="${format}"]`).click();
  const [d] = await Promise.all([page.waitForEvent("download"), page.locator("#downloadStatement").click()]);
  return { name: d.suggestedFilename(), body: readFileSync((await d.path())!) };
}
/** "50000.00" → kobo. */
const kobo = (s: string) => Math.round(Number(s) * 100);
const CSV_HEAD = ["Date", "Description", "Reference", "Status", "Amount", "Currency", "Balance"];
/** The CSV's rows (no quoted commas in the demo's text). */
const csvRows = (body: Buffer) => body.toString("utf8").trim().split("\r\n").map((l) => l.split(","));
/** A CSV adds up: each balance follows from the one before; opening + in - out = closing. */
function addsUp(rows: string[][]) {
  expect(rows[0]).toEqual(CSV_HEAD);
  expect(rows[1].slice(1, 6)).toEqual(["Opening balance", "", "", "", "NGN"]);
  expect(rows.at(-1)!.slice(1, 6)).toEqual(["Closing balance", "", "", "", "NGN"]);
  const opening = kobo(rows[1][6]), closing = kobo(rows.at(-1)![6]);
  let running = opening, moneyIn = 0, moneyOut = 0;
  for (const r of rows.slice(2, -1)) {
    if (r[1] === "No transactions in this period") continue;
    expect(r[4]).toMatch(/^-?\d+\.\d{2}$/); // a plain number
    expect(r[5]).toBe("NGN");
    const a = kobo(r[4]);
    running += a;
    if (a > 0) moneyIn += a; else moneyOut -= a;
    expect(kobo(r[6])).toBe(running);
  }
  expect(closing).toBe(opening + moneyIn - moneyOut);
  expect(closing).toBe(running);
  return { opening, closing, moneyIn, moneyOut };
}

/** A ₦5,000.00 send to the Naira account (paid before: Sending at once). */
async function send(page: Page) {
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  await page.locator("#youSend").click();
  for (const d of "500000") await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toBeVisible();
  return (await page.locator("#copyRefBtn").textContent())!.trim();
}

test("This month as CSV: seeded and new lines, their status, running balances; it adds up to the balance", async ({ page }) => {
  test.setTimeout(60000);
  await wallet(page);
  await page.locator("#demoPoketTransfer").click();
  const ref = await send(page); // Sending: Pending
  await page.locator("#backFromTxDetail").click();
  await openStatement(page);
  await expect(page.locator("[data-period] .t1")).toHaveText(["This month", "Last month", "Last 3 months", "Custom range"]);
  await expect(page.locator('[data-period="this_month"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('[data-format="pdf"]')).toHaveAttribute("aria-checked", "true");

  const { name, body } = await download(page, "csv");
  const now = new Date(), iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  expect(name).toBe(`ngn-statement-${iso(new Date(now.getFullYear(), now.getMonth(), 1))}-to-${iso(now)}.csv`);
  const rows = csvRows(body);
  const sums = addsUp(rows);
  expect(sums.closing).toBe(await ngn(page));
  const tx = rows.slice(2, -1);
  // This month's seeded top-up first, then today's
  expect(tx.map((r) => [r[1], r[3], r[4]])).toEqual([
    ["Top-up · Bank transfer", "Completed", "11500.00"], ["From Amara Okafor", "Completed", "10000.00"], ["To Naira account", "Pending", "-5000.00"],
  ]);
  expect(tx[2][2]).toBe(ref);
  for (const r of tx) expect(r[0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  await expect(page.locator("#toastEl")).toHaveText("Statement downloaded");

  // The send's status follows it: held, then failed (both its lines Returned)
  await page.locator("#backFromStatement").click();
  await page.locator('#ngnHistory [data-txid^="wd_"]:not([data-txid*="seed"])').click();
  await page.getByRole("button", { name: "Hold for review" }).click();
  await page.locator("#backFromTxDetail").click();
  await page.locator("#ngnStatement").click();
  expect(csvRows((await download(page, "csv")).body).slice(2, -1).map((r) => r[3])).toEqual(["Completed", "Completed", "Held"]);
  await page.locator("#backFromStatement").click();
  await page.locator('#ngnHistory [data-txid^="wd_"]:not([data-txid*="seed"])').click();
  await page.getByRole("button", { name: "Fail" }).click();
  await page.locator("#backFromTxDetail").click();
  await page.locator("#ngnStatement").click();
  const failed = csvRows((await download(page, "csv")).body);
  expect(failed.slice(2, -1).map((r) => [r[1], r[2], r[3]])).toEqual([
    ["Top-up · Bank transfer", expect.stringMatching(/^TXN-\d{6}$/), "Completed"], ["From Amara Okafor", expect.stringMatching(/^TXN-\d{6}$/), "Completed"],
    ["To Naira account", ref, "Returned"], ["Returned · To Naira account", ref, "Returned"],
  ]);
  expect(addsUp(failed).closing).toBe(await ngn(page));
});

test("every period has transactions in the demo; Last month, Last 3 months and the full history add up", async ({ page }) => {
  await wallet(page);
  await openStatement(page);
  await page.locator('[data-period="last_month"]').click();
  const last = csvRows((await download(page, "csv")).body);
  const l = addsUp(last);
  expect(last.slice(2, -1).map((r) => r[1])).toEqual(["To Amara Okafor", "Converted NGN to USD", "Refund · Mama Tee’s Kitchen", "To Tobi Bello", "Returned · To Tobi Bello"]);
  expect(last.slice(2, -1).map((r) => r[3])).toEqual(["Completed", "Completed", "Completed", "Returned", "Returned"]);
  // This month opens where last month closed
  await page.locator('[data-period="this_month"]').click();
  expect(addsUp(csvRows((await download(page, "csv")).body)).opening).toBe(l.closing);
  // Three months
  await page.locator('[data-period="last_3_months"]').click();
  const three = csvRows((await download(page, "csv")).body);
  expect(three.length - 3).toBeGreaterThanOrEqual(8);
  addsUp(three);
  // Everything up to 12 months: from nothing to the starting balance
  await page.locator('[data-period="custom"]').click();
  const today = new Date(), iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await page.locator("#statementFrom").fill(iso(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1)));
  const all = addsUp(csvRows((await download(page, "csv")).body));
  expect(all.opening).toBe(0);
  expect(all.closing).toBe(5000000);
  expect(all.closing).toBe(await ngn(page));
});

test("PDF: account holder, NGN account details, period, balances, totals, and each transaction with its status", async ({ page }) => {
  await wallet(page);
  await page.evaluate(() => (window as any).__ngn.getState().set({ dedicated: { status: "ready", num: "0123456789" } }));
  await page.locator("#demoAccountTransfer").click();
  await page.locator("#demoPoketTransfer").click();
  await openStatement(page);
  const { name, body } = await download(page, "pdf");
  expect(name).toMatch(/^ngn-statement-\d{4}-\d{2}-01-to-\d{4}-\d{2}-\d{2}\.pdf$/);
  const pdf = body.toString("latin1");
  expect(pdf.startsWith("%PDF-1.4")).toBe(true);
  const t = pdfText(pdf);
  const after = (label: string) => t[t.indexOf(label) + 1];
  expect(after("Account holder")).toBe("Ada Osun");
  expect(after("Account name")).toBe("Ada Osun");
  expect(after("Account number")).toBe("0123456789");
  expect(after("Bank")).toBe("[Partner bank]");
  expect(after("Period")).toMatch(/^[A-Z][a-z]{2} 1, \d{4} to [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  const money = (label: string) => Math.round(Number(after(label).replace(/^NGN /, "").replace(/,/g, "")) * 100);
  expect(money("Opening balance")).toBe(3850000); // after last month's seeded history
  expect(money("Money in")).toBe(1150000 + 2500000 + 1000000);
  expect(money("Money out")).toBe(0);
  expect(money("Closing balance")).toBe(money("Opening balance") + money("Money in") - money("Money out"));
  expect(money("Closing balance")).toBe(await ngn(page));
  // The table: each line's date, description, reference, status, amount and running balance, in order
  const row = (desc: string) => t.slice(t.indexOf(desc) - 1, t.indexOf(desc) + 5);
  expect(t).toEqual(expect.arrayContaining(["Date", "Description", "Reference", "Status", "Amount (NGN)", "Balance (NGN)", "Payments by Poket"]));
  expect(row("From Chinedu Eze")).toEqual([expect.stringMatching(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/), "From Chinedu Eze", expect.stringMatching(/^TXN-\d{6}$/), "Completed", "+25,000.00", "75,000.00"]);
  expect(row("From Amara Okafor").slice(3)).toEqual(["Completed", "+10,000.00", "85,000.00"]);
});

test("a period with no transactions still downloads, saying so; no account details without an account", async ({ page }) => {
  await wallet(page);
  await openStatement(page);
  await page.locator('[data-period="custom"]').click();
  const today = new Date(), iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Before the seeded history begins
  await page.locator("#statementFrom").fill(iso(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1)));
  await page.locator("#statementTo").fill(iso(new Date(today.getFullYear() - 1, today.getMonth() + 1, today.getDate())));
  const csv = csvRows((await download(page, "csv")).body);
  expect(csv.map((r) => r[1])).toEqual(["Description", "Opening balance", "No transactions in this period", "Closing balance"]);
  expect([csv[1][6], csv[3][6]]).toEqual(["0.00", "0.00"]);
  addsUp(csv);
  const t = pdfText((await download(page, "pdf")).body.toString("latin1"));
  expect(t).toContain("No transactions in this period");
  expect(t).not.toContain("Account number");
  expect(t[t.indexOf("Opening balance") + 1]).toBe("NGN 0.00");
  expect(t[t.indexOf("Closing balance") + 1]).toBe("NGN 0.00");
});

test("custom range: up to 12 months; the button waits for a valid range", async ({ page }) => {
  await wallet(page);
  await openStatement(page);
  await page.locator('[data-period="custom"]').click();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const today = new Date();
  await page.locator("#statementFrom").fill(iso(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())));
  await page.locator("#statementTo").fill(iso(today));
  await expect(page.locator("#statementRangeMsg")).toHaveText("Choose a range of up to 12 months.");
  await expect(page.locator("#downloadStatement")).toBeDisabled();
  await page.locator("#statementFrom").fill(iso(new Date(today.getTime() + 2 * DAY)));
  await expect(page.locator("#statementRangeMsg")).toHaveText("The end date can’t be before the start date.");
  const from = iso(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1));
  await page.locator("#statementFrom").fill(from);
  await expect(page.locator("#statementRangeMsg")).toHaveCount(0);
  const { name, body } = await download(page, "csv");
  expect(name).toBe(`ngn-statement-${from}-to-${iso(today)}.csv`);
  expect(csvRows(body)[1]).toEqual([from, "Opening balance", "", "", "", "NGN", "0.00"]);
});

test("mock: references stay unique even when Math.random repeats", async () => {
  const api = await import("@/lib/mock-api");
  const random = Math.random;
  Math.random = () => 0.5;
  try {
    const refs = Array.from({ length: 50 }, () => api.genRef());
    expect(new Set(refs).size).toBe(50);
  } finally { Math.random = random; }
});

test("Ada's seeded history is in the wallet too: each record opens its receipt, with its statement line's reference", async ({ page }) => {
  test.setTimeout(60000);
  await wallet(page);
  await openStatement(page);
  await page.locator('[data-period="custom"]').click();
  const today = new Date(), iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await page.locator("#statementFrom").fill(iso(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1)));
  const lines = csvRows((await download(page, "csv")).body).slice(2, -1);
  expect(lines).toHaveLength(9);
  await page.locator("#backFromStatement").click();

  // The NGN balance's history: the 8 seeded records (Tobi Bello's send is one record for its 2 statement lines)
  const seeded = page.locator('#ngnHistory .tx-row[data-txid*="seed"]');
  await expect(seeded).toHaveCount(8);
  const ids = await seeded.evaluateAll((els) => els.map((e) => e.getAttribute("data-txid")!));
  const seen: Record<string, string> = {};
  for (const id of ids) {
    const row = page.locator(`#ngnHistory [data-txid="${id}"]`);
    const title = (await row.locator(".tx-title").textContent())!.trim();
    await row.click();
    const ref = (await page.locator("#copyRefBtn").textContent())!.trim();
    seen[title + " " + id] = ref;
    // Its statement line(s), by reference
    const mine = lines.filter((l) => l[2] === ref);
    expect(mine.length, title).toBeGreaterThan(0);
    expect(mine[0][1]).toBe(title);
    // Its receipt
    await page.locator("#shareReceipt").click();
    await expect(page.locator("#receiptSheet .rc-row[data-label=\"Reference\"] > span:last-child")).toHaveText(ref);
    await page.locator("#receiptClose").click();
    await page.locator("#backFromTxDetail").click();
  }
  // Tobi Bello: failed, its money returned (both lines, one reference)
  await page.locator('#ngnHistory [data-txid="wd_seed3"]').click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Failed");
  await page.locator("#shareReceipt").click();
  await expect(page.locator("#receiptNotice")).toHaveText("Failed: this payment wasn’t sent. The money was returned to your balance.");
  const tobi = (await page.locator('#receiptSheet .rc-row[data-label="Reference"] > span:last-child').textContent())!.trim();
  expect(lines.filter((l) => l[2] === tobi).map((l) => [l[1], l[3]])).toEqual([["To Tobi Bello", "Returned"], ["Returned · To Tobi Bello", "Returned"]]);
  // Every statement line belongs to one of them
  expect(lines.every((l) => Object.values(seen).includes(l[2]))).toBe(true);
});
