"use client";
import { Raw } from "@/components/ui/Raw";
import { CV_CHEV, WICON } from "@/lib/icons";
import { useNgn } from "../ngn/useNgn";
import { useHoldings } from "../useHoldings";
import { useConvert } from "../convert/useConvert";
import {
  cvAvail, cvBadgeHtml, cvFeeLabel, cvFeeText, cvFmt, cvName, cvParse, cvQuote, cvRateText, cvShort, type Side,
} from "../convert/convertMath";
import { FEE_PLACEHOLDER, HOLD_PLACEHOLDER, hasSpeeds, isFirstPayment } from "../payout/payoutMath";
import { BackRow, Grey, Keypad, SpinButton } from "../payout/parts";
import { CurrencyBadge, FirstPaymentNotice } from "../payout/screens/AmountReviewScreens";
import { usePayout } from "../payout/usePayout";
import { NGN_VA } from "../ngn/useNgn";
import { showNotPorted } from "../useWalletToast";
import { sameAsTarget, sendSources } from "./sources";
import { useQuoteTimer } from "./useQuoteTimer";

/*
 * Send's amount screen: "You send" in the paying balance (the chip, with Max), then "They get" in the recipient's
 * currency. A balance in another currency converts inline, with Convert's quote card and its 30-second refresh.
 * The explore prototype's amount screen (amountScreen: the amount, the "from" chip, Max) with the wallet's look; the
 * naira rules of ngn.mdc still apply (₦[fee], one speed, first-payment hold).
 */

const asRecipient = (r: NonNullable<ReturnType<typeof usePayout.getState>["recipient"]>) => ({ kind: "bank" as const, id: `bank:${r.id}`, self: r.isSelf, bank: r });

/** Re-render on any balance change. */
function useBalances() {
  useNgn((s) => s.ngnBalance); useNgn((s) => s.ngnMerchantBalance);
  useHoldings((s) => s.cash); useHoldings((s) => s.fiatOnly); useHoldings((s) => s.coins);
}

/** The cash bucket's tag after its name. */
function Tag({ o }: { o: Side }) {
  if (o.k !== "cash" || o.bucket === "open") return null;
  return <span className="fiat-tag">{o.bucket === "fiat" ? "FIAT-ONLY" : "MERCHANT-HELD"}</span>;
}

export function SendAmountScreen() {
  useBalances();
  const { recipient: r, payFrom, payCents, cents, jitter, quoteAt, quoteExpired, key, max, back, refreshQuote, expireQuote, currency, go } = usePayout();
  const secs = useQuoteTimer(quoteAt, quoteExpired, expireQuote);
  if (!r || !payFrom) return <BackRow id="backToPayoutRecipient2" onClick={back} />;
  const src = cvParse(payFrom), target = `cash:${r.currency}:open`;
  const converting = !sameAsTarget(payFrom, asRecipient(r));
  const q = converting ? cvQuote(payFrom, target, payCents, jitter) : null;
  const avail = cvAvail(src);
  const over = payCents > avail;
  const ngn = !hasSpeeds(currency);
  const ready = payCents > 0 && !over && cents > 0 && !(converting && quoteExpired);
  const review = () => {
    if (r.currency !== "NGN") return showNotPorted(`Sending ${r.currency} to a bank account isn't ported yet.`);
    usePayout.setState({ ack: false, stage: "review" });
  };
  return (
    <>
      <BackRow id="backToPayoutRecipient2" onClick={back} />
      <CurrencyBadge />
      <p className="step-sub" style={{ textAlign: "center", marginBottom: 0 }}>
        To: <span className="mono">{r.name}</span> <span className="btn-ghost" id="editPayoutRecipient" role="button" onClick={() => usePayout.getState().changeRecipient()}>Change</span>
      </p>

      <label className="field-label" style={{ marginTop: "14px" }}>You send</label>
      <div className="cv-box">
        <div className="cv-box-row">
          <button type="button" className="cv-pick" id="payFromChip" onClick={() => go("payFrom")}>
            <Raw html={cvBadgeHtml(src, 28)} />
            <span className="cv-pick-name">{cvShort(src)}<Tag o={src} /></span>
            <Raw html={CV_CHEV} />
          </button>
          <span className={`cv-amt mono ${over ? "err" : ""}`} id="youSend">{(payCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="cv-box-top" style={{ marginTop: "8px", marginBottom: 0 }}>
          <span><Grey>{`Available ${cvFmt(avail, src)}`}</Grey></span>
          <button type="button" className="cv-max" id="payoutMaxAmt" onClick={max}>Max</button>
        </div>
      </div>
      {over && <div className="cv-hint err" id="payoutAmtHint">More than your {cvName(src)} balance.</div>}

      <label className="field-label" style={{ marginTop: "14px" }}>They get</label>
      <div className="amount-display" style={{ padding: "4px 0 8px" }}><span className="amount-value" id="theyGet"><Grey>{(converting ? "≈ " : "") + cvFmt(cents, cvParse(target))}</Grey></span></div>

      {ngn && (
        // NGN: one speed, ₦[fee] (ngn.mdc)
        <p className="step-sub" style={{ textAlign: "center", marginBottom: "6px" }}>
          <span className="status-pill" id="payoutSpeedPill"><Raw html={WICON.percent} /> {`${isFirstPayment(currency, r) ? `After ${HOLD_PLACEHOLDER}` : NGN_VA.arrives} · ${FEE_PLACEHOLDER} fee`}</span>
        </p>
      )}

      {q && (
        // The quote card (FND-06): rate, fee, what they get, and the 30-second countdown.
        <>
          <div className="receipt-card" id="cvQuoteCard" style={{ marginTop: "6px" }}>
            <div className="receipt-row"><span className="r-ic"><Raw html={WICON.globe} /></span><span className="r-label">Rate</span><span className="r-value mono"><Grey>{cvRateText(q.f, q.to, jitter, false)}</Grey></span></div>
            <div className="receipt-row"><span className="r-ic"><Raw html={WICON.percent} /></span><span className="r-label">{cvFeeLabel(q)}</span><span className="r-value mono"><Grey>{cvFeeText(q)}</Grey></span></div>
            <div className="receipt-row total"><span className="r-ic"><Raw html={WICON.coins} /></span><span className="r-label">They get</span><span className="r-value mono"><Grey>{cvFmt(q.receive, q.to)}</Grey></span></div>
          </div>
          <div className={`cv-timer ${quoteExpired ? "expired" : ""}`} id="cvTimer">
            {quoteExpired ? "Rate expired. Refresh to get a new rate." : <>Rate held for <span className="mono" id="cvTimerLeft">0:{String(secs).padStart(2, "0")}</span></>}
          </div>
          {quoteExpired && <SpinButton id="cvRefresh" className="btn-secondary" style={{ width: "100%", marginBottom: "10px" }} delay={400} onClick={refreshQuote}>Refresh rate</SpinButton>}
        </>
      )}
      {isFirstPayment(currency, r) && <FirstPaymentNotice />}
      <Keypad dataKey="payoutkey" onKey={key} />
      <SpinButton id="payoutReview" style={{ marginTop: "8px" }} disabled={!ready} delay={500} onClick={review}>Review</SpinButton>
    </>
  );
}

/** "Send from": the balances that can pay this recipient (sources.ts). Others aren't offered. */
export function PayFromScreen() {
  useBalances();
  const { recipient: r, payFrom, setPayFrom, back } = usePayout();
  const blocked = useConvert((s) => s.ngnCoinsBlocked);
  if (!r) return null;
  const list = sendSources(asRecipient(r), blocked);
  return (
    <>
      <BackRow id="backFromPayFrom" onClick={back} />
      <div className="step-title">Send from</div>
      {list.map((k) => {
        const o = cvParse(k);
        return (
          <div key={k} className={`select-row ${k === payFrom ? "sel" : ""}`} data-payfrom={k} role="button" tabIndex={0} onClick={() => setPayFrom(k)}>
            <Raw html={cvBadgeHtml(o)} />
            <div className="meta"><div className="t1">{cvName(o)}<Tag o={o} /></div><div className="t2"><Grey>{`Available ${cvFmt(cvAvail(o), o)}`}</Grey></div></div>
            <div className="radio" />
          </div>
        );
      })}
    </>
  );
}
