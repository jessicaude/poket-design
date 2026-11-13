"use client";
import { Raw } from "@/components/ui/Raw";
import { BANK_MINI, BRANDS, CHECK_DRAW, ICON, PROTECT_NOTE } from "@/lib/icons";
import { formatOrder, money } from "@/lib/money";
import { useAccount } from "@/store/account";
import { useCheckout } from "../useCheckout";
import { MoneyU } from "./PayScreen";

/** SCREENS['processing'] */
export function ProcessingScreen() {
  const { order, charging } = useCheckout();
  if (!order) return null;
  // Converted: the dollars being charged, not the naira total
  return <div className="center"><div className="spinner" /><h2 className="title">Paying {order.merchant}</h2><p className="sub" id="processingAmount">{charging !== null ? money(charging) : formatOrder(order.amount, order.currency)}</p></div>;
}

/** SCREENS['declined'] */
export function DeclinedScreen() {
  const { failed, select, go } = useCheckout();
  const account = useAccount((s) => s.account);
  if (!failed || !account) return null;
  const other = account.methods.find((x) => x.id !== failed.id);
  return (
    <>
      <div className="center">
        <div className="badge err"><Raw html={ICON.x} /></div>
        <h2 className="title">Your card was declined</h2>
        <p className="sub">{failed.name} didn’t go through. Choose another way to pay, or contact your card issuer.</p>
      </div>
      <button className="btn" onClick={() => { if (other) { select(other.id); go("pay"); } else go("add-method"); }}>Choose another way to pay</button>
    </>
  );
}

/** SCREENS['done'] (one-time payment) */
export function DoneScreen() {
  const { order, paid, close } = useCheckout();
  if (!order || !paid) return null;
  const m = paid.method;
  const mini = m.kind === "bank" ? BANK_MINI : m.brand ? BRANDS[m.brand].mini : "";
  return (
    <>
      <div className="done-head"><span className="done-mark"><Raw html={CHECK_DRAW} /></span>
        <div><h2 className="title">Paid {formatOrder(order.amount, order.currency)} to {order.merchant}</h2></div></div>
      <div className="sumbox">
        <div className="line"><span>Paid with</span><span className="plain pm"><Raw html={mini} />{m.name}</span></div>
        <div className="line"><span>Order</span><span>{order.orderRef}</span></div>
        <div className="line"><span>Reference</span><span>{paid.ref}</span></div>
        {paid.charged && <div className="line" id="donePaidUsd"><span>You paid</span><span><MoneyU minor={paid.charged.amount} currency={paid.charged.currency} /></span></div>}
        {paid.charged && <div className="line"><span>Rate</span><span className="txt">{paid.charged.rate}</span></div>}
        <div className="line"><span>Total</span><span><MoneyU minor={order.amount} currency={order.currency} /></span></div>
      </div>
      <Raw html={PROTECT_NOTE.replace(/__HOST__/g, order.merchant)} />
      <div className={`btn-pair ${order.merchant.length > 14 ? "stack" : ""}`}>
        <button className="btn outline" id="doneView" onClick={() => useCheckout.getState().viewPayment(paid.ref, "done")}>View receipt</button>
        <button className="btn outline" title={`Back to ${order.merchant}`} onClick={() => close("done")}><span className="btn-txt">Back to {order.merchant}</span></button>
      </div>
    </>
  );
}
