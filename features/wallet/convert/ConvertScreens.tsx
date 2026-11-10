"use client";
import { useEffect, useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { CHECK_DRAW, CV_CHEV, CV_FLIP, CV_RATE_SWAP, WICON } from "@/lib/icons";
import { BackRow, Grey, Keypad, SpinButton } from "../payout/parts";
import { cashAmount, cashBuckets } from "../useHoldings";
import {
  CV_QUOTE_SECONDS, NETWORK, cvAvail, cvBadgeHtml, cvBlockedPair, cvFmt, cvKey, cvName, cvOptions, cvParse, cvQuote,
  cvRateText, cvShort, cvType, cvUnit, cvUsdPer, fmtAsset, fmtPlain, type Side,
} from "./convertMath";
import { fmtCurrency } from "../payout/payoutMath";
import { useConvert } from "./useConvert";
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

/** tConvert 'form': the From and To panels, the quote line and the keypad. */
export function ConvertFormScreen() {
  useBalancesTick();
  const { from, to, cents, jitter, close, openPicker, flip, max, key, review } = useConvert();
  const q = cvQuote(from, to, cents, jitter);
  const over = q.amt > q.avail;
  const belowMin = q.amt > 0 && q.usd < 100;
  const hint = !q.type ? "Choose a different balance to convert to."
    : over ? `Exceeds available ${cvFmt(q.avail, q.f)}`
    : belowMin ? `Minimum is ${q.f.k === "cash" ? fmtCurrency(Math.ceil(100 / cvUsdPer(q.f)), q.f.cur) : fmtAsset(100, q.f.asset)}`
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
            <span className="cv-pick-name">{cvShort(q.f)}{q.f.k === "cash" && q.f.bucket === "fiat" && <span className="fiat-tag">FIAT-ONLY</span>}</span>
            <Raw html={CV_CHEV} />
          </button>
          <span className={`cv-amt mono ${over ? "err" : ""}`} id="cvFromAmt">{fmtPlain(q.amt)}</span>
        </div>
      </div>
      <div className="cv-flip-wrap"><button type="button" className="cv-flip" id="cvFlip" aria-label="Swap from and to" onClick={flip} dangerouslySetInnerHTML={{ __html: CV_FLIP }} /></div>
      <div className="cv-box">
        <div className="cv-box-top"><span>To</span><span>{q.to.k === "coin" ? `Arrives ${NETWORK[q.to.net].eta}` : "Arrives instantly"}</span></div>
        <div className="cv-box-row">
          <button type="button" className="cv-pick" id="cvPickTo" onClick={() => openPicker("to")}>
            <Raw html={cvBadgeHtml(q.to, 28)} />
            <span className="cv-pick-name">{cvShort(q.to)}</span>
            <Raw html={CV_CHEV} />
          </button>
          <span className="cv-amt mono muted" id="cvToAmt">{q.type ? "≈ " + fmtPlain(q.receive) : "—"}</span>
        </div>
      </div>
      {q.type && <div className="cv-meta"><RateButton f={q.f} to={q.to} /><span><Grey>{`${q.spec.label}: ${cvFmt(q.fee, q.f)}`}</Grey></span></div>}
      <div className={`cv-hint ${hint ? "err" : ""}`} id="cvHint"><Grey>{hint}</Grey></div>
      <Keypad dataKey="cvkey" onKey={key} />
      <SpinButton id="cvReview" style={{ marginTop: "8px" }} disabled={!(q.type && q.amt > 0 && !over && !belowMin)} delay={400} onClick={review}>Review</SpinButton>
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
    const blocked = !isFrom && cvBlockedPair(other, o);
    const same = !isFrom && !cvType(other, o);
    const t2 = isFrom ? `Available ${cvFmt(cvAvail(o), o)}`
      : blocked ? "Card-funded cash can't convert to stablecoins"
      : same ? "Same as the balance you convert from"
      : o.k === "coin" ? `Arrives ${NETWORK[o.net].eta}` : `Balance ${fmtCurrency(cashAmount(o.cur), o.cur)}`;
    return (
      <div key={key} className={`select-row ${sel ? "sel" : ""} ${blocked || same ? "cv-disabled" : ""}`} data-cvopt={key}
        {...(blocked ? { "data-cvblocked": "1" } : {})} {...(same ? { "aria-disabled": true } : {})} onClick={() => pick(key)}>
        <Raw html={cvBadgeHtml(o)} />
        <div className="meta">
          <div className="t1">{cvName(o)}{o.k === "cash" && o.bucket === "fiat" && <span className="fiat-tag">FIAT-ONLY</span>}</div>
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
      <div className="receipt-card" style={{ marginTop: "14px" }}>
        {row(WICON.convert, "You convert", <Grey>{cvFmt(q.amt, q.f)}</Grey>)}
        {row(WICON.globe, "Rate", <RateButton f={q.f} to={q.to} />)}
        {row(WICON.percent, q.spec.label, <Grey>{cvFmt(q.fee, q.f)}</Grey>)}
        {q.to.k === "coin" && (
          <div className="receipt-row"><span className="r-ic"><Raw html={WICON.globe} /></span><span className="r-label">Network</span><span className="r-value">{q.to.net} · {NETWORK[q.to.net].eta}</span></div>
        )}
        {row(WICON.coins, "You'll receive", <Grey>{cvFmt(q.receive, q.to)}</Grey>, "total")}
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
        <div className="step-title mono" style={{ marginTop: "2px", fontSize: "26px" }}><Grey>{r.received}</Grey></div>
        <p className="step-sub">Added to your {r.toName} balance</p>
        {/* TODO: opens the conversion (tx-detail) once conversions are in the activity list. */}
        <span className="btn-ghost" id="cvViewTx" role="button">View transaction</span>
      </div>
      <div className="receipt-card" style={{ marginTop: "16px" }}>
        {row(WICON.convert, "Converted", <Grey>{r.paid}</Grey>)}
        {row(WICON.globe, "Rate", <RateButton f={cvParse(r.fk)} to={cvParse(r.tk)} />)}
        {row(WICON.percent, r.feeLabel, <Grey>{r.fee}</Grey>)}
        {row(WICON.hash, "Confirmation", r.ref, "total")}
      </div>
      <button className="btn-primary" id="cvDone" onClick={close}>Done</button>
    </>
  );
}
