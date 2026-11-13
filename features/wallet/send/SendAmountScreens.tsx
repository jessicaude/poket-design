"use client";
import { useNairaPartner } from "@/store/partner";
import { SendPausedNotice } from "../NairaPausedBanner";
import { Raw } from "@/components/ui/Raw";
import { CV_CHEV, WICON } from "@/lib/icons";
import { useNgn } from "../ngn/useNgn";
import { useHoldings } from "../useHoldings";
import { useConvert } from "../convert/useConvert";
import {
  cvAvail, cvBadgeHtml, cvFeeLabel, cvFeeText, cvFmt, cvName, cvParse, cvQuote, cvRateText, cvShort, type Side,
} from "../convert/convertMath";
import { BackRow, Grey, Keypad, SpinButton } from "../payout/parts";
import { CurrencyBadge, FirstPaymentNotice } from "../payout/screens/AmountReviewScreens";
import { usePayout } from "../payout/usePayout";
import { asSendRecipient, nairaConvertsOnReceipt, sameAsTarget, sendSources, targetKeyFor } from "./sources";
import { useNairaRecipients } from "./nairaRecipients";
import { useSettings } from "../settings/useSettings";
import { blockedByInstantOff, openDailyLimit, overDailyLimit, turnOnInstantTransfers } from "../settings/instant";
import { useWithdrawals } from "../payout/useWithdrawals";
import { formatNairaShort } from "@/lib/money";
import { sendSummary } from "./sendSummary";
import { payoutMethodIcon, isLogoMethod } from "../payout/payoutMath";
import { useQuoteTimer } from "./useQuoteTimer";
import { useKeypadOnDemand } from "../payout/useKeypadOnDemand";
import { useSend } from "./useSend";

/*
 * Send's amount screen: "You send" in the paying balance (the chip, with Max), then "They get" in the recipient's
 * currency. A balance in another currency converts inline, with Convert's quote card and its 30-second refresh.
 * The explore prototype's amount screen (amountScreen: the amount, the "from" chip, Max) with the wallet's look; the
 * naira rules of ngn.mdc still apply (₦[fee], one speed, first-payment hold).
 */


/** Re-render on any balance change. */
function useBalances() {
  useNgn((s) => s.ngnBalance);
  useHoldings((s) => s.cash); useHoldings((s) => s.fiatOnly); useHoldings((s) => s.coins);
}

/** The cash bucket's tag after its name. */
function Tag({ o }: { o: Side }) {
  if (o.k !== "cash" || o.bucket === "open") return null;
  return <span className="fiat-tag">FIAT-ONLY</span>;
}

export function SendAmountScreen() {
  useBalances();
  useNairaRecipients((s) => s.othersHoldNaira); // the demo bar's "Recipient can hold naira" changes the target
  const { recipient: r, payFrom, payCents, cents, jitter, quoteAt, quoteExpired, key, max, back, refreshQuote, expireQuote, go } = usePayout();
  const secs = useQuoteTimer(quoteAt, quoteExpired, expireQuote);
  const instantOn = useSettings((s) => s.instantOn);
  const partnerDown = useNairaPartner((s) => s.down);
  useSettings((s) => s.instantLimit); useWithdrawals((s) => s.list); // the daily limit and today's total
  // The keypad shows only while You send's amount is being typed (useKeypadOnDemand)
  const { open: keypad, setOpen: setKeypad, ref: typing } = useKeypadOnDemand();
  if (!r || !payFrom) return <BackRow id="backToPayoutRecipient2" onClick={back} />;
  const src = cvParse(payFrom), target = targetKeyFor(r, payFrom), tgt = cvParse(target);
  const converting = !sameAsTarget(payFrom, asSendRecipient(r));
  const summary = sendSummary(r, payFrom, payCents, cents, jitter);
  const q = converting ? cvQuote(payFrom, target, payCents, jitter) : null;
  const avail = cvAvail(src);
  const opened = useSend.getState().source;
  // Opened from a naira balance for a recipient naira can't pay (a bank outside Nigeria, a debit card): say why
  // another balance is paying.
  const nairaBlocked = r.methodType === "card" ? "Naira can’t pay a card."
    : r.methodType === "bank" && r.currency !== "NGN" ? "Naira can only go to Nigerian banks."
    : null;
  const nairaRedirected = !!nairaBlocked && !!opened?.startsWith("cash:NGN:") && !payFrom.startsWith("cash:NGN:");
  // The total (with a decided fee, e.g. a wallet's) must fit the balance
  const over = summary.sourceTotal > avail;
  // WGT-09: while instant transfers are off, a send to a Nigerian bank can't go on to review
  // WGT-13: while the naira partner is down, sends to Nigerian banks are paused (first: it's why nothing else applies)
  const partnerPaused = partnerDown && r.methodType === "bank" && r.currency === "NGN";
  const instantOff = !partnerPaused && blockedByInstantOff(r, instantOn);
  // ...and while on, today's total to Nigerian banks can't go over the daily limit
  const overLimit = instantOff ? null : overDailyLimit(r, cents);
  const ready = payCents > 0 && !over && cents > 0 && !(converting && quoteExpired) && !instantOff && !overLimit && !partnerPaused;
  const amountText = (c: number) => (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <>
      <BackRow id="backToPayoutRecipient2" onClick={back} />
      {r.methodType === "bank" ? <CurrencyBadge /> : (
        // A Poket user's initials, a wallet's coin or a card, where a bank shows its currency's flag
        <div className="center-col" style={{ padding: "4px 0 2px" }}>
          {r.methodType === "wallet" || r.methodType === "card"
            ? <div className={`tx-ic tx-ic-lg ${isLogoMethod(r) ? "tx-ic-real" : "review"}`} style={{ width: "36px", height: "36px" }} dangerouslySetInnerHTML={{ __html: payoutMethodIcon(r) }} />
            : <div className="badge" style={{ width: "36px", height: "36px", background: "var(--brand-50)", color: "var(--brand-600)", fontWeight: 700, fontSize: "13px" }}>{r.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</div>}
        </div>
      )}
      {/* The exploration's "Send to {first name}" (your own accounts and wallets by their whole name) */}
      <div className="step-title" id="sendToTitle" style={{ textAlign: "center", marginBottom: "2px" }}>Send to {r.isSelf || r.methodType === "wallet" ? r.name : r.name.split(/\s+/)[0]}</div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: 0 }}>
        <span className="btn-ghost" id="editPayoutRecipient" role="button" onClick={() => usePayout.getState().changeRecipient()}>Change</span>
      </p>
      {nairaConvertsOnReceipt(asSendRecipient(r), payFrom) && (
        // WGT-07: a Poket user who can't hold naira gets USD, converted on receipt (the quote card below)
        <div className="alert info" id="nairaRecipientNotice" role="note" style={{ marginTop: "12px", marginBottom: 0 }}>
          <Raw html={WICON.info} /><span>{r.name.split(/\s+/)[0]} can&rsquo;t hold naira. They&rsquo;ll get USD.</span>
        </div>
      )}
      {partnerPaused && (
        <SendPausedNotice style={{ marginTop: "12px", marginBottom: 0 }} />
      )}
      {instantOff && (
        // NEW copy: "Turn on" asks for the PIN, then the send carries on
        <div className="alert warn" id="instantOffNotice" role="note" style={{ marginTop: "12px", marginBottom: 0 }}>
          <Raw html={WICON.alert} /><span>Instant transfers are off. Turn them on to send to banks. <span className="btn-ghost" id="instantTurnOn" role="button" tabIndex={0}
            style={{ display: "inline", padding: 0 }} onClick={turnOnInstantTransfers} onKeyDown={(e) => { if (e.key === "Enter") turnOnInstantTransfers(); }}>Turn on</span></span>
        </div>
      )}
      {overLimit && (
        // NEW link copy ("Change limit"): to Settings → Instant transfers → Daily limit
        <div className="alert warn" id="dailyLimitNotice" role="note" style={{ marginTop: "12px", marginBottom: 0 }}>
          <Raw html={WICON.alert} /><span>That’s over your daily limit of <Grey>{formatNairaShort(overLimit.limit)}</Grey>. You have <Grey>{formatNairaShort(overLimit.left)}</Grey> left today.{" "}
            <span className="btn-ghost" id="dailyLimitChange" role="button" tabIndex={0} style={{ display: "inline", padding: 0 }}
              onClick={openDailyLimit} onKeyDown={(e) => { if (e.key === "Enter") openDailyLimit(); }}>Change limit</span></span>
        </div>
      )}
      {nairaRedirected && (
        // Why another balance is paying, and which (NEW copy)
        <div className="alert info" id="nairaOnlyNotice" role="note" style={{ marginTop: "12px", marginBottom: 0 }}>
          <Raw html={WICON.info} /><span>{nairaBlocked} Paying from {src.k === "cash" ? src.cur : src.asset}.</span>
        </div>
      )}

      <div ref={typing} style={{ marginTop: "14px" }}>
        {/* You send and They get: Convert's From / To boxes (the label and Available + Max on top, the chip and amount below) */}
        <div className="cv-box" id="youSendBox" style={keypad ? { borderColor: "var(--brand-500)", boxShadow: "0 0 0 3px var(--brand-100)" } : undefined}>
          <div className="cv-box-top"><span>You send</span><span><Grey>{`Available ${cvFmt(avail, src)}`}</Grey> <button type="button" className="cv-max" id="payoutMaxAmt" onClick={max}>Max</button></span></div>
          <div className="cv-box-row">
            <button type="button" className="cv-pick" id="payFromChip" onClick={() => go("payFrom")}>
              <Raw html={cvBadgeHtml(src, 28)} />
              <span className="cv-pick-name">{cvShort(src)}<Tag o={src} /></span>
              <Raw html={CV_CHEV} />
            </button>
            <span className={`cv-amt mono ${over ? "err" : ""}`} id="youSend" role="button" tabIndex={0} aria-label="You send amount"
              aria-expanded={keypad} style={{ cursor: "text" }} onClick={() => setKeypad(true)}
              onKeyDown={(e) => { if (e.key === "Enter") setKeypad(true); }}>{amountText(payCents)}</span>
          </div>
        </div>
        {over && <div className="cv-hint err" id="payoutAmtHint">More than your {cvName(src)} balance.</div>}

        <div className="cv-box" id="theyGetBox" style={{ marginTop: "6px" }}>
          {/* The arrival (NGN: "Usually within seconds", or "After [hold]" for a first payment; US: 1 to 3 business days) */}
          <div className="cv-box-top"><span>They get</span><span id="theyGetArrival">{summary.arrival}</span></div>
          <div className="cv-box-row">
            <span className="cv-pick" id="theyGetChip" aria-disabled="true">
              <Raw html={cvBadgeHtml(tgt, 28)} />
              <span className="cv-pick-name">{cvShort(tgt)}{summary.tag && <span className="fiat-tag" id="theyGetTag">{summary.tag}</span>}</span>
            </span>
            <span className={`cv-amt mono ${converting ? "muted" : ""}`} id="theyGet">{(converting ? "≈ " : "") + amountText(cents)}</span>
          </div>
        </div>

        {keypad && (
          <div id="sendKeypad" style={{ marginTop: "10px" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "4px" }}>
              <button type="button" className="cv-max" id="keypadDone" onClick={() => setKeypad(false)}>Done</button>
            </div>
            <Keypad dataKey="payoutkey" onKey={key} />
          </div>
        )}
      </div>

      {q && (
        // The quote card (FND-06): rate and fee (They get is in the box above), and the 30-second countdown
        <>
          <div className="receipt-card" id="cvQuoteCard" style={{ marginTop: "10px" }}>
            <div className="receipt-row"><span className="r-ic"><Raw html={WICON.globe} /></span><span className="r-label">Rate</span><span className="r-value mono"><Grey>{cvRateText(q.f, q.to, jitter, false)}</Grey></span></div>
            <div className="receipt-row"><span className="r-ic"><Raw html={WICON.percent} /></span><span className="r-label">{cvFeeLabel(q)}</span><span className="r-value mono"><Grey>{cvFeeText(q)}</Grey></span></div>
          </div>
          <div className={`cv-timer ${quoteExpired ? "expired" : ""}`} id="cvTimer">
            {quoteExpired ? "Rate expired. Refresh to get a new rate." : <>Rate held for <span className="mono" id="cvTimerLeft">0:{String(secs).padStart(2, "0")}</span></>}
          </div>
          {quoteExpired && <SpinButton id="cvRefresh" className="btn-secondary" style={{ width: "100%", marginBottom: "10px" }} delay={400} onClick={refreshQuote}>Refresh rate</SpinButton>}
        </>
      )}
      {summary.firstPayment && <FirstPaymentNotice />}
      <SpinButton id="payoutReview" style={{ marginTop: "12px" }} disabled={!ready} delay={500} onClick={() => usePayout.getState().toReview()}>Review</SpinButton>
    </>
  );
}

/** "Send from": the balances that can pay this recipient (sources.ts). Others aren't offered. */
export function PayFromScreen() {
  useBalances();
  const { recipient: r, payFrom, setPayFrom, back } = usePayout();
  const blocked = useConvert((s) => s.ngnCoinsBlocked);
  if (!r) return null;
  const list = sendSources(asSendRecipient(r), blocked);
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

/** The reference's tAddressScreening: checking a stablecoin wallet's address before review. */
export function AddressScreeningScreen() {
  return (
    <div className="center-col" style={{ paddingTop: "24px" }}>
      <div className="spinner" />
      <div className="step-title" style={{ marginTop: "16px" }}>Checking this address</div>
      <p className="step-sub">Poket screens the destination address before sending.</p>
    </div>
  );
}

/** The reference's tAddressScreeningBlocked: the address failed screening; nothing moved. */
export function AddressScreeningBlockedScreen() {
  const close = usePayout((s) => s.close);
  return (
    <div className="center-col" style={{ paddingTop: "24px" }}>
      <div className="check-circle" style={{ background: "var(--err-50)", color: "var(--err-600)" }}><Raw html={WICON.closeIc} /></div>
      <div className="step-title">We can&rsquo;t send to this address</div>
      <p className="step-sub">This destination didn&rsquo;t pass Poket&rsquo;s screening checks, so the transfer hasn&rsquo;t gone through. No funds were moved. Your account has been flagged for compliance review.</p>
      <button className="btn-secondary" id="addressScreeningBlockedClose" style={{ width: "100%" }} onClick={close}>Back</button>
    </div>
  );
}

