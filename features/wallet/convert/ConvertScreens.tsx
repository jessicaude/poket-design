"use client";
import { useEffect, useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { CHECK_DRAW, CV_CHEV, CV_FLIP, CV_RATE_SWAP, WICON } from "@/lib/icons";
import { BackRow, Grey, Keypad, SpinButton } from "../payout/parts";
import { cashAmount, cashBuckets } from "../useHoldings";
import {
  CV_QUOTE_SECONDS, LIMIT_PLACEHOLDER, MIN_PLACEHOLDER, NETWORK, belowMinimum, cvAvail, cvBadgeHtml, cvBlockReason, cvFeeLabel, cvFeeText, cvFmt, cvKey, cvName,
  cvOptions, cvParse, cvQuote, cvRateText, cvShort, cvType, cvUnit, cvUsdPer, fmtAsset, fmtPlain, involvesNgn, isNgnToStablecoin,
  overNgnLimit, type Side,
} from "./convertMath";
import { fmtCurrency } from "../payout/payoutMath";
import { toBalanceName, useConvert } from "./useConvert";
import { StepUpIntro } from "../StepUpIntro";
import { TIERS } from "../limits";
import { useWalletNav } from "../useWalletNav";
import { showNotPorted } from "../useWalletToast";
import { useNgn } from "../ngn/useNgn";
import { useHoldings } from "../useHoldings";

/** Re-render when any balance changes (amounts are read through the stores' getState). */
function useBalancesTick() {
  useNgn((s) => s.ngnBalance);
  useHoldings((s) => s.cash);
  useHoldings((s) => s.fiatOnly);
  useHoldings((s) => s.coins);
}

/** cvRateBtn: the rate, tappable to read it the other way round. */
function RateButton({ f, to }: { f: Side; to: Side }) {
  const { jitter, rateFlip, flipRate } = useConvert();
  return (
    <button type="button" className="cv-rate" data-cvrateflip="" aria-label="Switch rate direction" title="Switch rate direction" onClick={flipRate}>
      <Grey>{cvRateText(f, to, jitter, rateFlip)}</Grey><Raw html={CV_RATE_SWAP} />
    </button>
  );
}

/** The cash bucket's tag after its name: FIAT-ONLY (reference). */
function BucketTag({ o }: { o: Side }) {
  if (o.k !== "cash" || o.bucket === "open") return null;
  return <span className="fiat-tag">FIAT-ONLY</span>;
}

/** tConvert 'form': the From and To panels, the quote line and the keypad. */
export function ConvertFormScreen() {
  useBalancesTick();
  const { from, to, cents, jitter, ngnCoinsBlocked, close, openPicker, flip, max, key, review, useUsd } = useConvert();
  const q = cvQuote(from, to, cents, jitter);
  const over = q.amt > q.avail;
  const belowMin = !q.noTarget && belowMinimum(q);
  const overLimit = overNgnLimit(q);
  const coinsBlocked = !q.noTarget && ngnCoinsBlocked && isNgnToStablecoin(q.f, q.to);
  const hint = q.noTarget ? ""
    : !q.type ? "Choose a different balance to convert to."
    : over ? `Exceeds available ${cvFmt(q.avail, q.f)}`
    : belowMin ? `Minimum is ${involvesNgn(q.f, q.to) ? MIN_PLACEHOLDER : q.f.k === "cash" ? fmtCurrency(Math.ceil(100 / cvUsdPer(q.f)), q.f.cur) : fmtAsset(100, q.f.asset)}`
    : overLimit ? `Over your limit of ${LIMIT_PLACEHOLDER} per conversion`
    : "";
  return (
    <>
      <BackRow id="backHome" label="Wallet" onClick={close} />
      <div className="step-title">Convert</div>
      <p className="step-sub">Move money between your currencies and stablecoins.</p>
      <div className="cv-box">
        <div className="cv-box-top"><span>From</span><span><Grey>{`Available ${cvFmt(q.avail, q.f)}`}</Grey> <button type="button" className="cv-max" id="cvMax" onClick={max}>Max</button></span></div>
        <div className="cv-box-row">
          <button type="button" className="cv-pick" id="cvPickFrom" onClick={() => openPicker("from")}>
            <Raw html={cvBadgeHtml(q.f, 28)} />
            <span className="cv-pick-name">{cvShort(q.f)}<BucketTag o={q.f} /></span>
            <Raw html={CV_CHEV} />
          </button>
          <span className={`cv-amt mono ${over ? "err" : ""}`} id="cvFromAmt">{fmtPlain(q.amt)}</span>
        </div>
      </div>
      <div className="cv-flip-wrap"><button type="button" className="cv-flip" id="cvFlip" aria-label="Swap from and to" disabled={!!q.noTarget} onClick={flip} dangerouslySetInnerHTML={{ __html: CV_FLIP }} /></div>
      <div className="cv-box">
        <div className="cv-box-top"><span>To</span><span>{q.noTarget ? "" : q.to.k === "coin" ? `Arrives ${NETWORK[q.to.net].eta}` : "Arrives instantly"}</span></div>
        <div className="cv-box-row">
          <button type="button" className="cv-pick" id="cvPickTo" onClick={() => openPicker("to")}>
            {/* A card-funded source has no target until one is chosen (NGN rule). NEW copy. */}
            {q.noTarget
              ? <span className="cv-pick-name" style={{ paddingLeft: "6px", color: "var(--txt3)" }}>Choose a currency</span>
              : <><Raw html={cvBadgeHtml(q.to, 28)} /><span className="cv-pick-name">{cvShort(q.to)}</span></>}
            <Raw html={CV_CHEV} />
          </button>
          {/* Grey 0.00 until there's an amount to convert (docs/copy.md: no dashes) */}
          <span className="cv-amt mono muted" id="cvToAmt">{q.type && q.amt > 0 ? "≈ " + fmtPlain(q.receive) : "0.00"}</span>
        </div>
      </div>
      {q.type && <div className="cv-meta"><RateButton f={q.f} to={q.to} /><span><Grey>{`${cvFeeLabel(q)}: ${cvFeeText(q)}`}</Grey></span></div>}
      {coinsBlocked ? (
        // Demo bar "NGN to stablecoins: Blocked". NEW copy from the brief.
        <div className="alert warn" id="cvCoinsBlocked" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px", marginTop: "8px" }}>
          <span>Converting naira to stablecoins isn&apos;t available yet. You can convert to USD.</span>
          <button type="button" className="btn-secondary" id="cvUseUsd" onClick={useUsd}>Convert to USD</button>
        </div>
      ) : <div className={`cv-hint ${hint ? "err" : ""}`} id="cvHint"><Grey>{hint}</Grey></div>}
      <Keypad dataKey="cvkey" onKey={key} />
      <SpinButton id="cvReview" style={{ marginTop: "8px" }} disabled={!(q.type && q.amt > 0 && !over && !belowMin && !overLimit && !coinsBlocked)} delay={400} onClick={review}>Review</SpinButton>
    </>
  );
}

/** cvPicker: search, then Cash and Stablecoins groups. Rows that can't be chosen say why. */
export function ConvertPickerScreen() {
  useBalancesTick();
  const { stage, from, to, search, setSearch, pick, pickBack } = useConvert();
  const isFrom = stage === "pickFrom";
  const cur = cvParse(isFrom ? from : to), other = cvParse(isFrom ? to : from);
  const qs = search.trim().toLowerCase();
  const rows = cvOptions(isFrom, cashBuckets).filter((o) => !qs || cvName(o).toLowerCase().includes(qs) || cvUnit(o).toLowerCase().includes(qs));
  const row = (o: Side) => {
    const key = cvKey(o), sel = key === cvKey(cur);
    const reason = isFrom ? null : cvBlockReason(other, o);
    const blocked = !!reason;
    const same = !isFrom && !cvType(other, o);
    const t2 = isFrom ? `Available ${cvFmt(cvAvail(o), o)}`
      : same ? "Same as the balance you convert from"
      : reason ? reason
      : o.k === "coin" ? `Arrives ${NETWORK[o.net].eta}` : `Balance ${fmtCurrency(cashAmount(o.cur), o.cur)}`;
    return (
      <div key={key} className={`select-row ${sel ? "sel" : ""} ${blocked || same ? "cv-disabled" : ""}`} data-cvopt={key}
        {...(blocked ? { "data-cvblocked": "1" } : {})} {...(same ? { "aria-disabled": true } : {})} onClick={() => pick(key)}>
        <Raw html={cvBadgeHtml(o)} />
        <div className="meta">
          <div className="t1">{cvName(o)}<BucketTag o={o} /></div>
          <div className="t2"><Grey>{t2}</Grey></div>
        </div>
        <div className="radio" />
      </div>
    );
  };
  const cash = rows.filter((o) => o.k === "cash"), coins = rows.filter((o) => o.k === "coin");
  return (
    <>
      <BackRow id="cvPickBack" onClick={pickBack} />
      <div className="step-title">{isFrom ? "Convert from" : "Convert to"}</div>
      <p className="step-sub">{isFrom ? "Choose the balance to convert." : "Choose what you want to receive."}</p>
      <div className="field-icon-wrap">
        <span className="field-icon"><Raw html={WICON.search} /></span>
        <input className="field-input" id="cvSearch" placeholder="Search currency or stablecoin" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div style={{ maxHeight: "380px", overflowY: "auto", margin: "0 -2px" }}>
        {cash.length > 0 && <><div className="cv-group">Cash</div>{cash.map(row)}</>}
        {coins.length > 0 && <><div className="cv-group">Stablecoins</div>{coins.map(row)}</>}
        {!rows.length && <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0 4px" }}>{isFrom && !qs ? "No balances to convert yet." : `No matches for "${search}".`}</div>}
      </div>
    </>
  );
}

/** cvReview, with the 30-second rate hold: on expiry, "Refresh rate" replaces "Convert". */
export function ConvertReviewScreen() {
  useBalancesTick();
  const { from, to, cents, jitter, quoteAt, expired, backToForm, refresh, expire, confirm } = useConvert();
  const q = cvQuote(from, to, cents, jitter);
  const secondsLeft = () => Math.max(0, CV_QUOTE_SECONDS - Math.floor((Date.now() - quoteAt) / 1000));
  const [left, setLeft] = useState(secondsLeft);
  useEffect(() => {
    if (expired) return;
    setLeft(secondsLeft());
    const id = setInterval(() => {
      const l = secondsLeft();
      if (l <= 0) { clearInterval(id); expire(); return; }
      setLeft(l);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteAt, expired]);
  const row = (icon: string, label: string, value: React.ReactNode, extra = "") => (
    <div className={`receipt-row ${extra}`}><span className="r-ic"><Raw html={icon} /></span><span className="r-label">{label}</span><span className="r-value mono">{value}</span></div>
  );
  return (
    <>
      <BackRow id="cvBackToForm" onClick={backToForm} />
      <div className="convert-visual"><Raw html={cvBadgeHtml(q.f)} /><span className="convert-arrow"><Raw html={WICON.convert} /></span><Raw html={cvBadgeHtml(q.to)} /></div>
      <div className="step-title mono" style={{ textAlign: "center", marginTop: "10px", fontSize: "26px" }}><Grey>{cvFmt(q.receive, q.to)}</Grey></div>
      <p className="step-sub" style={{ textAlign: "center", marginBottom: "2px" }}>You&apos;ll receive in {cvName(q.to)}</p>
      {/* The quote card (FND-06): rate, fee (₦[fee] for naira), what you get, then the 30-second countdown. */}
      <div className="receipt-card" id="cvQuoteCard" style={{ marginTop: "14px" }}>
        {row(WICON.convert, "You convert", <Grey>{cvFmt(q.amt, q.f)}</Grey>)}
        {row(WICON.globe, "Rate", <RateButton f={q.f} to={q.to} />)}
        {row(WICON.percent, cvFeeLabel(q), <Grey>{cvFeeText(q)}</Grey>)}
        {q.to.k === "coin" && (
          <div className="receipt-row"><span className="r-ic"><Raw html={WICON.globe} /></span><span className="r-label">Network</span><span className="r-value">{q.to.net} · {NETWORK[q.to.net].eta}</span></div>
        )}
        {row(WICON.coins, involvesNgn(q.f, q.to) ? "You get" : "You'll receive", <Grey>{cvFmt(q.receive, q.to)}</Grey>, "total")}
      </div>
      {q.f.k === "cash" && q.f.bucket === "fiat" && <p className="step-sub" style={{ fontSize: "11.5px", marginTop: "10px" }}>These funds stay card-funded (FIAT-ONLY) after conversion.</p>}
      <div className={`cv-timer ${expired ? "expired" : ""}`} id="cvTimer">
        {expired ? "Rate expired. Refresh to get a new rate." : <>Rate held for <span className="mono" id="cvTimerLeft">0:{String(left).padStart(2, "0")}</span></>}
      </div>
      {expired
        ? <SpinButton id="cvRefresh" delay={400} onClick={refresh}>Refresh rate</SpinButton>
        : <SpinButton id="cvConfirm" delay={400} onClick={confirm}>Convert</SpinButton>}
    </>
  );
}

/** tConvert 'processing'. */
export function ConvertProcessingScreen() {
  const { from, to, cents, jitter } = useConvert();
  const q = cvQuote(from, to, cents, jitter);
  return (
    <div className="center-col" style={{ paddingTop: "50px" }}>
      <div className="sending-dots"><span /><span /><span /></div>
      <div className="step-title" style={{ marginTop: "18px" }}>Converting&hellip;</div>
      <p className="step-sub"><Grey>{`${cvFmt(q.amt, q.f)} to ${cvUnit(q.to)}`}</Grey></p>
    </div>
  );
}

/** cvDone. */
export function ConvertDoneScreen() {
  const { result: r, close } = useConvert();
  if (!r) return null;
  const row = (icon: string, label: string, value: React.ReactNode, extra = "") => (
    <div className={`receipt-row ${extra}`}><span className="r-ic"><Raw html={icon} /></span><span className="r-label">{label}</span><span className="r-value mono">{value}</span></div>
  );
  return (
    <>
      <div className="center-col" style={{ paddingBottom: 0 }}>
        <div className="check-circle"><Raw html={CHECK_DRAW} /></div>
        <div className="step-title mono" style={{ marginTop: "2px", fontSize: "26px" }}><Grey>{r.receivedText}</Grey></div>
        <p className="step-sub">Added to your {toBalanceName(r.to)} balance</p>
        <span className="btn-ghost" id="cvViewTx" role="button" tabIndex={0}
          onClick={() => { close(); useWalletNav.getState().push({ name: "conversion", id: r.id }); }}>View transaction</span>
      </div>
      <div className="receipt-card" style={{ marginTop: "16px" }}>
        {row(WICON.convert, "Converted", <Grey>{r.paidText}</Grey>)}
        {row(WICON.globe, "Rate", <RateButton f={cvParse(r.from)} to={cvParse(r.to)} />)}
        {row(WICON.percent, r.feeLabel, <Grey>{r.feeText}</Grey>)}
        {row(WICON.hash, "Confirmation", r.ref, "total")}
      </div>
      <button className="btn-primary" id="cvDone" onClick={close}>Done</button>
    </>
  );
}

/**
 * 'empty': Convert opened with a target (e.g. NGN from Deposit NGN) and nothing can convert into it. NGN stays the
 * target. NEW copy from the brief.
 */
export function ConvertEmptyScreen() {
  const { to, close } = useConvert();
  const t = cvParse(to);
  return (
    <>
      <BackRow id="backHome" label="Wallet" onClick={close} />
      <div className="step-title">Convert</div>
      <p className="step-sub">Move money between your currencies and stablecoins.</p>
      <div className="cv-box">
        <div className="cv-box-top"><span>To</span><span>{t.k === "coin" ? `Arrives ${NETWORK[t.net].eta}` : "Arrives instantly"}</span></div>
        <div className="cv-box-row">
          <span className="cv-pick" id="cvPickTo" aria-disabled="true"><Raw html={cvBadgeHtml(t, 28)} /><span className="cv-pick-name">{cvShort(t)}</span></span>
        </div>
      </div>
      <div className="center-col" style={{ paddingTop: "18px" }}>
        <p className="step-sub" id="cvEmpty" style={{ textAlign: "center" }}>You have no USD or USDC to convert yet</p>
      </div>
      {/* USD and USDC deposits (tDepositSelect) aren't ported: the wallet's "not in the prototype" notice. */}
      <button className="btn-primary" id="cvEmptyDeposit" onClick={() => showNotPorted("USD and USDC deposits aren't ported yet.")}>Deposit</button>
    </>
  );
}

/** 'stepup': the reference's gateAmount step-up before converting. Naira conversions show the limit as ₦[limit]. */
export function ConvertStepUpScreen() {
  const { from, to, cents, jitter, gate, stepUpContinue } = useConvert();
  const tier = useNgn((s) => s.tier);
  const q = cvQuote(from, to, cents, jitter);
  const limit = involvesNgn(q.f, q.to) ? LIMIT_PLACEHOLDER : fmtCurrency(tier > 0 ? TIERS[tier as 1 | 2 | 3].txLimit * 100 : 0, "USD");
  return <StepUpIntro current={tier} target={gate?.needTier ?? tier + 1} limit={limit}
    onCancel={() => useConvert.setState({ stage: "review", gate: null })} onContinue={() => void stepUpContinue()} />;
}

/** 'limitBlocked': the reference's tLimitBlocked (over even Tier 3's limits). */
export function ConvertLimitBlockedScreen() {
  const { gate, close } = useConvert();
  const label = gate?.reason === "month" ? "this month" : gate?.reason === "day" ? "today" : "per transaction";
  return (
    <div className="center-col" style={{ paddingTop: "24px" }}>
      <div className="check-circle" style={{ background: "var(--warn-50)", color: "var(--warn-600)" }}><Raw html={WICON.alert} /></div>
      <div className="step-title">This exceeds Poket&apos;s limits</div>
      <p className="step-sub"><Grey>{`${fmtCurrency(gate?.usd ?? 0, "USD")} is more than Poket allows ${label}, even at ${TIERS[3].name}. Try a smaller amount${gate?.reason !== "transaction" ? " or wait until the limit resets" : ""}.`}</Grey></p>
      <button className="btn-secondary" id="limitBlockedClose" style={{ width: "100%" }} onClick={close}>Back</button>
    </div>
  );
}
