"use client";
import { Raw } from "@/components/ui/Raw";
import { CV_CHEV, WICON } from "@/lib/icons";
import { useNgn } from "../ngn/useNgn";
import { useHoldings } from "../useHoldings";
import { useConvert } from "../convert/useConvert";
import {
  cvAvail, cvBadgeHtml, cvFeeLabel, cvFeeText, cvFmt, cvName, cvParse, cvQuote, cvRateText, cvShort, type Side,
} from "../convert/convertMath";
import { FEE_PLACEHOLDER, HOLD_PLACEHOLDER, isFirstPayment } from "../payout/payoutMath";
import { BackRow, Grey, Keypad, SpinButton } from "../payout/parts";
import { CurrencyBadge, FirstPaymentNotice } from "../payout/screens/AmountReviewScreens";
import { usePayout } from "../payout/usePayout";
import { NGN_VA } from "../ngn/useNgn";
import { asSendRecipient, nairaConvertsOnReceipt, sameAsTarget, sendSources, targetKeyFor } from "./sources";
import { useNairaRecipients } from "./nairaRecipients";
import { sendSummary } from "./sendSummary";
import { payoutMethodIcon, isLogoMethod } from "../payout/payoutMath";
import { useQuoteTimer } from "./useQuoteTimer";
import { useSend } from "./useSend";
import { routingBank, usSpeeds, wireAddressOk } from "./sendMath";
import { fmtCurrency } from "../payout/payoutMath";

/*
 * Send's amount screen: "You send" in the paying balance (the chip, with Max), then "They get" in the recipient's
 * currency. A balance in another currency converts inline, with Convert's quote card and its 30-second refresh.
 * The explore prototype's amount screen (amountScreen: the amount, the "from" chip, Max) with the wallet's look; the
 * naira rules of ngn.mdc still apply (₦[fee], one speed, first-payment hold).
 */


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
  useNairaRecipients((s) => s.othersHoldNaira); // the demo bar's "Recipient can hold naira" changes the target
  const { recipient: r, payFrom, payCents, cents, jitter, speed, wire, quoteAt, quoteExpired, key, max, back, refreshQuote, expireQuote, currency, go } = usePayout();
  const secs = useQuoteTimer(quoteAt, quoteExpired, expireQuote);
  if (!r || !payFrom) return <BackRow id="backToPayoutRecipient2" onClick={back} />;
  const src = cvParse(payFrom), target = targetKeyFor(r, payFrom);
  const converting = !sameAsTarget(payFrom, asSendRecipient(r));
  const summary = sendSummary(r, payFrom, payCents, cents, jitter, speed);
  const ngnBank = r.methodType === "bank" && r.currency === "NGN";
  const q = converting ? cvQuote(payFrom, target, payCents, jitter) : null;
  const avail = cvAvail(src);
  const usBank = r.methodType === "bank" && r.currency === "USD";
  const opened = useSend.getState().source;
  // Opened from a naira balance for a recipient naira can't pay (a bank outside Nigeria, a debit card): say why
  // another balance is paying. Merchant-held naira choosing a bank never gets here (Send's "not available" step).
  const nairaBlocked = r.methodType === "card" ? "Naira can't pay a card."
    : r.methodType === "bank" && r.currency !== "NGN" ? "Naira can only go to Nigerian banks."
    : null;
  const nairaRedirected = !!nairaBlocked && !!opened?.startsWith("cash:NGN:") && !payFrom.startsWith("cash:NGN:");
  // The total (with a decided fee, e.g. a US speed's or a wallet's) must fit the balance
  const over = summary.sourceTotal > avail;
  const ready = payCents > 0 && !over && cents > 0 && !(converting && quoteExpired) && !(usBank && speed === "wire" && !wireAddressOk(wire));
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
          <Raw html={WICON.info} /><span>{r.name.split(/\s+/)[0]} can&apos;t hold naira. They&apos;ll get USD.</span>
        </div>
      )}
      {nairaRedirected && (
        // Why another balance is paying, and which (NEW copy)
        <div className="alert info" id="nairaOnlyNotice" role="note" style={{ marginTop: "12px", marginBottom: 0 }}>
          <Raw html={WICON.info} /><span>{nairaBlocked} Paying from {src.k === "cash" ? src.cur : src.asset}.</span>
        </div>
      )}

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
      <div className="amount-display" style={{ padding: "4px 0 8px" }}><span className="amount-value" id="theyGet"><Grey>{(converting ? "≈ " : "") + cvFmt(cents, cvParse(target))}</Grey></span>{summary.tag && <span className="fiat-tag" id="theyGetTag">{summary.tag}</span>}</div>

      {usBank && <UsSpeed />}

      {ngnBank && (
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
      {summary.firstPayment && <FirstPaymentNotice />}
      <Keypad dataKey="payoutkey" onKey={key} />
      <SpinButton id="payoutReview" style={{ marginTop: "8px" }} disabled={!ready} delay={500} onClick={() => usePayout.getState().toReview()}>Review</SpinButton>
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
      <div className="step-title">We can&apos;t send to this address</div>
      <p className="step-sub">This destination didn&apos;t pass Poket&apos;s screening checks, so the transfer hasn&apos;t gone through. No funds were moved. Your account has been flagged for compliance review.</p>
      <button className="btn-secondary" id="addressScreeningBlockedClose" style={{ width: "100%" }} onClick={close}>Back</button>
    </div>
  );
}

/**
 * A US bank send's speed, chosen per send (the explore prototype's speedsFor, moved here from adding the recipient):
 * Instant (if the bank supports RTP), Standard (free) and Wire, which needs the recipient's address.
 */
function UsSpeed() {
  const { recipient: r, speed, setSpeed, wire, editWire } = usePayout();
  if (!r) return null;
  const instant = routingBank(r.routingNumber ?? "")?.instant ?? false;
  const digits = (v: string, n: number) => v.replace(/\D/g, "").slice(0, n);
  return (
    <>
      <label className="field-label" style={{ marginTop: "6px" }}>Speed</label>
      {usSpeeds(instant).map((x) => (
        <div key={x.id} className={`select-row ${speed === x.id ? "sel" : ""}`} data-speed={x.id} role="radio" aria-checked={speed === x.id} tabIndex={0}
          onClick={() => setSpeed(x.id)} onKeyDown={(e) => { if (e.key === "Enter") setSpeed(x.id); }}>
          <div className="meta"><div className="t1">{x.label}</div><div className="t2">{x.eta}</div></div>
          <span className="mono" style={{ fontSize: "13px", fontWeight: 600 }}><Grey>{x.fee ? fmtCurrency(x.fee, "USD") : "Free"}</Grey></span>
          <div className="radio" />
        </div>
      ))}
      {speed === "wire" && (
        <>
          <label className="field-label" style={{ marginTop: "12px" }}>Recipient&rsquo;s address</label>
          <input className="field-input" id="usStreet" placeholder="Street address" value={wire.street} onChange={(e) => editWire({ street: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 96px", gap: "8px" }}>
            <input className="field-input" id="usCity" placeholder="City" value={wire.city} onChange={(e) => editWire({ city: e.target.value })} />
            <input className="field-input" id="usState" placeholder="State" maxLength={2} value={wire.state} onChange={(e) => editWire({ state: e.target.value.toUpperCase() })} />
            <input className="field-input" id="usZip" placeholder="ZIP" inputMode="numeric" maxLength={5} value={wire.zip} onChange={(e) => editWire({ zip: digits(e.target.value, 5) })} />
          </div>
        </>
      )}
    </>
  );
}
