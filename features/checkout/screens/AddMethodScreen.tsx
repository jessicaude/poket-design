"use client";
import { Raw } from "@/components/ui/Raw";
import { BANK_TILE, CARD_TILE, ICON, WALLET_ICON } from "@/lib/icons";
import { useAccount } from "@/store/account";
import { useCheckout } from "../useCheckout";

/** SCREENS['add-method']: choose how to pay. Card is ported; the others are next. */
export function AddMethodScreen() {
  const { go, showToast } = useCheckout();
  const account = useAccount((s) => s.account);
  if (!account) return null;
  const opt = (id: string, icon: string, title: string, sub: string) => (
    <button key={id} type="button" className="method" data-addpm={id}
      onClick={() => (id === "card" ? go("add-card") : showToast(`${title} isn’t ported yet`))}>
      <Raw html={icon} /><span className="m1">{title}<small>{sub}</small></span><span className="chev">›</span>
    </button>
  );
  return (
    <>
      {account.methods.length > 0 && <button className="link nav-back" onClick={() => go("pay")}><Raw html={ICON.back} /> Back</button>}
      <h2 className="title">Add a payment method</h2>
      <p className="sub">Must be in your legal name, {account.first} {account.last}.</p>
      <div className="methods">
        {opt("card", CARD_TILE, "Card", "Debit or credit card")}
        {opt("bank", BANK_TILE, "Pay by Bank", "Link your bank account")}
        {opt("apple", WALLET_ICON.apple, "Apple Pay", "Use a card in your Apple Wallet")}
        {opt("google", WALLET_ICON.google, "Google Pay", "Use a card in your Google Wallet")}
        {opt("cashapp", WALLET_ICON.cashapp, "Cash App Pay", "Pay from your Cash App")}
      </div>
    </>
  );
}
