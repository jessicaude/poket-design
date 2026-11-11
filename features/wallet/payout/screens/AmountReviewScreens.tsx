"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useQuoteTimer } from "../../send/useQuoteTimer";
import { sendSummary } from "../../send/sendSummary";
import { CURRENCY_INFO, HOLD_PLACEHOLDER, isLogoMethod, payoutMethodIcon, payoutMethodSub } from "../payoutMath";
import { BackRow, Grey, SpinButton } from "../parts";
import { usePayout } from "../usePayout";

/** Not in the reference: a first payment to a bank account sends after [hold]. Shown on amount and review. */
export function FirstPaymentNotice() {
  return (
    <div className="alert info" id="firstPaymentNotice" role="note" style={{ marginBottom: "10px" }}>
      <Raw html={WICON.info} /><span>First payment to a new account sends after {HOLD_PLACEHOLDER}</span>
    </div>
  );
}

/** amountBadgeHtml(false, null, null, cur): the currency's flag. */
export function CurrencyBadge() {
  const icon = CURRENCY_INFO[usePayout((s) => s.currency)].icon;
  return (
    <div className="center-col" style={{ padding: "4px 0 2px" }}>
      <div className="badge" style={{ width: "36px", height: "36px" }} dangerouslySetInnerHTML={{ __html: icon ? WICON[icon] : "" }} />
    </div>
  );
}

/**
 * Review, for every kind of send: To, They get, You send and Rate (converting), Fee, Delivery, Total charged; the
 * first-payment notice for a new bank account; the held quote's countdown when converting. tPayout's review layout.
 */
export function ReviewScreen() {
  const { recipient: r, cents, ack, setAck, confirm, back, payFrom, payCents, jitter, speed, quoteAt, quoteExpired, expireQuote, refreshQuote } = usePayout();
  const secs = useQuoteTimer(quoteAt, quoteExpired, expireQuote);
  if (!r || !payFrom) return <BackRow id="backToPayoutAmount" onClick={back} />;
  const s = sendSummary(r, payFrom, payCents, cents, jitter, speed);
  const isSelf = r.isSelf;
  const row = (icon: string, label: string, value: string, extra = "") => (
    <div className={`receipt-row ${extra}`}><span className="r-ic"><Raw html={icon} /></span><span className="r-label">{label}</span><span className={`r-value ${label === "To" ? "mono" : ""}`}><Grey>{value}</Grey></span></div>
  );
  return (
    <>
      <BackRow id="backToPayoutAmount" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}>
        <div className={`tx-ic tx-ic-lg ${isLogoMethod(r) ? "tx-ic-real" : "review"}`} dangerouslySetInnerHTML={{ __html: payoutMethodIcon(r) }} />
      </div>
      <div className="step-title mono" style={{ textAlign: "center", marginTop: "6px", fontSize: "26px" }}><Grey>{s.theyGetText}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "2px" }}>to {r.name}</p>
      <div className="receipt-card" style={{ marginTop: "14px" }}>
        {row(WICON.user, "To", payoutMethodSub(r))}
        {/* A Poket user paid from merchant-held naira or card-funded USD: their money keeps the tag */}
        <div className="receipt-row"><span className="r-ic"><Raw html={WICON.coins} /></span><span className="r-label">They get</span>
          <span className="r-value" id="reviewTheyGet"><Grey>{s.theyGetText}</Grey>{s.tag && <span className="fiat-tag">{s.tag}</span>}</span></div>
        {s.youSendText && row(WICON.convert, "You send", s.youSendText)}
        {s.rateText && row(WICON.globe, "Rate", s.rateText)}
        {row(WICON.percent, "Fee", s.feeText)}
        {row(WICON.calendar, isSelf ? "Arrives" : "Delivery", s.arrival)}
        {row(WICON.check, isSelf ? "Debited from balance" : "Total charged", s.totalText, "total")}
      </div>
      {s.firstPayment && <FirstPaymentNotice />}
      {s.converting && (
        <>
          <div className={`cv-timer ${quoteExpired ? "expired" : ""}`} id="cvTimer">
            {quoteExpired ? "Rate expired. Refresh to get a new rate." : <>Rate held for <span className="mono" id="cvTimerLeft">0:{String(secs).padStart(2, "0")}</span></>}
          </div>
          {quoteExpired && <SpinButton id="cvRefresh" className="btn-secondary" style={{ width: "100%", marginBottom: "10px" }} delay={400} onClick={refreshQuote}>Refresh rate</SpinButton>}
        </>
      )}
      <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", margin: "2px 0 4px", cursor: "pointer" }}>
        <input type="checkbox" id="payoutAckCheck" style={{ marginTop: "3px" }} checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span style={{ fontSize: "12px", color: "var(--txt2)", lineHeight: 1.5 }}>I&apos;ve reviewed the destination, fee, and {isSelf ? "arrival" : "delivery"} estimate above.</span>
      </label>
      <SpinButton id="confirmPayout" disabled={!ack || (s.converting && quoteExpired)} delay={500} onClick={confirm}>Send</SpinButton>
    </>
  );
}
