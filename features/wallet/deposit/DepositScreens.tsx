"use client";
import { useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { detectBrand, cardLen, cvcLen } from "@/lib/card";
import { CARD_FUND_RATE, cardFundFee, cardFundFlat, depositFeeText } from "@/lib/fees";
import { BRANDS, WICON } from "@/lib/icons";
import { fmtAsset } from "../convert/convertMath";
import { ASSET_NAME, CURRENCY_ICON, CURRENCY_NAME } from "../home/homeData";
import { TIERS } from "../limits";
import { holderName, useNgn, type Tier } from "../ngn/useNgn";
import { BackRow, Grey, Keypad, SpinButton } from "../payout/parts";
import { fmtCurrency } from "../payout/payoutMath";
import { DigitBoxes } from "../payout/screens/PinScreens";
import { StepUpIntro } from "../StepUpIntro";
import { CASH_CURRENCIES, COIN_ASSETS, NETWORKS, type CashCurrency, type CoinAsset } from "../useHoldings";
import { useWalletNav } from "../useWalletNav";
import { useWalletToast } from "../useWalletToast";
import { DEPOSIT_ADDRESS, NETWORK_INFO, useDeposit, type DepositChoice } from "./useDeposit";
import { VA_SPEC, type VaCurrency } from "./vaSpec";

const ASSET_ICON: Record<CoinAsset, "usdc" | "usdt"> = { USDC: "usdc", USDT: "usdt" };
const toast = (t: string) => useWalletToast.getState().showToast(t);
const copyText = (t: string) => { try { navigator.clipboard?.writeText(t).catch(() => {}); } catch { /* no clipboard */ } };
const brandKey = (name: string) => (Object.keys(BRANDS) as (keyof typeof BRANDS)[]).find((k) => BRANDS[k].name === name);
const cashCur = (c: DepositChoice | null) => (c?.k === "cash" ? c.cur : "USD") as VaCurrency;

/** seededRandom and buildQr, verbatim: a QR-like pattern with the network's icon in the middle. */
function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 8) / 0x1000000; };
}
function buildQr(seed: string, iconKey: keyof typeof WICON) {
  const modules = 21, size = 132, margin = 3, cell = (size - margin * 2) / modules, rand = seededRandom(seed);
  const isFinder = (x: number, y: number) => (x < 7 && y < 7) || (x >= 14 && y < 7) || (x < 7 && y >= 14);
  const isCenter = (x: number, y: number) => x >= 8 && x <= 12 && y >= 8 && y <= 12;
  const isSep = (x: number, y: number) => x === 7 || x === 13 || y === 7 || y === 13;
  const r = (x: number, y: number, w: number, fill: string) => `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${w.toFixed(2)}" fill="${fill}"/>`;
  let m = "";
  for (let y = 0; y < modules; y++) for (let x = 0; x < modules; x++) {
    if (isFinder(x, y) || isCenter(x, y) || isSep(x, y)) continue;
    if (rand() > 0.55) m += r(margin + x * cell, margin + y * cell, cell, "#111213");
  }
  const finder = (fx: number, fy: number) => r(margin + fx * cell, margin + fy * cell, cell * 7, "#111213") + r(margin + (fx + 1) * cell, margin + (fy + 1) * cell, cell * 5, "#fff") + r(margin + (fx + 2) * cell, margin + (fy + 2) * cell, cell * 3, "#111213");
  m += finder(0, 0) + finder(14, 0) + finder(0, 14);
  const cs = cell * 5, cx = margin + 8 * cell, cy = cx, pad = 5, is = cs - pad * 2;
  const inner = (WICON[iconKey] || "").replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  m += `<rect x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" width="${cs.toFixed(2)}" height="${cs.toFixed(2)}" rx="5" fill="#fff" stroke="#e5e7eb" stroke-width="1"/>`;
  m += `<svg x="${(cx + pad).toFixed(2)}" y="${(cy + pad).toFixed(2)}" width="${is.toFixed(2)}" height="${is.toFixed(2)}" viewBox="0 0 32 32">${inner}</svg>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${m}</svg>`;
}

/** tCardFund 'select': every currency (NGN goes on to its own flow) and every stablecoin on every network. */
function DepositSelect() {
  const { search, choice, set, selectContinue, close } = useDeposit();
  const q = search.trim().toLowerCase();
  const isSel = (c: DepositChoice) => JSON.stringify(c) === JSON.stringify(choice);
  const cash = CASH_CURRENCIES.filter((c) => !q || c.toLowerCase().includes(q) || CURRENCY_NAME[c].toLowerCase().includes(q))
    .sort((a, b) => Number(isSel({ k: "cash", cur: b })) - Number(isSel({ k: "cash", cur: a })));
  const coins = COIN_ASSETS.flatMap((asset) => NETWORKS.map((net) => ({ asset, net })))
    .filter(({ asset, net }) => !q || asset.toLowerCase().includes(q) || net.toLowerCase().includes(q) || ASSET_NAME[asset].toLowerCase().includes(q))
    .sort((a, b) => Number(isSel({ k: "coin", ...b })) - Number(isSel({ k: "coin", ...a })));
  const go = () => {
    // NGN keeps its own flow (temporary account, account details, Convert)
    if (choice?.k === "cash" && choice.cur === "NGN") { close(); useNgn.getState().open("deposit-method"); return; }
    selectContinue();
  };
  return (
    <>
      <BackRow id="backHome" label="Wallet" onClick={close} />
      {/* No subtitle: the title says it (docs/copy.md; the reference's "Choose what you'd like to deposit.") */}
      <div className="step-title">Deposit</div>
      <div className="field-icon-wrap">
        <span className="field-icon"><Raw html={WICON.search} /></span>
        <input className="field-input" id="depositSearch" placeholder="Search currency or stablecoin" value={search} onChange={(e) => set({ search: e.target.value })} />
      </div>
      <div style={{ margin: "0 -2px" }}>
        {cash.length > 0 && <label className="field-label">Cash</label>}
        {cash.map((cur) => (
          <div key={cur} className={`select-row ${isSel({ k: "cash", cur }) ? "sel" : ""}`} data-depositcash={cur} role="button" tabIndex={0} onClick={() => set({ choice: { k: "cash", cur } })}>
            <div className="badge"><Raw html={WICON[CURRENCY_ICON[cur]]} /></div>
            <div className="meta"><div className="t1">{CURRENCY_NAME[cur]}</div><div className="t2">{cur}</div></div>
            <div className="radio" />
          </div>
        ))}
        {coins.length > 0 && <label className="field-label" style={{ marginTop: "14px" }}>Stablecoin</label>}
        {coins.map(({ asset, net }) => (
          <div key={asset + net} className={`select-row ${isSel({ k: "coin", asset, net }) ? "sel" : ""}`} data-depositasset={asset} data-depositnet={net} role="button" tabIndex={0}
            onClick={() => set({ choice: { k: "coin", asset, net } })}>
            <div className="asset-icon-wrap"><div className="badge"><Raw html={WICON[ASSET_ICON[asset]]} /></div><span className="badge-network"><Raw html={WICON[NETWORK_INFO[net].icon]} /></span></div>
            <div className="meta"><div className="t1">{asset} on {net}</div><div className="t2">Deposit address</div></div>
            <div className="radio" />
          </div>
        ))}
        {!cash.length && !coins.length && <div style={{ fontSize: "12.5px", color: "var(--txt3)", padding: "8px 0 4px" }}>No matches for &ldquo;{search}&rdquo;.</div>}
      </div>
      <SpinButton id="depositSelectContinue" delay={500} style={{ marginTop: "10px" }} disabled={!choice} onClick={go}>Continue</SpinButton>
    </>
  );
}

/** tDepositMethod (not NGN): bank transfer to the currency's account details, or card. */
function DepositMethod() {
  const { choice, vas, back, bank, card } = useDeposit();
  const cur = cashCur(choice), va = vas[cur], spec = VA_SPEC[cur];
  const bankSub = !va ? `Get your own ${cur} account details. ${depositFeeText(cur)}.`
    : va.status === "ready" ? `To your ${cur} account · ${spec.arrives.split(" · ")[0]}` : "Your account is being set up";
  return (
    <>
      <BackRow id="backToDepositSelect" onClick={back} />
      <div className="step-title">Deposit {cur}</div>
      <div className="select-row" id="dmBank" role="button" tabIndex={0} onClick={bank}>
        <div className="va-ic"><Raw html={WICON.bank} /></div>
        <div className="meta"><div className="t1">Bank transfer</div><div className="t2"><Grey>{bankSub}</Grey></div></div>
        <span className="va-chev">{"›"}</span>
      </div>
      <div className="select-row" id="dmCard" role="button" tabIndex={0} onClick={card}>
        <div className="va-ic"><Raw html={WICON.card} /></div>
        <div className="meta"><div className="t1">Card</div><div className="t2">Instant. Card fees may apply.</div></div>
        <span className="va-chev">{"›"}</span>
      </div>
      <p className="step-sub" style={{ fontSize: "11.5px", marginTop: "12px" }}>Card deposits can&rsquo;t be converted to stablecoins. Bank transfers can.</p>
    </>
  );
}

/** tVa (not NGN): verify first, then the intro, creating, and the account details (or "setting up"). */
function DepositAccount() {
  const { choice, vas, vaStage, vaAgree, set, back, vaCreate } = useDeposit();
  const tier = useNgn((s) => s.tier);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const cur = cashCur(choice), spec = VA_SPEC[cur], va = vas[cur];
  const backRow = <BackRow id="vaBack" onClick={back} />;
  if (verifying) return <StepUpIntro current={tier} target={1} reason="Account details are in your verified name." onCancel={() => setVerifying(false)}
    onContinue={() => { useNgn.getState().set({ tier: 1 as Tier }); setVerifying(false); set({ vaStage: va ? "details" : "intro" }); }} />;
  if (vaStage === "locked") return (
    <>
      {backRow}
      <div className="center-col" style={{ paddingTop: "20px" }}>
        <div className="check-circle" style={{ background: "var(--surface)", color: "var(--txt2)" }}><Raw html={WICON.lockIc} /></div>
        <div className="step-title">Verify your identity first</div>
        <p className="step-sub">Account details are in your verified name, so we need to confirm who you are.</p>
        <button className="btn-primary" id="vaVerify" onClick={() => setVerifying(true)}>Verify identity</button>
      </div>
    </>
  );
  if (vaStage === "intro") return (
    <>
      {backRow}
      <div className="convert-visual" style={{ marginTop: "4px" }}><div className="badge"><Raw html={WICON[CURRENCY_ICON[cur]]} /></div><span className="convert-arrow"><Raw html={WICON.bank} /></span></div>
      <div className="step-title" style={{ textAlign: "center", marginTop: "10px" }}>Get {cur} account details</div>
      <p className="step-sub" style={{ textAlign: "center" }}>Share them with your bank, employer or clients. Money sent to them lands in your {cur} balance.</p>
      <div className="receipt-card" id="vaIntroRows">
        <div className="receipt-row"><span className="r-ic"><Raw html={WICON.user} /></span><span className="r-label">Name on account</span><span className="r-value">{holderName()}</span></div>
        <div className="receipt-row"><span className="r-ic"><Raw html={WICON.bank} /></span><span className="r-label">Receive by</span><span className="r-value">{spec.rails}</span></div>
        <div className="receipt-row"><span className="r-ic"><Raw html={WICON.info} /></span><span className="r-label">Arrives</span><span className="r-value">{spec.arrives.split(" · ")[0]}</span></div>
        {/* The deposit fee (lib/fees.ts), in place of the reference's "Free to receive" */}
        <div className="receipt-row"><span className="r-ic"><Raw html={WICON.percent} /></span><span className="r-label">Fees</span><span className="r-value" id="vaFee">{depositFeeText(cur)}</span></div>
      </div>
      <p className="step-sub" style={{ fontSize: "11.5px", marginTop: "10px" }}>Money you receive here can be converted to stablecoins.</p>
      <div className="consent-row" style={{ marginTop: "12px" }}>
        <input type="checkbox" id="vaAgree" checked={vaAgree} onChange={(e) => set({ vaAgree: e.target.checked })} />
        <label htmlFor="vaAgree">Accept the <span className="consent-link">account terms</span> of Poket&rsquo;s partner bank, {spec.bank}</label>
      </div>
      <button className="btn-primary" id="vaCreate" disabled={!vaAgree} onClick={vaCreate}>Create account details</button>
    </>
  );
  if (vaStage === "creating" || !va) return (
    <div className="center-col" style={{ paddingTop: "50px" }}>
      <div className="spinner" />
      <div className="step-title" style={{ marginTop: "16px" }}>Creating your {cur} account</div>
      <p className="step-sub">This usually takes a few seconds.</p>
    </div>
  );
  if (va.status === "pending") return (
    <>
      {backRow}
      <div className="center-col" style={{ paddingTop: "20px" }} id="vaPending">
        <div className="check-circle" style={{ background: "var(--brand-50)", color: "var(--brand-600)" }}><Raw html={WICON.info} /></div>
        <div className="step-title">We&rsquo;re setting up your {cur} account</div>
        <p className="step-sub">{spec.bank} is reviewing it. This usually takes 1-2 business days. We&rsquo;ll notify you when it&rsquo;s ready.</p>
        <p className="step-sub" style={{ fontSize: "12px" }}>You can still deposit by card in the meantime.</p>
      </div>
    </>
  );
  const fields: [string, string][] = [["Account name", holderName()], ...spec.fields(va.num)];
  const share = () => {
    const text = fields.map(([k, v]) => `${k}: ${v}`).join("\n");
    if (navigator.share) navigator.share({ title: `${cur} account details`, text }).catch(() => {});
    else { copyText(text); toast("Account details copied"); }
  };
  const letter = () => {
    const rows = fields.map(([k, v]) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`).join("");
    const html = `<!doctype html><meta charset="utf-8"><title>${cur} account confirmation</title><body style="font-family:system-ui;max-width:640px;margin:40px auto;color:#111"><h2>Account confirmation</h2><p>This confirms that the account below is held in the name of <b>${holderName()}</b> with ${spec.bank}, through Poket.</p><table cellpadding="6">${rows}</table></body>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `poket-${cur.toLowerCase()}-account-confirmation.html`;
    a.click();
    useWalletToast.getState().showNotice("Confirmation letter downloaded", `${cur} account in ${holderName()}’s name.`, 2600);
  };
  return (
    <>
      {backRow}
      <div className="step-title">{cur} account details</div>
      <p className="step-sub">Send {cur} by {spec.rails}. {spec.arrives}.</p>
      <div className="va-details" id="vaDetails">
        {fields.map(([k, v], i) => (
          <div className="va-field" key={k}>
            <div><div className="va-k">{k}</div><div className={`va-v ${/number|IBAN|BIC|code/i.test(k) ? "mono" : ""}`}>{v}</div></div>
            {!/type|Branch/i.test(k) && <button type="button" className="va-copy" data-vacopy={i} aria-label={`Copy ${k}`}
              onClick={() => { copyText(v); setCopied(i); setTimeout(() => setCopied((c) => (c === i ? null : c)), 1200); }}>{copied === i ? "Copied" : "Copy"}</button>}
          </div>
        ))}
      </div>
      <div className="va-actions">
        <button className="btn-secondary" id="vaShare" onClick={share}>Share details</button>
        <button className="btn-secondary" id="vaLetter" onClick={letter}>Confirmation letter</button>
      </div>
      <div className="va-note" id="vaNote">Anyone can send to these details. Money you receive can be converted to stablecoins. {depositFeeText(cur)}, out of what arrives.</div>
    </>
  );
}

/** tCardFund 'amount': tap the amount for the keypad; the card fee and what the card is charged. */
function CardAmount() {
  const { choice, cents, keypadOpen, set, back, key } = useDeposit();
  const cur = cashCur(choice), fee = cardFundFee(cents, cur);
  return (
    <>
      <BackRow id="backToDepositSelect" onClick={back} />
      <div className="center-col" style={{ padding: "4px 0 2px" }}><div className="badge" style={{ width: "36px", height: "36px" }}><Raw html={WICON[CURRENCY_ICON[cur]]} /></div></div>
      <div className="step-title" style={{ textAlign: "center" }}>Add {cur}</div>
      <div className="amount-display" id="amountTapTarget" role="button" tabIndex={0} style={{ cursor: "pointer", padding: keypadOpen ? "20px 0 6px" : "56px 0 6px" }} onClick={() => set({ keypadOpen: true })}>
        <span className="amount-value"><Grey>{fmtCurrency(cents, cur)}</Grey></span>
      </div>
      {!keypadOpen ? <p className="step-sub" style={{ textAlign: "center" }}>Tap the amount to enter how much to add.</p> : (
        <>
          <div className="info-card" id="cardFundFeeCard">
            <div className="info-row"><span>Amount</span><span id="cfAmtRow"><Grey>{fmtCurrency(cents, cur)}</Grey></span></div>
            <div className="info-row"><span>Card funding fee ({(CARD_FUND_RATE * 100).toFixed(1)}% + {fmtCurrency(cardFundFlat(cur), cur).replace(/ [A-Z]{3}$/, "")})</span><span id="cfFeeRow"><Grey>{fmtCurrency(fee, cur)}</Grey></span></div>
            <div className="info-row"><span style={{ fontWeight: 600, color: "var(--n-900)" }}>Total charged</span><span id="cfTotalRow" style={{ fontWeight: 600, color: "var(--n-900)" }}><Grey>{fmtCurrency(cents + fee, cur)}</Grey></span></div>
          </div>
          <SpinButton id="cardFundAmtContinue" delay={700} style={{ marginBottom: "12px" }} disabled={cents <= 0} onClick={() => set({ stage: "select-card" })}>Continue</SpinButton>
          <Keypad dataKey="key" onKey={key} />
        </>
      )}
    </>
  );
}

/** tCardFund 'select-card': a saved card, or a new one. */
function CardPick() {
  const { choice, cents, savedCards, cardId, set, back } = useDeposit();
  const cur = cashCur(choice);
  return (
    <>
      <BackRow id="backToCardFundAmt" onClick={back} />
      <div className="step-title">Pay with</div>
      {/* What the card is charged: the amount and the card fee */}
      <p className="step-sub"><Grey>{`${fmtCurrency(cents + cardFundFee(cents, cur), cur)} will be charged to this card.`}</Grey></p>
      <div style={{ margin: "0 -2px" }}>
        {savedCards.map((c) => {
          const b = brandKey(c.brand);
          return (
            <div key={c.id} className={`select-row ${cardId === c.id ? "sel" : ""}`} data-cardpick={c.id} role="button" tabIndex={0} onClick={() => set({ cardId: c.id })}>
              <div className="badge badge-brand">{b ? <Raw html={BRANDS[b].mark} /> : <span style={{ display: "inline-flex", color: "var(--txt2)" }}><Raw html={WICON.card} /></span>}</div>
              <div className="meta"><div className="t1">{c.nickname}</div><div className="t2 mono">{c.brand} · •••• {c.last4}</div></div>
              <div className="radio" />
            </div>
          );
        })}
      </div>
      <button className="btn-secondary" id="addNewCardBtn" style={{ width: "100%", margin: "10px 0 14px" }} onClick={() => set({ stage: "card" })}>+ Add new card</button>
      <SpinButton id="cardPickContinue" delay={700} disabled={!cardId} onClick={() => set({ stage: "3ds" })}>Continue</SpinButton>
    </>
  );
}

/** "MM/YYYY", valid until the end of that month. */
const expiryValid = (v: string) => {
  const m = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(v);
  return !!m && new Date(+m[2], +m[1], 0, 23, 59) >= new Date();
};

/** tCardFund 'card': a new card, in the account holder's name. */
function CardForm() {
  const { choice, cents, back, addCard } = useDeposit();
  const cur = cashCur(choice);
  const [f, setF] = useState({ num: "", exp: "", cvv: "", zip: "", name: "", terms: false });
  const digits = f.num.replace(/\D/g, ""), b = detectBrand(digits);
  const legal = holderName();
  const nameMatch = !!f.name && f.name.trim().toLowerCase() === legal.toLowerCase();
  const expFilled = f.exp.length === 7, expOk = !expFilled || expiryValid(f.exp);
  const complete = !!b && digits.length === cardLen(b) && expFilled && expOk && f.cvv.length === cvcLen(b) && /^\d{5}(-\d{4})?$/.test(f.zip) && !!f.name;
  const fmtNum = (d: string) => (b === "amex" ? [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ") : d.slice(0, 16).replace(/(.{4})/g, "$1 ").trim());
  return (
    <>
      <BackRow id="backToCardSelect" onClick={back} />
      <div className="step-title">Add new card</div>
      <p className="step-sub"><Grey>{`${fmtCurrency(cents + cardFundFee(cents, cur), cur)} will be charged to this card.`}</Grey></p>
      <label className="field-label" htmlFor="cardNumberInput">Card number</label>
      <div className="card-num-wrap">
        <input className="field-input mono" id="cardNumberInput" placeholder="4242 4242 4242 4242" value={f.num} maxLength={19} autoComplete="cc-number" inputMode="numeric"
          onChange={(e) => setF({ ...f, num: fmtNum(e.target.value.replace(/\D/g, "")) })} />
        <span className="card-num-mark" id="cardBrandMark">{b && <Raw html={BRANDS[b].mark} />}</span>
      </div>
      {digits.length >= 4 && !b && <div id="cardNumHint" style={{ margin: "-8px 0 14px", fontSize: "11.5px", color: "var(--err-600)" }}>We don&rsquo;t recognise this card. Poket accepts Visa, Mastercard, Amex, Discover and Verve.</div>}
      <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
        <input className="field-input mono" id="cardExpiryInput" placeholder="MM/YYYY" value={f.exp} maxLength={7} style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
          onChange={(e) => { let v = e.target.value.replace(/\D/g, "").slice(0, 6); if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2); setF({ ...f, exp: v }); }} />
        <input className="field-input mono" id="cardCvvInput" placeholder={b === "amex" ? "1234" : "CVC"} value={f.cvv} maxLength={cvcLen(b)} style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
          onChange={(e) => setF({ ...f, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
        <input className="field-input mono" id="cardZipInput" placeholder="ZIP" value={f.zip} maxLength={10} style={{ marginBottom: 0, flex: 1, minWidth: 0 }}
          onChange={(e) => { let v = e.target.value.replace(/\D/g, "").slice(0, 9); if (v.length > 5) v = v.slice(0, 5) + "-" + v.slice(5); setF({ ...f, zip: v }); }} />
      </div>
      {expFilled && !expOk && <div id="expiryHint" style={{ margin: "0 0 14px", fontSize: "11.5px", color: "var(--err-600)" }}>Card has expired</div>}
      <label className="field-label" htmlFor="cardNameInput">Cardholder name</label>
      <input className="field-input" id="cardNameInput" placeholder="Name on card" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value.replace(/[0-9]/g, "") })} />
      {f.name && <div id="nameMatchHint" style={{ margin: "-8px 0 14px", fontSize: "11.5px", color: nameMatch ? "var(--ok-600)" : "var(--err-600)" }}>
        {nameMatch ? "Matches verified account holder" : `Must match account holder: ${legal}`}</div>}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "16px" }}>
        <input type="checkbox" id="termsCheck" style={{ marginTop: "3px" }} checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} />
        <label htmlFor="termsCheck" style={{ fontSize: "12px", color: "var(--txt2)", lineHeight: 1.5 }}>I authorize Poket to charge this card for this deposit.</label>
      </div>
      <SpinButton id="cardContinue" delay={800} disabled={!(complete && nameMatch && f.terms)}
        onClick={() => addCard({ last4: digits.slice(-4), brand: b ? BRANDS[b].name : "Card" })}>Add money</SpinButton>
    </>
  );
}

/** tCardFund '3ds': the bank's passcode. */
function ThreeDs() {
  const verify = useDeposit((s) => s.verify);
  const [code, setCode] = useState("");
  return (
    <>
      <div className="step-title">Enter passcode</div>
      <p className="step-sub">Your bank sent a 6-digit code to your registered device to confirm this payment.</p>
      <div id="threeDsRow"><DigitBoxes count={6} label={(i) => `Digit ${i + 1}`} delay={0} onComplete={setCode} /></div>
      <button className="btn-primary" id="verify3ds" disabled={code.length !== 6} onClick={verify}>Verify</button>
    </>
  );
}

function Working({ title, sub }: { title: string; sub: string }) {
  return <div className="center-col"><div className="spinner" /><div className="step-title" style={{ marginTop: "16px" }}>{title}</div><p className="step-sub">{sub}</p></div>;
}

/** tCardFund 'done'. */
function CardDone() {
  const { records, last, close } = useDeposit();
  const r = records.find((x) => x.id === last);
  if (!r) return null;
  const cur = r.unit as CashCurrency;
  return (
    <>
      <div className="center-col" style={{ paddingBottom: 0 }}>
        <div className="asset-icon-wrap" style={{ marginBottom: "14px" }}>
          <div className="check-circle" style={{ marginBottom: 0 }}><Raw html={WICON.check} /></div>
          <span className="check-badge"><Raw html={WICON[CURRENCY_ICON[cur]]} /></span>
        </div>
        <div className="step-title mono" style={{ marginTop: "2px", fontSize: "26px" }} id="depositDoneAmount"><Grey>{fmtCurrency(r.amount, cur)}</Grey></div>
        <p className="step-sub">Added to your {cur} balance</p>
      </div>
      <div className="receipt-card" id="cardFundDoneCard">
        <div className="receipt-row"><span className="r-ic"><Raw html={WICON.card} /></span><span className="r-label">Card</span><span className="r-value mono">{r.sub}</span></div>
        <div className="receipt-row"><span className="r-ic"><Raw html={WICON.percent} /></span><span className="r-label">Card fee</span><span className="r-value"><Grey>{fmtCurrency(r.fee, cur)}</Grey></span></div>
        <div className="receipt-row"><span className="r-ic"><Raw html={WICON.hash} /></span><span className="r-label">Reference</span><span className="r-value mono">{r.ref}</span></div>
        <div className="receipt-row total"><span className="r-ic"><Raw html={WICON.check} /></span><span className="r-label">Total charged</span><span className="r-value"><Grey>{fmtCurrency(r.gross, cur)}</Grey></span></div>
      </div>
      <p className="fine-print"><Raw html={WICON.info} /><span>This will appear on your bank statement as <b>POKET</b>.</span></p>
      <button className="btn-primary" id="cardFundDone" onClick={close}>Done</button>
    </>
  );
}

/** tAddMoney 'address': the stablecoin's deposit address on its network. */
function CoinAddress() {
  const { choice, back, simulateCoin } = useDeposit();
  const [copied, setCopied] = useState(false);
  if (choice?.k !== "coin") return null;
  const { asset, net } = choice, n = NETWORK_INFO[net];
  const short = DEPOSIT_ADDRESS.slice(0, 10) + "…" + DEPOSIT_ADDRESS.slice(-8);
  const share = () => {
    if (navigator.share) navigator.share({ title: "Deposit address", text: DEPOSIT_ADDRESS }).catch(() => {});
    else { copyText(DEPOSIT_ADDRESS); toast("Address copied"); }
  };
  return (
    <>
      <BackRow id="backFundSelect" label="Deposit" onClick={back} />
      <div className="center-col" style={{ padding: "2px 0 4px" }}>
        <div className="asset-icon-wrap">
          <div className="badge" style={{ width: "44px", height: "44px" }}><Raw html={WICON[ASSET_ICON[asset]]} /></div>
          <span className="badge-network"><Raw html={WICON[n.icon]} /></span>
        </div>
      </div>
      <div className="step-title" style={{ textAlign: "center" }}>Deposit {asset}</div>
      <p className="step-sub" style={{ textAlign: "center" }}>Send only {asset} on {net} to this address.</p>
      <div className="deposit-box">
        <div className="qr-wrap" dangerouslySetInnerHTML={{ __html: buildQr(asset + net, n.icon) }} />
        <div className="addr-row">
          <span className="mono addr-text" id="depositAddress" title={DEPOSIT_ADDRESS}>{short}</span>
          <span className="copy-btn" id="copyAddr" role="button" tabIndex={0} data-addr={DEPOSIT_ADDRESS}
            onClick={() => { copyText(DEPOSIT_ADDRESS); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
            <Raw html={copied ? WICON.check : WICON.copy} /> {copied ? "Copied" : "Copy"}</span>
        </div>
      </div>
      <div className="receipt-card" id="addressRows">
        <div className="receipt-row"><span className="r-ic"><Raw html={WICON.network} /></span><span className="r-label">Network</span>
          <span className="r-value" style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}><span className="icon-16"><Raw html={WICON[n.dot]} /></span>{net}</span></div>
        <div className="receipt-row"><span className="r-ic"><Raw html={WICON.coins} /></span><span className="r-label">Minimum deposit</span><span className="r-value">{n.min} {asset}</span></div>
        <div className="receipt-row total"><span className="r-ic"><Raw html={WICON.calendar} /></span><span className="r-label">Credited after</span><span className="r-value">{n.conf} ({n.eta})</span></div>
      </div>
      <div className="action-row" style={{ marginBottom: "14px" }}>
        <button className="btn-secondary" id="shareAddr" onClick={share}>Share address</button>
        <button className="btn-secondary" id="simulateDeposit" onClick={simulateCoin}>Simulate deposit</button>
      </div>
      <p className="fine-print" style={{ justifyContent: "center", alignItems: "center", marginBottom: "4px" }}>
        <span className="spinner" style={{ width: "13px", height: "13px", borderWidth: "2px", margin: 0 }} /><span>Waiting for deposit on {net}…</span></p>
    </>
  );
}

/** tAddMoney 'done'. */
function CoinDone() {
  const { records, last, choice, close } = useDeposit();
  const r = records.find((x) => x.id === last);
  if (!r || choice?.k !== "coin") return null;
  const n = NETWORK_INFO[choice.net];
  return (
    <>
      <div className="center-col" style={{ paddingBottom: 0 }}>
        <div className="asset-icon-wrap" style={{ marginBottom: "14px" }}>
          <div className="check-circle" style={{ marginBottom: 0 }}><Raw html={WICON.check} /></div>
          <span className="check-badge"><Raw html={WICON[ASSET_ICON[choice.asset]]} /></span>
        </div>
        <div className="step-title mono" style={{ marginTop: "2px", fontSize: "26px" }} id="depositDoneAmount">{fmtAsset(r.amount, choice.asset)}</div>
        <p className="step-sub">Added to your wallet balance</p>
        <span className="btn-ghost" id="viewFundTx" role="button" tabIndex={0} onClick={() => { close(); useWalletNav.getState().push({ name: "deposit", id: r.id }); }}>View transaction</span>
      </div>
      <div className="receipt-card" style={{ marginTop: "16px" }}>
        <div className="receipt-row total"><span className="r-ic"><Raw html={WICON.network} /></span><span className="r-label">Network</span>
          <span className="r-value" style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}><span className="icon-16"><Raw html={WICON[n.dot]} /></span>{choice.net}</span></div>
      </div>
      <button className="btn-primary" id="fundDone" style={{ marginTop: "18px" }} onClick={close}>Done</button>
    </>
  );
}

/** gateAmount's step-up, and the reference's tLimitBlocked (as Convert's). */
function DepositStepUp() {
  const { gate, choice, stepUpContinue, set } = useDeposit();
  const tier = useNgn((s) => s.tier);
  const limit = fmtCurrency(tier > 0 ? TIERS[tier as 1 | 2 | 3].txLimit * 100 : 0, "USD");
  return <StepUpIntro current={tier} target={gate && "needTier" in gate ? gate.needTier : tier + 1} limit={limit}
    onCancel={() => set({ stage: choice?.k === "coin" ? "address" : "select-card", gate: null })} onContinue={stepUpContinue} />;
}
function DepositLimitBlocked() {
  const { gate, close } = useDeposit();
  const g = gate && "reason" in gate ? gate : null;
  const label = g?.reason === "month" ? "this month" : g?.reason === "day" ? "today" : "per transaction";
  return (
    <div className="center-col" style={{ paddingTop: "24px" }}>
      <div className="check-circle" style={{ background: "var(--warn-50)", color: "var(--warn-600)" }}><Raw html={WICON.alert} /></div>
      <div className="step-title">This exceeds Poket&rsquo;s limits</div>
      <p className="step-sub"><Grey>{`${fmtCurrency(g?.usd ?? 0, "USD")} is more than Poket allows ${label}, even at ${TIERS[3].name}. Try a smaller amount${g?.reason !== "transaction" ? " or wait until the limit resets" : ""}.`}</Grey></p>
      <button className="btn-secondary" id="limitBlockedClose" style={{ width: "100%" }} onClick={close}>Back</button>
    </div>
  );
}

/** The open Deposit flow (WalletBody). */
export function DepositBody() {
  const { stage, choice } = useDeposit();
  return (
    <div className="screen-fade" key={stage ?? ""}>
      {stage === "select" && <DepositSelect />}
      {stage === "method" && <DepositMethod />}
      {stage === "va" && <DepositAccount />}
      {stage === "amount" && <CardAmount />}
      {stage === "select-card" && <CardPick />}
      {stage === "card" && <CardForm />}
      {stage === "3ds" && <ThreeDs />}
      {stage === "authorizing" && <Working title="Authorizing payment" sub="Confirming with your card issuer." />}
      {stage === "card-done" && <CardDone />}
      {stage === "address" && <CoinAddress />}
      {stage === "confirming" && <Working title={`Confirming on ${choice?.k === "coin" ? choice.net : ""}`} sub="Usually takes a few seconds in demo." />}
      {stage === "coin-done" && <CoinDone />}
      {stage === "stepup" && <DepositStepUp />}
      {stage === "limitBlocked" && <DepositLimitBlocked />}
    </div>
  );
}

