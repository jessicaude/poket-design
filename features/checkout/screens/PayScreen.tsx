"use client";
import { Raw } from "@/components/ui/Raw";
import { BANK_MARK, BRANDS, ICON } from "@/lib/icons";
import { money } from "@/lib/money";
import { useAccount, type PaymentMethod } from "@/store/account";
import { useCheckout } from "../useCheckout";

/** Card brand mark or bank icon, as in the prototype's methodMark() */
export const methodMark = (m: PaymentMethod) => (m.kind === "bank" ? BANK_MARK : m.brand ? BRANDS[m.brand].mark : "");

/** "$23.40 USD" with the currency code styled by .cur */
export function MoneyU({ cents }: { cents: number }) {
  return <>{money(cents)} <span className="cur">USD</span></>;
}

/** SCREENS['pay'] */
export function PayScreen() {
  const { order, onboarding, selected, select, pay, go, showToast } = useCheckout();
  const account = useAccount((s) => s.account);
  if (!order || !account) return null;
  const sel = account.methods.find((m) => m.id === selected);
  const masked = (() => { const [u, d] = account.email.split("@"); return `${u[0]}••••${u[u.length - 1]}@${d}`; })();
  return (
    <>
      <h2 className="title">Pay {money(order.amount)} to {order.merchant}</h2>
      <p className="sub">
        {!onboarding && <>Signed in as {masked} · <button className="link" onClick={() => showToast("Your Poket isn’t ported yet")}>Your Poket</button></>}
      </p>
      <div className="methods" role="radiogroup" aria-label="Payment method">
        {account.methods.map((m) => (
          <button key={m.id} type="button" className={`method ${m.id === selected ? "sel" : ""}`} role="radio" aria-checked={m.id === selected} data-pm={m.id} onClick={() => select(m.id)}>
            <Raw html={methodMark(m)} />
            <span className="m1">{m.name}<small>{m.sub}</small></span>
            <span className="radio" />
          </button>
        ))}
      </div>
      <button type="button" className="add" onClick={() => go("add-method")}><Raw html={ICON.plus} /> Add a payment method</button>
      <div className="sumbox">
        <div className="line"><span>Order total</span><span><MoneyU cents={order.amount} /></span></div>
        <div className="line"><span>Fees</span><span className="txt">Covered by {order.merchant}</span></div>
        <div className="line"><span>You pay</span><span><MoneyU cents={order.amount} /></span></div>
      </div>
      {sel?.kind === "bank" && <p className="mandate">By paying, you authorize Poket to debit {sel.name} for {money(order.amount)} USD.</p>}
      <button className="btn" id="payGo" disabled={!selected} onClick={pay}>Pay {money(order.amount)}</button>
    </>
  );
}
