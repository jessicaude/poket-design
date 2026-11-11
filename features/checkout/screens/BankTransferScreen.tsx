"use client";
import { useEffect, useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { ICON, WICON } from "@/lib/icons";
import { formatNaira, formatNairaShort } from "@/lib/money";
import { fmtCountdown } from "@/features/wallet/ngn/useNgn";
import { NGN_TEMP_MINUTES } from "@/lib/mock-api";
import { useCheckout } from "../useCheckout";
import { MoneyU } from "./PayScreen";

/**
 * Bank transfer. "Dynamic": a one-time virtual account for this order, with a countdown. "Merchant pool": the merchant's
 * pool account, no countdown. CentryOS matches the transfer; a different amount shows "We received ₦X. [handling]". The details reuse the wallet's NUBAN card
 * (va-details / va-field / va-copy, from TempScreen); the countdown starts at 30:00 [time] (NGN_TEMP_MINUTES).
 * NEW copy (not in the prototypes): "We'll confirm as soon as it arrives", "This account expired", "Get a new account".
 */
export function BankTransferScreen() {
  const { order, transfer, go, close, startTransfer, expireTransfer } = useCheckout();
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState<number | null>(null);
  const va = transfer.va;

  useEffect(() => {
    if (!va || va.expiresAt === null || transfer.state !== "waiting") return;
    const expiresAt = va.expiresAt;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (expiresAt - t <= 0) { clearInterval(id); expireTransfer(); }
    }, 1000);
    return () => clearInterval(id);
  }, [va, transfer.state, expireTransfer]);

  useEffect(() => {
    if (copied === null) return;
    const id = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  if (!order) return null;
  const back = <button className="link nav-back" onClick={() => go("add-method")}><Raw html={ICON.back} /> Back</button>;

  if (transfer.state === "expired") {
    return (
      <>
        {back}
        <div className="center" id="transferExpired">
          <div className="badge va-expired"><Raw html={WICON.info} /></div>
          <h2 className="title">This account expired</h2>
          <p className="sub">Don’t send to the old account number.</p>
        </div>
        <button className="btn" id="transferAgain" onClick={startTransfer}>Get a new account</button>
      </>
    );
  }

  if (!va || transfer.state === "creating") {
    return <div className="center"><div className="spinner" /><h2 className="title">Getting your account</h2></div>;
  }

  const matched = transfer.state === "underpaid" || transfer.state === "overpaid";
  const fields: [string, React.ReactNode, string | null][] = [
    ["Amount to send exactly", <MoneyU key="a" minor={va.amount} currency="NGN" />, formatNaira(va.amount)],
    ["Account number", va.num, va.num],
    ["Bank", "[Partner bank]", null],
    ["Account name", va.accountName, va.accountName],
  ];
  const copy = (i: number) => {
    try { navigator.clipboard?.writeText(fields[i][2] ?? "").catch(() => {}); } catch {}
    setCopied(i);
  };

  return (
    <>
      {back}
      <h2 className="title">Pay {formatNairaShort(order.amount)} by bank transfer</h2>
      {/* The pool doesn't expire; a matched one-time account no longer counts down */}
      {va.expiresAt === null || matched
        ? <p className="sub">From any Nigerian bank app.</p>
        : <p className="sub">From any Nigerian bank app. This account expires in <b className="mono" id="transferCount">{fmtCountdown(Math.min(va.expiresAt - now, NGN_TEMP_MINUTES * 60000))}</b> [time].</p>}
      <div className="va-details" id="transferDetails">
        {fields.map(([k, val, text], i) => (
          <div className="va-field" key={k}>
            <div><div className="va-k">{k}</div><div className={`va-v ${i < 2 ? "mono" : ""}`}>{val}</div></div>
            {text !== null && (
              <button type="button" className="va-copy" data-transfercopy={i} aria-label={`Copy ${k}`} onClick={() => copy(i)}>{copied === i ? "Copied" : "Copy"}</button>
            )}
          </div>
        ))}
      </div>
      {/* One-time account: the wallet's temporary-account note (TempScreen) */}
      {va.kind === "dynamic" && <div className="va-note" style={{ margin: "0 0 12px" }} id="transferOnce">Use it once. A transfer for a different amount, or after it expires, is [handling].</div>}
      {matched && transfer.received !== undefined
        // CentryOS matched a transfer for a different amount (either account). What happens next is [handling].
        ? <>
            <p className={`va-result ${transfer.state}`} id="transferResult" role="status">We received {formatNairaShort(transfer.received)}. [handling]</p>
            <button className="btn" id="transferClose" style={{ marginTop: "14px" }} onClick={() => close("amount_mismatch")}>Close</button>
          </>
        : <p className="va-wait" id="transferWaiting" role="status"><span className="va-dot" />We’ll confirm as soon as it arrives</p>}
    </>
  );
}
