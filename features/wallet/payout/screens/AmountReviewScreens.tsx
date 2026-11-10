"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { NGN_VA, useNgn } from "../../ngn/useNgn";
import {
  CURRENCY_INFO, FEE_PLACEHOLDER, convertAmount, feeDecided, hasSpeeds, isCrossBorder, payoutEta, fmtCurrency, fmtFee, fmtWithFee, fxRateLabel, isLogoMethod, payoutFee, payoutMethodIcon, payoutMethodSub, withdrawFee,
} from "../payoutMath";
import { BackRow, Grey, Keypad, SpinButton } from "../parts";
import { availableFor, usePayout } from "../usePayout";

/** amountBadgeHtml(false, null, null, cur): the currency's flag. */
function CurrencyBadge() {
  const icon = CURRENCY_INFO[usePayout((s) => s.currency)].icon;
  return (
    <div className="center-col" style={{ padding: "4px 0 2px" }}>
      <div className="badge" style={{ width: "36px", height: "36px" }} dangerouslySetInnerHTML={{ __html: icon ? WICON[icon] : "" }} />
    </div>
  );
}

/** tPayout stage 'amount' (cash). */
export function AmountScreen() {
  const { currency, recipient: r, cents, speed, key, max, back } = usePayout();
  useNgn((s) => s.ngnBalance); // re-render when the balance changes
  const avail = availableFor(currency);
  const fee = payoutFee(currency, r, speed, cents);
  const over = cents + fee > avail;
  const crossBorder = isCrossBorder(currency, r);
  const fmt = (n: number) => fmtCurrency(n, currency);
  return (
    <>
      <BackRow id="backToPayoutRecipient2" onClick={back} />
      <CurrencyBadge />
      <p className="step-sub" style={{ textAlign: "center", marginBottom: 0 }}>
        To: <span className="mono">{r?.name ?? ""}</span> <span className="btn-ghost" id="editPayoutRecipient" role="button" onClick={() => usePayout.setState({ stage: "recipient" })}>Change</span>
      </p>
      <div className="amount-display" style={{ padding: "20px 0 4px" }}><span className="amount-value"><Grey>{fmt(cents)}</Grey></span></div>
      {!hasSpeeds(currency) ? (
        // NGN: one speed, no Standard / Instant
        <p className="step-sub" style={{ textAlign: "center", marginBottom: "6px" }}>
          <span className="status-pill" id="payoutSpeedPill"><Raw html={WICON.percent} /> {`${NGN_VA.arrives} · ${FEE_PLACEHOLDER} fee`}</span>
        </p>
      ) : r?.isSelf && (
        <p className="step-sub" style={{ textAlign: "center", marginBottom: "6px" }}>
          <span className="status-pill" id="payoutSpeedPill"><Raw html={WICON.percent} /> <Grey>{r.methodType === "card"
            ? `Instant · ${feeDecided(currency) ? "1.5%" : FEE_PLACEHOLDER} fee`
            : `Standard · ${fmtFee(withdrawFee(currency, "standard", 0), currency)} fee`}</Grey></span>
        </p>
      )}
      {crossBorder && r && (
        <div className="info-card" style={{ margin: "0 0 12px", padding: "10px 14px" }}>
          <div className="info-row"><span>Exchange rate</span><span className="mono"><Grey>{fxRateLabel(currency, r.currency)}</Grey></span></div>
          <div className="info-row"><span>Recipient gets</span><span className="mono"><Grey>{fmtCurrency(convertAmount(Math.max(0, cents - fee), currency, r.currency), r.currency)}</Grey></span></div>
        </div>
      )}
      <div id="payoutAmtHint" style={{ textAlign: "center", fontSize: "11.5px", color: over ? "var(--err-600)" : "var(--txt3)", marginBottom: "6px" }}>
        <Grey>{over ? `Amount + fee exceeds available ${fmt(avail)}` : `Available ${fmt(avail)}${!feeDecided(currency) ? ` · fee ${FEE_PLACEHOLDER}` : fee ? ` · fee ${fmt(fee)}` : ""}`}</Grey> &middot; <span className="btn-ghost" id="payoutMaxAmt" role="button" onClick={max}>Max</span>
      </div>
      <Keypad dataKey="payoutkey" onKey={key} />
      <SpinButton id="payoutReview" style={{ marginTop: "8px" }} disabled={!(cents > 0 && !over)} delay={500}
        onClick={() => usePayout.setState({ ack: false, stage: "review" })}>Review</SpinButton>
    </>
  );
}

/** tPayout stage 'review' (cash). "Payout" goes on to the PIN. */
export function ReviewScreen() {
  const { currency, recipient: r, cents, speed, ack, setAck, confirm, back } = usePayout();
  if (!r) return <BackRow id="backToPayoutAmount" onClick={back} />;
  const isSelf = r.isSelf;
  const fee = payoutFee(currency, r, speed, cents);
  const crossBorder = isCrossBorder(currency, r);
  const recv = crossBorder ? convertAmount(Math.max(0, cents - fee), currency, r.currency) : cents;
  const eta = payoutEta(currency, r, speed);
  const fmt = (n: number) => fmtCurrency(n, currency);
  const row = (icon: string, label: string, value: string, extra = "") => (
    <div className={`receipt-row ${extra}`}><span className="r-ic"><Raw html={icon} /></span><span className="r-label">{label}</span><span className={`r-value ${label === "To" || label === "Exchange rate" ? "mono" : ""}`}><Grey>{value}</Grey></span></div>
  );
  return (
    <>
      <BackRow id="backToPayoutAmount" onClick={back} />
      <div className="center-col" style={{ padding: "6px 8px 0" }}>
        <div className={`tx-ic tx-ic-lg ${isLogoMethod(r) ? "tx-ic-real" : "review"}`} dangerouslySetInnerHTML={{ __html: payoutMethodIcon(r) }} />
      </div>
      <div className="step-title mono" style={{ textAlign: "center", marginTop: "6px", fontSize: "26px" }}><Grey>{fmt(cents)}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "2px" }}>
        to {r.name}{" "}
        {crossBorder
          ? <span className="status-pill"><Raw html={WICON.globe} /> International</span>
          : isSelf && hasSpeeds(currency) && <span className="status-pill"><Raw html={WICON.percent} /> {speed === "instant" ? "Instant" : "Standard"}</span>}
      </p>
      <div className="receipt-card" style={{ marginTop: "14px" }}>
        {row(WICON.user, "To", payoutMethodSub(r))}
        {crossBorder && row(WICON.globe, "Exchange rate", fxRateLabel(currency, r.currency))}
        {row(WICON.percent, "Fee", fmtFee(fee, currency))}
        {crossBorder && row(WICON.coins, "Recipient gets", fmtCurrency(recv, r.currency))}
        {row(WICON.calendar, isSelf ? "Arrives" : "Delivery", eta)}
        {row(WICON.check, isSelf ? "Debited from balance" : "Total charged", fmtWithFee(cents, fee, currency), "total")}
      </div>
      {isSelf && hasSpeeds(currency) && (
        <p className="fine-print"><Raw html={WICON.info} /><span>{speed === "instant" ? "Instant payouts are irreversible once sent." : "Standard payouts settle over ACH and may arrive sooner than the estimate."}</span></p>
      )}
      <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", margin: "2px 0 4px", cursor: "pointer" }}>
        <input type="checkbox" id="payoutAckCheck" style={{ marginTop: "3px" }} checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span style={{ fontSize: "12px", color: "var(--txt2)", lineHeight: 1.5 }}>I&apos;ve reviewed the destination, fee, and {isSelf ? "arrival" : "delivery"} estimate above.</span>
      </label>
      <SpinButton id="confirmPayout" disabled={!ack} delay={500} onClick={confirm}>Payout</SpinButton>
    </>
  );
}
