"use client";
import { useEffect, useState } from "react";
import { DemoBar } from "@/components/demo/DemoBar";
import { EventsPanel } from "@/components/demo/EventsPanel";
import { Raw } from "@/components/ui/Raw";
import { POKET_MARK } from "@/lib/icons";
import { CheckoutWidget } from "@/features/checkout/CheckoutWidget";
import { useCheckout } from "@/features/checkout/useCheckout";
import { useDemo } from "@/store/demo";
import { DEMO_NGN_PER_USD, formatOrder } from "@/lib/money";

/** Ilé Living: the merchant's checkout page (the host). Markup from renderHost() in reference/poket-widgets.html. */
const HOST = { name: "Ilé Living", orderRef: "ILV-10482" };
const SHIPPING = { standard: 120, express: 600 };
const ITEMS = [
  { name: "Adire throw cushion", detail: "Indigo · Qty 2", amount: 1580, swatch: "#2a3557" },
  { name: "Raffia table runner", detail: "Natural · Qty 1", amount: 640, swatch: "#c9b48a" },
];
/** Prices are set in USD cents; an NGN order shows them in naira at the demo rate (demo bar: Order currency). */
const toOrder = (usdCents: number, cur: "USD" | "NGN") => (cur === "NGN" ? usdCents * DEMO_NGN_PER_USD : usdCents);

export default function IleLivingPage() {
  const { start, showToast } = useCheckout();
  const shareDetails = useDemo((s) => s.shareDetails);
  const currency = useDemo((s) => s.orderCurrency);
  const fmt = (usdCents: number) => formatOrder(toOrder(usdCents, currency), currency);
  const [ship, setShip] = useState<"standard" | "express">("standard");
  const total = ITEMS.reduce((s, i) => s + i.amount, 0) + SHIPPING[ship];
  // Demo/test hooks: e2e tests read the widget's state and set the demo bar through these.
  useEffect(() => { Object.assign(window, { __checkout: useCheckout, __demo: useDemo }); }, []);

  return (
    <>
      <DemoBar checkout />
      <main className="host">
        <div className="store-head">
          <span className="store-logo">Ilé <b>Living</b></span>
          <div className="store-right">
            <nav className="store-nav"><span>Shop</span><span>Collections</span><span>Journal</span><span>Cart (2)</span></nav>
            <button type="button" className="poket-access" aria-label="Open your Poket account" onClick={() => showToast("Your Poket isn’t ported yet")}>
              <Raw html={POKET_MARK} /><span>Your Poket</span>
            </button>
          </div>
        </div>
        <section>
          <div className="crumbs">Cart › <b>Checkout</b></div>
          <h1 className="h1">Checkout</h1>
          <div className="panel"><h3>Contact</h3>
            <label className="slbl" htmlFor="hEmail">Email</label>
            <input className="sfield" id="hEmail" type="email" autoComplete="email" defaultValue="kemi.adeyemi@gmail.com" />
            <label className="scheck"><input type="checkbox" id="hNews" /> Email me with news and offers</label>
          </div>
          <div className="panel"><h3>Delivery</h3>
            <label className="slbl" htmlFor="hCountry">Country</label>
            <select className="sfield" id="hCountry" defaultValue="Nigeria"><option>Nigeria</option><option>Ghana</option><option>United Kingdom</option><option>United States</option></select>
            <div className="sgrid">
              <div><label className="slbl" htmlFor="hFirst">First name</label><input className="sfield" id="hFirst" autoComplete="given-name" defaultValue="Kemi" /></div>
              <div><label className="slbl" htmlFor="hLast">Last name</label><input className="sfield" id="hLast" autoComplete="family-name" defaultValue="Adeyemi" /></div>
            </div>
            <label className="slbl" htmlFor="hAddr">Address</label><input className="sfield" id="hAddr" autoComplete="address-line1" defaultValue="14 Admiralty Way" />
            <label className="slbl" htmlFor="hApt">Apartment, suite, etc. (optional)</label><input className="sfield" id="hApt" autoComplete="address-line2" defaultValue="" />
            <div className="sgrid">
              <div><label className="slbl" htmlFor="hCity">City</label><input className="sfield" id="hCity" autoComplete="address-level2" defaultValue="Lekki" /></div>
              <div><label className="slbl" htmlFor="hState">State</label><input className="sfield" id="hState" autoComplete="address-level1" defaultValue="Lagos" /></div>
            </div>
            <label className="slbl" htmlFor="hPhone">Phone</label><input className="sfield" id="hPhone" type="tel" autoComplete="tel" defaultValue="0812 555 0199" />
          </div>
          <div className="panel"><h3>Shipping method</h3>
            <div className="ship" role="radiogroup" aria-label="Shipping method">
              {(["standard", "express"] as const).map((k) => (
                <label key={k} className={`ship-opt ${ship === k ? "sel" : ""}`}>
                  <input type="radio" name="ship" value={k} checked={ship === k} onChange={() => setShip(k)} />
                  <span><b>{k === "standard" ? "Standard" : "Express"}</b><small>{k === "standard" ? "3 to 5 business days" : "1 to 2 business days"}</small></span>
                  <span className="amt">{fmt(SHIPPING[k])}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="panel pay-area"><h3>Payment</h3>
            <p>Pay with your saved cards and banks. New to Poket? You can set it up in a minute.</p>
            <button className="poket-btn" type="button" id="payWithPoket"
              onClick={() => start({ merchant: HOST.name, orderRef: HOST.orderRef, amount: toOrder(total, currency), currency,
                customer: shareDetails ? { email: "kemi.adeyemi@gmail.com", first: "Kemi", last: "Adeyemi" } : undefined })}>
              <Raw html={POKET_MARK} /><span>Pay with Poket</span>
            </button>
            <div className="other-pay">Card and PayPal are also available.</div>
          </div>
        </section>
        <aside className="panel summary"><h3>Order summary</h3>
          {ITEMS.map((i) => (
            <div key={i.name} className="item"><span className="sw" style={{ background: i.swatch }} /><span className="meta">{i.name}<small>{i.detail}</small></span><span className="amt">{fmt(i.amount)}</span></div>
          ))}
          <div className="line"><span>Shipping · {ship === "standard" ? "Standard" : "Express"}</span><span>{fmt(SHIPPING[ship])}</span></div>
          <div className="line total"><span>Total</span><span id="orderTotal">{fmt(total)}</span></div>
        </aside>
      </main>
      <EventsPanel host={HOST.name} />
      <CheckoutWidget />
    </>
  );
}
