"use client";
import { useState, type ReactNode } from "react";
import { Raw } from "@/components/ui/Raw";
import { BRANDS } from "@/lib/icons";
import { cardLen, cvcLen, detectBrand, expiryComplete, expiryOk, formatCardNumber, formatExpiry, fundingOf, luhnOk, type BrandKey } from "@/lib/card";

/** A card that passed the form's checks. */
export type NewCard = { brand: BrandKey; digits: string; last4: string; exp: string; funding: "credit" | "debit" };

/**
 * The one card form (Checkout's SCREENS['add-card'], shared with the wallet's card top-up so they can't drift), in
 * Checkout's classes; the wallet renders it inside .su (styles/wallet-signup.css). The number with its brand mark
 * (detected as it's typed) and a Luhn check; the expiry as MM / YY, a real month in the future; the CVC at the
 * brand's length (4 for Amex); the ZIP code where it's asked for (US cards); then, where given, the cardholder name,
 * which must match the account holder, and the authorisation to tick. Errors show inline as they're found, and the
 * button stays disabled until everything is valid.
 */
export function CardForm({ askZip, holder, authorize, extra, submitId = "cGo", submitLabel, onSubmit }: {
  askZip: boolean;
  /** The account holder's legal name: the cardholder name must match it. */
  holder?: string;
  /** The authorisation to tick before submitting. */
  authorize?: string;
  /** More above the button (Checkout's "Save this card for next time"). */
  extra?: ReactNode;
  submitId?: string;
  submitLabel: string;
  onSubmit: (card: NewCard) => void;
}) {
  const [num, setNum] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [zip, setZip] = useState("");
  const [name, setName] = useState("");
  const [authorized, setAuthorized] = useState(false);

  const digits = num.replace(/\D/g, ""), brand = detectBrand(digits), cvcN = cvcLen(brand);
  const numFull = !!brand && digits.length === cardLen(brand);
  const numErr = digits.length >= 4 && !brand ? "We don’t recognise this card. Poket accepts Visa, Mastercard, Amex, Discover and Verve."
    : numFull && !luhnOk(digits) ? "Check the card number. It isn’t valid." : null;
  const monthBad = exp.length >= 2 && !/^(0[1-9]|1[0-2])/.test(exp);
  const expErr = monthBad ? "Check the expiry month." : expiryComplete(exp) && !expiryOk(exp) ? "This card has expired. Use a card that’s still valid." : null;
  const nameMatch = !holder || name.trim().toLowerCase() === holder.trim().toLowerCase();
  const ok = numFull && luhnOk(digits) && expiryOk(exp) && cvc.length === cvcN && (!askZip || zip.length === 5)
    && (!holder || (!!name.trim() && nameMatch)) && (!authorize || authorized);

  return (
    <>
      <label className="lbl" htmlFor="cNum">Card number</label>
      <div className="card-field">
        <input className={`field mono ${numErr ? "bad" : ""}`} id="cNum" inputMode="numeric" placeholder="0000 0000 0000 0000" autoComplete="cc-number"
          value={num} onChange={(e) => setNum(formatCardNumber(e.target.value))} aria-describedby="cBrandLbl cNumErr" aria-invalid={!!numErr} />
        <span className="card-brand" id="cBrandMark" aria-hidden="true">{brand && <Raw html={BRANDS[brand].mark} />}</span>
        <span className="sr-only" id="cBrandLbl" aria-live="polite">{brand ? `${BRANDS[brand].name} card` : ""}</span>
      </div>
      {numErr && <p className="err" id="cNumErr" role="alert">{numErr}</p>}
      <div className="row c3" style={{ gridTemplateColumns: askZip ? "1.3fr 1fr 1fr" : "1.3fr 1fr" }}>
        <div><label className="lbl" htmlFor="cExp">Expiry</label><input className={`field mono ${expErr ? "bad" : ""}`} id="cExp" inputMode="numeric" placeholder="MM / YY" maxLength={7} autoComplete="cc-exp" aria-invalid={!!expErr} value={exp} onChange={(e) => setExp(formatExpiry(e.target.value))} /></div>
        <div><label className="lbl" htmlFor="cCvc">CVC</label><input className="field mono" id="cCvc" inputMode="numeric" placeholder={brand === "amex" ? "1234" : "123"} maxLength={cvcN} autoComplete="cc-csc" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, cvcN))} /></div>
        {askZip && <div><label className="lbl" htmlFor="cZip">ZIP code</label><input className="field mono" id="cZip" inputMode="numeric" placeholder="00000" maxLength={5} autoComplete="postal-code" value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} /></div>}
      </div>
      {expErr && <p className="err" id="cExpErr" role="alert">{expErr}</p>}
      {holder !== undefined && (
        <>
          <label className="lbl" htmlFor="cName">Cardholder name</label>
          <input className={`field ${name.trim() && !nameMatch ? "bad" : ""}`} id="cName" placeholder="Name on card" autoComplete="cc-name" value={name}
            onChange={(e) => setName(e.target.value.replace(/[0-9]/g, ""))} aria-invalid={!!name.trim() && !nameMatch} />
          {name.trim() && (nameMatch
            ? <p className="hint" id="cNameOk">Matches verified account holder</p>
            : <p className="err" id="cNameErr" role="alert">Must match account holder: {holder}</p>)}
        </>
      )}
      {authorize && <label className="check"><input type="checkbox" id="cAuth" checked={authorized} onChange={(e) => setAuthorized(e.target.checked)} /><span>{authorize}</span></label>}
      {extra}
      <button className="btn" id={submitId} disabled={!ok}
        onClick={() => { if (ok && brand) onSubmit({ brand, digits, last4: digits.slice(-4), exp, funding: fundingOf(digits) }); }}>{submitLabel}</button>
    </>
  );
}
