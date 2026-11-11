"use client";
import { useEffect, useRef } from "react";
import { useCheckout } from "@/features/checkout/useCheckout";
import { useDemo, type BankTransferAccount, type CardOutcome, type Customer, type IdOutcome, type MerchantAccepts, type OrderCurrency, type OrderSize, type Theme } from "@/store/demo";

/** ID check outcomes: the prototype's pId (passes, declined) and its sign-up outcomes (SIGNUP_OUTCOMES labels). */
const ID_OUTCOMES: [IdOutcome, string][] = [
  ["pass", "ID check: passes"], ["review", "ID check: manual review"], ["retry", "ID check: needs retry"],
  ["declined", "ID check: declined"], ["under18", "Under 18 at date of birth"], ["sanctions", "Sanctions match"],
];

const ACCEPTS: { key: keyof MerchantAccepts; label: string }[] = [
  { key: "ngnCard", label: "NGN card" }, { key: "ngnBank", label: "NGN bank transfer" }, { key: "conversion", label: "Conversion" },
];

/**
 * Prototype controls (styles: .pbar in styles/prototype.css). Dev-only, not part of the product.
 * `checkout` adds the merchant's checkout options (order currency, what it accepts, bank transfer account).
 */
export function DemoBar({ checkout = false }: { checkout?: boolean }) {
  const { customer, cardOutcome, theme, shareDetails, orderCurrency, merchantAccepts, bankTransferAccount, idOutcome, orderSize, set } = useDemo();
  const { open, screen, transfer, transferArrives, expireTransfer, idv, openOnPhone, finishOnPhone, approveReview } = useCheckout();
  // Screen demo actions (the prototype's SCREENS[...].demo): the ID handoff and manual review
  const action = !open ? null
    : screen === "vendor" ? (idv.vstage === "phone" ? { label: "Finish on phone", run: finishOnPhone } : { label: "Open on phone", run: openOnPhone })
    : screen === "id-review" ? { label: "Approve review", run: approveReview }
    : null;
  const onTransfer = checkout && open && screen === "bank-transfer" && (transfer.state === "waiting" || transfer.state === "arriving");
  // The bar wraps onto more rows when it doesn't fit: keep --bar (page offset, scrim, widget height) equal to its height
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty("--bar", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--bar"); };
  }, []);
  useEffect(() => {
    if (theme === "centry") document.documentElement.dataset.theme = "centry";
    else delete document.documentElement.dataset.theme;
  }, [theme]);
  return (
    <>
    <div className="pbar wrap" ref={bar} role="region" aria-label="Prototype controls">
      <span className="name">Poket design</span>
      <label className="opt-lbl"><span>Customer</span>
        <select aria-label="Customer" value={customer} onChange={(e) => set({ customer: e.target.value as Customer })}>
          <option value="new">New to Poket</option><option value="returning">Ada (remembered)</option>
        </select>
      </label>
      <label className="opt-lbl"><span>ID check</span>
        <select aria-label="ID check" value={idOutcome} onChange={(e) => set({ idOutcome: e.target.value as IdOutcome })}>
          {ID_OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="opt-lbl"><span>Card</span>
        <select aria-label="Card outcome" value={cardOutcome} onChange={(e) => set({ cardOutcome: e.target.value as CardOutcome })}>
          <option value="approved">Approved</option><option value="declined">Declined</option>
        </select>
      </label>
      <label className="opt-lbl"><span>Order</span>
        <select aria-label="Order" value={orderSize} onChange={(e) => set({ orderSize: e.target.value as OrderSize })}>
          <option value="small">Order under $500</option><option value="large">Order over $500</option>
        </select>
      </label>
      <label className="opt-lbl"><span>Details</span>
        <select aria-label="Customer details" value={shareDetails ? "share" : "none"} onChange={(e) => set({ shareDetails: e.target.value === "share" })}>
          <option value="share">Shared by merchant</option><option value="none">Not shared</option>
        </select>
      </label>
      {checkout && (
        <>
          <label className="opt-lbl"><span>Order currency</span>
            <select aria-label="Order currency" value={orderCurrency} onChange={(e) => set({ orderCurrency: e.target.value as OrderCurrency })}>
              <option value="USD">Order in USD</option><option value="NGN">Order in NGN</option>
            </select>
          </label>
          <span className="pbar-group" role="group" aria-label="Merchant accepts">
            <span className="pbar-group-lbl">Merchant accepts</span>
            {ACCEPTS.map(({ key, label }) => (
              <label key={key} className="pbar-check">
                <input type="checkbox" checked={merchantAccepts[key]}
                  onChange={(e) => set({ merchantAccepts: { ...merchantAccepts, [key]: e.target.checked } })} />
                <span>{label}</span>
              </label>
            ))}
          </span>
          <label className="opt-lbl"><span>Bank transfer account</span>
            <select aria-label="Bank transfer account" value={bankTransferAccount} onChange={(e) => set({ bankTransferAccount: e.target.value as BankTransferAccount })}>
              <option value="dynamic">Dynamic account</option><option value="pool">Merchant pool</option>
            </select>
          </label>
        </>
      )}
      {onTransfer && transfer.va?.kind === "dynamic" && (
        <>
          <button className="pbtn" id="demoTransferArrives" disabled={transfer.state !== "waiting"} onClick={() => transferArrives("exact")}>Transfer arrives</button>
          <button className="pbtn" id="demoTransferLess" disabled={transfer.state !== "waiting"} onClick={() => transferArrives("less")}>Less arrives</button>
          <button className="pbtn" id="demoTransferMore" disabled={transfer.state !== "waiting"} onClick={() => transferArrives("more")}>More arrives</button>
          <button className="pbtn" id="demoTransferExpire" disabled={transfer.state !== "waiting"} onClick={expireTransfer}>Let it expire</button>
        </>
      )}
      {onTransfer && transfer.va?.kind === "pool" && (
        <>
          <button className="pbtn" id="demoPoolExact" disabled={transfer.state !== "waiting"} onClick={() => transferArrives("exact")}>Exact amount arrives</button>
          <button className="pbtn" id="demoPoolLess" disabled={transfer.state !== "waiting"} onClick={() => transferArrives("less")}>Less arrives</button>
          <button className="pbtn" id="demoPoolMore" disabled={transfer.state !== "waiting"} onClick={() => transferArrives("more")}>More arrives</button>
        </>
      )}
      <label className="opt-lbl"><span>Theme</span>
        <select aria-label="Theme" value={theme} onChange={(e) => set({ theme: e.target.value as Theme })}>
          <option value="poket">Poket</option><option value="centry">CentryOS</option>
        </select>
      </label>
    </div>
    {/* The prototype's DEMO pill (setDemo): the current screen's demo action */}
    <div className={`demo ${action ? "on" : ""}`} id="demo" role="region" aria-label="Demo action">
      <span>DEMO</span>{action && <button type="button" id="demoBtn" onClick={action.run}>{action.label}</button>}
    </div>
    </>
  );
}
