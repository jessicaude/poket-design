"use client";
import { Raw } from "@/components/ui/Raw";
import { BANK_MARK, BRANDS, ICON } from "@/lib/icons";
import { useEffect, useState } from "react";
import { formatOrder, money } from "@/lib/money";
import { isBlockedMethod, isConverting, nairaOnlyText, newQuote, QUOTE_SECONDS, quoteLeft, quoteRateText, quoteUsdCents } from "../quote";
import type { OrderCurrency } from "@/store/demo";
import { useAccount, type PaymentMethod } from "@/store/account";
import { useCheckout } from "../useCheckout";

/** Card brand mark or bank icon, as in the prototype's methodMark() */
export const methodMark = (m: PaymentMethod) => (m.kind === "bank" ? BANK_MARK : m.brand ? BRANDS[m.brand].mark : "");

/** "$23.40 USD" or "₦36,270.00 NGN", with the currency code styled by .cur */
export function MoneyU({ minor, currency }: { minor: number; currency: OrderCurrency }) {
  const text = formatOrder(minor, currency);
  return <>{currency === "NGN" ? text.replace(/ NGN$/, "") : text} <span className="cur">{currency}</span></>;
}

/** SCREENS['pay'] */
export function PayScreen() {
  const { order, settings, onboarding, selected, select, pay, go, showToast, quote, refreshQuote } = useCheckout();
  const account = useAccount((s) => s.account);
  const sel = account?.methods.find((m) => m.id === selected);
  const converting = isConverting(order, settings, sel);

  // Converting: hold a rate for 30 seconds (the reference's convert review); then Refresh rate replaces Pay
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!converting) return;
    if (!useCheckout.getState().quote) useCheckout.setState({ quote: newQuote(true) });
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [converting]);

  if (!order || !account) return null;
  const left = converting && quote ? quoteLeft(quote, Math.max(now, quote.at)) : 0;
  const expired = converting && !!quote && left <= 0;
  const usd = converting && quote ? quoteUsdCents(order.amount, quote) : 0;
  const C = 2 * Math.PI * 7;
  const masked = (() => { const [u, d] = account.email.split("@"); return `${u[0]}••••${u[u.length - 1]}@${d}`; })();
  return (
    <>
      <h2 className="title">Pay {formatOrder(order.amount, order.currency)} to {order.merchant}</h2>
      <p className="sub">
        {!onboarding && <>Signed in as {masked} · <button className="link" onClick={() => showToast("Your Poket isn’t ported yet")}>Your Poket</button></>}
      </p>
      <div className="methods" role="radiogroup" aria-label="Payment method">
        {account.methods.map((m) => {
          // Conversion off on an NGN order: dollar methods are shown disabled, with why (the prototype's .method.off)
          const off = isBlockedMethod(order, settings, m);
          return (
            <button key={m.id} type="button" className={`method ${m.id === selected ? "sel" : ""} ${off ? "off" : ""}`} role="radio" aria-checked={m.id === selected}
              aria-disabled={off || undefined} data-pm={m.id} onClick={() => { if (!off) select(m.id); }}>
              <Raw html={methodMark(m)} />
              <span className="m1">{m.name}<small>{off ? nairaOnlyText(order.merchant) : m.sub}</small></span>
              <span className="radio" />
            </button>
          );
        })}
      </div>
      <button type="button" className="add" onClick={() => go("add-method")}><Raw html={ICON.plus} /> Add a payment method</button>
      <div className="sumbox">
        <div className="line"><span>Order total</span><span><MoneyU minor={order.amount} currency={order.currency} /></span></div>
        <div className="line"><span>Fees</span><span className="txt">Covered by {order.merchant}</span></div>
        <div className="line"><span>You pay</span><span>{converting ? <MoneyU minor={usd} currency="USD" /> : <MoneyU minor={order.amount} currency={order.currency} />}</span></div>
      </div>
      {converting && quote && (
        // The quote card: SCREENS['cv-quote']'s rate ring and fee (cv-meta), and cvReview's held-rate timer
        <div className="cv-meta" id="quoteCard">
          <div className="cv-rate"><span id="quoteRate">{quoteRateText(quote)}</span>
            <span className="cv-ring" title="Rate refreshes"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="none" stroke="#e5e7eb" strokeWidth="2.2" /><circle cx="9" cy="9" r="7" fill="none" stroke="var(--brand)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - left / QUOTE_SECONDS)} transform="rotate(-90 9 9)" /></svg></span>
          </div>
          <div className="cv-fee">Fee <span className="cv-fee-v" id="quoteFee">Covered by {order.merchant}</span></div>
          <div className="cv-fee" id="quoteYouPay">You pay <b><MoneyU minor={usd} currency="USD" /></b> for <b><MoneyU minor={order.amount} currency="NGN" /></b></div>
          <div className={`cv-timer ${expired ? "expired" : ""}`} id="quoteTimer" role="status">
            {expired ? "Rate expired. Refresh to get a new rate." : <>Rate held for <span className="mono" id="quoteLeft">0:{String(left).padStart(2, "0")}</span></>}
          </div>
        </div>
      )}
      {sel?.kind === "bank" && <p className="mandate">By paying, you authorize Poket to debit {sel.name} for {converting ? `${money(usd)} USD` : `${formatOrder(order.amount, order.currency)}${order.currency === "USD" ? " USD" : ""}`}.</p>}
      {expired
        ? <button className="btn" id="quoteRefresh" onClick={() => { refreshQuote(); setNow(Date.now()); }}>Refresh rate</button>
        : <button className="btn" id="payGo" disabled={!selected} onClick={pay}>Pay {converting ? money(usd) : formatOrder(order.amount, order.currency)}</button>}
    </>
  );
}
