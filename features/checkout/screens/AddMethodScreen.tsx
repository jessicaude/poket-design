"use client";
import { Raw } from "@/components/ui/Raw";
import { BANK_TILE, CARD_TILE, ICON, WALLET_ICON } from "@/lib/icons";
import { useAccount } from "@/store/account";
import { useCheckout } from "../useCheckout";

type Rail = { id: string; icon: string; title: string; sub: string; converted?: boolean };

/** The merchant's own rails (the reference's list): paid in USD. */
const USD_RAILS: Rail[] = [
  { id: "card", icon: CARD_TILE, title: "Card", sub: "Debit or credit card" },
  { id: "bank", icon: BANK_TILE, title: "Pay by Bank", sub: "Link your bank account" },
  { id: "apple", icon: WALLET_ICON.apple, title: "Apple Pay", sub: "Use a card in your Apple Wallet" },
  { id: "google", icon: WALLET_ICON.google, title: "Google Pay", sub: "Use a card in your Google Wallet" },
  { id: "cashapp", icon: WALLET_ICON.cashapp, title: "Cash App Pay", sub: "Pay from your Cash App" },
];

/** SCREENS['add-method']: choose how to pay. Card is ported; the others are next. */
export function AddMethodScreen() {
  const { order, settings, go, addCard, showToast } = useCheckout();
  const account = useAccount((s) => s.account);
  if (!account || !order) return null;

  // An NGN order lists only the naira rails the merchant accepts; with Conversion on, also its other rails, paid in USD.
  let rails = USD_RAILS;
  if (order.currency === "NGN") {
    const a = settings?.accepts;
    rails = [
      ...(a?.ngnCard ? [{ id: "ngn-card", icon: CARD_TILE, title: "Card", sub: "Nigerian debit or credit card" }] : []),
      ...(a?.ngnBank ? [{ id: "ngn-bank", icon: BANK_TILE, title: "Bank transfer", sub: "Pay into an account we show you" }] : []),
      ...(a?.conversion ? USD_RAILS.map((r) => ({ ...r, converted: true })) : []),
    ];
  }
  const choose = (r: Rail) =>
    r.id === "card" ? addCard("USD") : r.id === "ngn-card" ? addCard("NGN") : showToast(`${r.title} isn’t ported yet`);

  return (
    <>
      {account.methods.length > 0 && <button className="link nav-back" onClick={() => go("pay")}><Raw html={ICON.back} /> Back</button>}
      <h2 className="title">Add a payment method</h2>
      <p className="sub">Must be in your legal name, {account.first} {account.last}.</p>
      <div className="methods">
        {rails.map((r) => (
          <button key={r.id + (r.converted ? "-usd" : "")} type="button" className="method" data-addpm={r.id} data-converted={r.converted || undefined} onClick={() => choose(r)}>
            <Raw html={r.icon} />
            <span className="m1">{r.title}{r.converted && <span className="chip">Paid in USD, converted</span>}<small>{r.sub}</small></span>
            <span className="chev">›</span>
          </button>
        ))}
      </div>
      {/* NEW copy: the merchant accepts none of the ways to pay this order */}
      {rails.length === 0 && <p className="err" id="noMethods">{order.merchant} can’t take payment for this order right now.</p>}
    </>
  );
}
