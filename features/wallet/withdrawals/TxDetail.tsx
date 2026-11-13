"use client";
import { WICON } from "@/lib/icons";
import { Grey } from "../payout/parts";
import { useWalletToast } from "../useWalletToast";

/**
 * Transaction detail rows, from the reference's tTxDetail: detailRowHtml (label with its icon, monospace
 * right-aligned value, green bold for a completed Status, the part after " - " of a date in italics),
 * referenceRowHtml (the Reference chip that copies) and formatTxDate.
 */

/** detailIconInfo's label map (exact labels); anything else gets the activity icon. */
const LABEL_ICON: Record<string, keyof typeof WICON> = {
  Status: "check", Date: "calendar", Card: "card", "Statement descriptor": "hash",
  Fee: "percent", "Processing fee": "percent", "Network fee": "percent",
  To: "user", Recipient: "user", Handle: "user", From: "user",
  Bank: "bank", Account: "hash", Merchant: "store", "Cash App": "hash",
  // WGT-11's rows (not in the reference's map)
  Method: "bank", "Session ID": "hash",
};
/** detailIconInfo's "real" icons: a Currency row shows the currency's flag before its value, and a globe as its label icon. */
const CURRENCY_FLAG: Record<string, keyof typeof WICON> = { USD: "usFlag", NGN: "ngFlag", EUR: "eurFlag", GBP: "gbFlag", GHS: "ghFlag" };

/** formatTxDate: "10 Nov, 2026, 3:04 PM - GMT+1" (the time zone after " - ", when the browser gives one). */
export function formatTxDate(ts: number): string {
  const d = new Date(ts);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad2 = (n: number) => (n < 10 ? "0" + n : "" + n);
  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  let tz = "";
  try { tz = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? ""; } catch { tz = ""; }
  return `${pad2(d.getDate())} ${months[d.getMonth()]}, ${d.getFullYear()}, ${hours}:${pad2(d.getMinutes())} ${ampm}${tz ? " - " + tz : ""}`;
}

/** detailRowHtml(label, value). */
export function DetailRow({ label, value }: { label: string; value: string }) {
  const isStatus = label === "Status" && /completed|confirmed|approved/i.test(value);
  const isDate = label === "Date";
  const m = isDate ? value.match(/^(.*) - (\S+)$/) : null;
  const flag = label === "Currency" ? Object.keys(CURRENCY_FLAG).find((c) => value.includes(c)) : undefined;
  return (
    <div className="info-row" data-label={label}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
        <span className="detail-ic" dangerouslySetInnerHTML={{ __html: WICON[flag ? "globe" : LABEL_ICON[label] ?? "activity"] }} />{label}
      </span>
      <span className="mono" style={{
        ...(isDate ? { whiteSpace: "nowrap", marginLeft: "12px" } : { maxWidth: "190px", wordBreak: "break-word" }),
        textAlign: "right", ...(isStatus ? { color: "var(--ok-600)", fontWeight: 600 } : {}),
      }}>
        {m ? <>{m[1]} - <em>{m[2]}</em></>
          : flag ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}><span className="icon-16" dangerouslySetInnerHTML={{ __html: WICON[CURRENCY_FLAG[flag]] }} />{value}</span>
          : <Grey>{value}</Grey>}
      </span>
    </div>
  );
}

/**
 * The Status row, the same on every transaction: detailRowHtml's look (green bold when it's done), with the other
 * statuses in their chip's colour (WGT-11).
 */
const TONE_COLOR: Record<string, string> = { "": "var(--ok-600)", warn: "#92400E", err: "var(--err-600)" };
export function StatusRow({ label, tone }: { label: string; tone: "" | "muted" | "warn" | "err" }) {
  const color = TONE_COLOR[tone];
  return (
    <div className="info-row" data-label="Status" data-tone={tone || "ok"}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}><span className="detail-ic" dangerouslySetInnerHTML={{ __html: WICON.check }} />Status</span>
      <span className="mono" style={{ maxWidth: "190px", wordBreak: "break-word", textAlign: "right", ...(color ? { color, fontWeight: 600 } : {}) }}>{label}</span>
    </div>
  );
}

/** referenceRowHtml(ref): tapping the chip copies the reference ("Reference copied"). */
export function ReferenceRow({ refText }: { refText: string }) {
  const copy = () => {
    try { navigator.clipboard?.writeText(refText).catch(() => {}); } catch { /* no clipboard */ }
    useWalletToast.getState().showToast("Reference copied");
  };
  return (
    <div className="info-row" data-label="Reference">
      <span style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}><span className="detail-ic" dangerouslySetInnerHTML={{ __html: WICON.hash }} />Reference</span>
      <span className="ref-pill mono" id="copyRefBtn" data-ref={refText} role="button" tabIndex={0} style={{ marginLeft: "auto" }}
        onClick={copy} onKeyDown={(e) => { if (e.key === "Enter") copy(); }}
        dangerouslySetInnerHTML={{ __html: `${refText} ${WICON.copy}` }} />
    </div>
  );
}
