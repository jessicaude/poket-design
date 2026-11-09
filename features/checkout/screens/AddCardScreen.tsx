"use client";
import { useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { BRANDS, ICON } from "@/lib/icons";
import { cardLen, cvcLen, detectBrand, expiryOk, formatCardNumber, formatExpiry, fundingOf } from "@/lib/card";
import { useAccount } from "@/store/account";
import { useCheckout } from "../useCheckout";

/** SCREENS['add-card'] */
export function AddCardScreen() {
  const { go, select } = useCheckout();
  const { account, update } = useAccount();
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [zip, setZip] = useState("");
  const [save, setSave] = useState(true);
  if (!account) return null;

  const digits = num.replace(/\D/g, ""), brand = detectBrand(digits), cvcN = cvcLen(brand);
  const expBad = exp.length === 9 && !expiryOk(exp);
  const unsupported = digits.length >= 4 && !brand;
  const ok = !!brand && digits.length === cardLen(brand) && expiryOk(exp) && cvc.length === cvcN && zip.length === 5;

  function saveCard() {
    if (!ok || !brand) return;
    const funding = fundingOf(digits);
    const id = "pm_" + Math.random().toString(36).slice(2, 8);
    update((a) => ({ ...a, methods: [...a.methods, {
      id, kind: "card", brand, last4: digits.slice(-4), name: `${BRANDS[brand].name} ••• ${digits.slice(-4)}`,
      sub: `${funding === "credit" ? "Credit" : "Debit"} · Expires ${exp.replace(" / ", "/")}${save ? "" : " · This payment only"}`, oneTime: !save,
    }] }));
    select(id);
    go("pay");
  }

  return (
    <>
      <button className="link nav-back" onClick={() => go("add-method")}><Raw html={ICON.back} /> Back</button>
      <h2 className="title">Add a card</h2>
      <p className="sub">Must be in your legal name, {account.first} {account.last}.</p>
      <label className="lbl" htmlFor="cNum">Card number</label>
      <div className="card-field">
        <input className="field mono" id="cNum" inputMode="numeric" placeholder="0000 0000 0000 0000" autoComplete="cc-number" autoFocus
          value={num} onChange={(e) => setNum(formatCardNumber(e.target.value))} aria-describedby="cBrandLbl" />
        <span className="card-brand" aria-hidden="true">{brand && <Raw html={BRANDS[brand].mark} />}</span>
        <span className="sr-only" id="cBrandLbl" aria-live="polite">{brand ? `${BRANDS[brand].name} card` : ""}</span>
      </div>
      <div className="row c3" style={{ gridTemplateColumns: "1.3fr 1fr 1fr" }}>
        <div><label className="lbl" htmlFor="cExp">Expiry</label><input className="field mono" id="cExp" inputMode="numeric" placeholder="MM / YYYY" maxLength={9} value={exp} onChange={(e) => setExp(formatExpiry(e.target.value))} /></div>
        <div><label className="lbl" htmlFor="cCvc">CVC</label><input className="field mono" id="cCvc" inputMode="numeric" placeholder={brand === "amex" ? "1234" : "123"} maxLength={cvcN} value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, ""))} /></div>
        <div><label className="lbl" htmlFor="cZip">ZIP code</label><input className="field mono" id="cZip" inputMode="numeric" placeholder="00000" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} /></div>
      </div>
      <div>
        {expBad && <p className="err">This card has expired. Use a card that’s still valid.</p>}
        {!expBad && unsupported && <p className="err">We don’t recognise this card. Poket accepts Visa, Mastercard, Amex, Discover and Verve.</p>}
      </div>
      <label className="check"><input type="checkbox" id="cSave" checked={save} onChange={(e) => setSave(e.target.checked)} /><span>Save this card for next time</span></label>
      <button className="btn" id="cGo" disabled={!ok} onClick={saveCard}>{save ? "Save card" : "Use this card"}</button>
      <div className="center"><button className="btn ghost" onClick={() => go("add-method")}>Other payment methods</button></div>
    </>
  );
}
