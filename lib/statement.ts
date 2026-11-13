/**
 * NGN statements (NEW): a period's opening and closing balances, money in and out, and every change to the balance
 * with its running balance; as CSV, or as a text PDF (Helvetica; amounts in NGN columns, as standard PDF fonts have
 * no naira sign). Pure, so it's tested directly.
 */
import type { Kobo } from "./money";

/** A transaction's status on a statement. */
export type StatementStatus = "Completed" | "Pending" | "Held" | "Returned" | "Reversed";
/**
 * A change to the NGN balance (features/wallet/history/ledger.ts): `balance` is the balance after it. A send's
 * changes keep its id, so their status is the send's as it is now; others carry their own (else Completed).
 */
export type LedgerEntry = { id: string; at: number; delta: Kobo; balance: Kobo; description: string; reference: string; status?: StatementStatus; withdrawalId?: string };

export type StatementPeriod = "this_month" | "last_month" | "last_3_months" | "custom";
export const PERIOD_LABEL: Record<StatementPeriod, string> = { this_month: "This month", last_month: "Last month", last_3_months: "Last 3 months", custom: "Custom range" };
/** A custom range can cover up to 12 months. */
export const MAX_MONTHS = 12;
export const NO_TRANSACTIONS = "No transactions in this period";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
/** "2026-11-13" (local). */
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** "2026-11-13" → that local day. */
export const parseDay = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
/** "Nov 13, 2026". */
export const longDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The period's first and last day (to the end of it). This month and the last 3 months run to today. */
export function periodRange(p: Exclude<StatementPeriod, "custom">, now = new Date()): { from: Date; to: Date } {
  if (p === "this_month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
  if (p === "last_month") return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)) };
  const from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate() + 1);
  return { from: startOfDay(from), to: endOfDay(now) };
}

/** A custom range's problem, if any (NEW copy): both dates, in order, not in the future, up to 12 months. */
export function customRangeProblem(fromS: string, toS: string, now = new Date()): string | null {
  const from = parseDay(fromS), to = parseDay(toS);
  if (!from || !to) return "Choose a start and end date.";
  if (to < from) return "The end date can’t be before the start date.";
  if (to > endOfDay(now)) return "The end date can’t be in the future.";
  const limit = new Date(to.getFullYear(), to.getMonth() - MAX_MONTHS, to.getDate() + 1);
  if (from < limit) return `Choose a range of up to ${MAX_MONTHS} months.`;
  return null;
}
export const customRange = (fromS: string, toS: string) => ({ from: startOfDay(parseDay(fromS)!), to: endOfDay(parseDay(toS)!) });

export type StatementRow = { at: number; description: string; reference: string; status: StatementStatus; amount: Kobo; balance: Kobo };
export type Statement = {
  holder: string;
  /** The NGN account details, when there are any: [label, value]. */
  account: [string, string][] | null;
  from: Date; to: Date;
  opening: Kobo; closing: Kobo; moneyIn: Kobo; moneyOut: Kobo;
  rows: StatementRow[];
};

/**
 * The period's statement from the ledger. Opening: the balance after the last change before the period (else before
 * the first change ever, else today's balance). Closing: opening plus every change in it, which is the balance after
 * its last change.
 */
export function buildStatement(entries: LedgerEntry[], currentBalance: Kobo, range: { from: Date; to: Date }, who: { holder: string; account: [string, string][] | null },
  statusOf: (e: LedgerEntry) => StatementStatus = (e) => e.status ?? "Completed"): Statement {
  const sorted = [...entries].sort((a, b) => a.at - b.at);
  const before = sorted.filter((e) => e.at < range.from.getTime());
  const inside = sorted.filter((e) => e.at >= range.from.getTime() && e.at <= range.to.getTime());
  const opening = before.length ? before[before.length - 1].balance : sorted.length ? sorted[0].balance - sorted[0].delta : currentBalance;
  let running = opening, moneyIn = 0, moneyOut = 0;
  const rows = inside.map((e) => {
    running += e.delta;
    if (e.delta > 0) moneyIn += e.delta; else moneyOut -= e.delta;
    return { at: e.at, description: e.description, reference: e.reference, status: statusOf(e), amount: e.delta, balance: running };
  });
  return { holder: who.holder, account: who.account, from: range.from, to: range.to, opening, closing: running, moneyIn, moneyOut, rows };
}

/** Kobo as "5,000.00" (negative "-5,000.00"). */
export const naira = (k: Kobo) => `${k < 0 ? "-" : ""}${(Math.abs(k) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
/** Kobo as a plain number for CSV: "-5000.00". */
const plain = (k: Kobo) => `${k < 0 ? "-" : ""}${Math.floor(Math.abs(k) / 100)}.${String(Math.abs(k) % 100).padStart(2, "0")}`;
const csvDate = (at: number) => { const d = new Date(at); return `${isoDay(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The PDF's table; the CSV's columns are the same, its amounts plain numbers with their Currency. */
export const PDF_COLUMNS = ["Date", "Description", "Reference", "Status", "Amount (NGN)", "Balance (NGN)"];
export const CSV_COLUMNS = ["Date", "Description", "Reference", "Status", "Amount", "Currency", "Balance"];
/** CSV: the transactions, opened and closed by the balances (an empty period says so between them). */
export function statementCsv(s: Statement): string {
  const lines = [CSV_COLUMNS,
    [isoDay(s.from), "Opening balance", "", "", "", "NGN", plain(s.opening)],
    ...(s.rows.length ? s.rows.map((r) => [csvDate(r.at), r.description, r.reference, r.status, plain(r.amount), "NGN", plain(r.balance)]) : [["", NO_TRANSACTIONS, "", "", "", "", ""]]),
    [isoDay(s.to), "Closing balance", "", "", "", "NGN", plain(s.closing)],
  ];
  return lines.map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
export const statementFileName = (s: Statement, ext: "pdf" | "csv") => `ngn-statement-${isoDay(s.from)}-to-${isoDay(s.to)}.${ext}`;

/* ---------- PDF ---------- */

/** WinAnsi for Helvetica: Latin-1 as is, the few punctuation marks the wallet uses, anything else "?". */
const WIN: Record<string, number> = { "’": 0x92, "‘": 0x91, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "…": 0x85 };
function winAnsi(s: string): string {
  let out = "";
  for (const ch of s.replace(/₦/g, "NGN ").replace(/→/g, "->")) {
    const c = ch.codePointAt(0)!;
    const b = WIN[ch] ?? (c < 0x20 ? 0x20 : c <= 0xff ? c : 0x3f);
    out += b === 0x28 || b === 0x29 || b === 0x5c ? "\\" + String.fromCharCode(b) : b < 0x80 ? String.fromCharCode(b) : "\\" + b.toString(8).padStart(3, "0");
  }
  return out;
}
/** Helvetica's widths (per 1000) for what's right-aligned: amounts. */
const W_HELV: Record<string, number> = { ",": 278, ".": 278, "-": 333, " ": 278 };
const textWidth = (s: string, size: number) => [...s].reduce((w, c) => w + (W_HELV[c] ?? 556), 0) * size / 1000;
const fit = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** The PDF: A4, the header and summary on page 1, the table across pages, "Payments by Poket" and page numbers. */
export function statementPdf(s: Statement, brandName: string): Uint8Array {
  const A4 = { w: 595.28, h: 841.89 }, M = 42;
  type Op = string;
  const pages: Op[][] = [];
  let ops: Op[] = [], y = 0;
  const text = (x: number, yy: number, str: string, size = 9, bold = false, gray = false) =>
    ops.push(`BT ${gray ? "0.4 0.43 0.48 rg" : "0.06 0.09 0.16 rg"} /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td (${winAnsi(str)}) Tj ET`);
  const right = (x: number, yy: number, str: string, size = 9, bold = false, gray = false) => text(x - textWidth(str, size), yy, str, size, bold, gray);
  const rule = (yy: number) => ops.push(`0.92 0.93 0.94 RG 0.6 w ${M} ${yy.toFixed(2)} m ${(A4.w - M).toFixed(2)} ${yy.toFixed(2)} l S`);
  const COL = { date: M, desc: M + 68, ref: M + 262, status: M + 338, amt: A4.w - M - 78, bal: A4.w - M };
  const tableHead = () => {
    text(COL.date, y, "Date", 8, true, true); text(COL.desc, y, "Description", 8, true, true); text(COL.ref, y, "Reference", 8, true, true); text(COL.status, y, "Status", 8, true, true);
    right(COL.amt, y, "Amount (NGN)", 8, true, true); right(COL.bal, y, "Balance (NGN)", 8, true, true);
    y -= 8; rule(y); y -= 14;
  };
  const newPage = () => { ops = []; pages.push(ops); y = A4.h - M; };

  newPage();
  text(M, y - 6, brandName, 16, true); right(A4.w - M, y - 6, "NGN statement", 12, true);
  y -= 34;
  const info: [string, string][] = [["Account holder", s.holder], ...(s.account ?? []), ["Period", `${longDay(s.from)} to ${longDay(s.to)}`]];
  for (const [k, v] of info) { text(M, y, k, 9, false, true); text(M + 120, y, v, 9); y -= 15; }
  y -= 8; rule(y); y -= 20;
  const sum: [string, Kobo][] = [["Opening balance", s.opening], ["Money in", s.moneyIn], ["Money out", s.moneyOut], ["Closing balance", s.closing]];
  sum.forEach(([k, v], i) => {
    const x = M + i * ((A4.w - 2 * M) / 4);
    text(x, y, k, 8, false, true); text(x, y - 15, `NGN ${naira(v)}`, 11, true);
  });
  y -= 42; rule(y); y -= 24;
  text(M, y, "Transactions", 10, true); y -= 18;
  tableHead();
  if (!s.rows.length) { text(COL.desc, y, NO_TRANSACTIONS, 9, false, true); y -= 16; }
  for (const r of s.rows) {
    if (y < M + 40) { newPage(); tableHead(); }
    const d = new Date(r.at);
    text(COL.date, y, d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), 8.5);
    text(COL.desc, y, fit(r.description, 37), 8.5);
    text(COL.ref, y, fit(r.reference, 15), 8.5);
    text(COL.status, y, r.status, 8.5, r.status !== "Completed", r.status === "Completed");
    right(COL.amt, y, (r.amount > 0 ? "+" : "") + naira(r.amount), 8.5);
    right(COL.bal, y, naira(r.balance), 8.5);
    y -= 15;
  }
  pages.forEach((p, i) => {
    ops = p;
    text(M, M - 14, "Payments by Poket", 8, true, true);
    right(A4.w - M, M - 14, `Page ${i + 1} of ${pages.length}`, 8);
  });

  // Objects: 1 catalog, 2 pages, 3 F1, 4 F2, 5 info, then a page and its content per page
  const objs: string[] = [];
  const kids = pages.map((_, i) => `${6 + i * 2} 0 R`).join(" ");
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  objs[5] = `<< /Title (${winAnsi(`NGN statement ${isoDay(s.from)} to ${isoDay(s.to)}`)}) /Producer (Poket) >>`;
  pages.forEach((p, i) => {
    const content = p.join("\n");
    objs[6 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${7 + i * 2} 0 R >>`;
    objs[7 + i * 2] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  // Every byte here is ASCII (WinAnsi escaped as octal), so string length is byte length
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let n = 1; n < objs.length; n++) { offsets[n] = out.length; out += `${n} 0 obj\n${objs[n]}\nendobj\n`; }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n${offsets.slice(1).map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
