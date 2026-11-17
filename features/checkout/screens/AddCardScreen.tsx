"use client";
import { useState } from "react";
import { Raw } from "@/components/ui/Raw";
import { BRANDS, ICON } from "@/lib/icons";
import { CardForm, type NewCard } from "@/features/payments/CardForm";
import { useAccount } from "@/store/account";
import { useCheckout } from "../useCheckout";

/** SCREENS['add-card']: the shared card form (features/payments/CardForm.tsx), with "Save this card for next time". */
export function AddCardScreen() {
  const { go, select, cardCurrency } = useCheckout();
  const { account, update } = useAccount();
  const [save, setSave] = useState(true);
  if (!account) return null;

  function saveCard(c: NewCard) {
    const id = "pm_" + Math.random().toString(36).slice(2, 8);
    update((a) => ({ ...a, methods: [...a.methods, {
      id, kind: "card", brand: c.brand, last4: c.last4, name: `${BRANDS[c.brand].name} ••• ${c.last4}`,
      sub: `${c.funding === "credit" ? "Credit" : "Debit"} · Expires ${c.exp.replace(" / ", "/")}${save ? "" : " · This payment only"}`, oneTime: !save,
      ...(cardCurrency === "NGN" ? { currency: "NGN" as const } : {}),
    }] }));
    select(id);
    go("pay");
  }

  return (
    <>
      <button className="link nav-back" onClick={() => go("add-method")}><Raw html={ICON.back} /> Back</button>
      <h2 className="title">Add a card</h2>
      <p className="sub">Must be in your legal name, {account.first} {account.last}.</p>
      {/* The shared card form; Nigerian cards have no ZIP code: number, expiry and CVC only */}
      <CardForm askZip={cardCurrency !== "NGN"} submitLabel={save ? "Save card" : "Use this card"} onSubmit={saveCard}
        extra={<label className="check"><input type="checkbox" id="cSave" checked={save} onChange={(e) => setSave(e.target.checked)} /><span>Save this card for next time</span></label>} />
      <div className="center"><button className="btn ghost" onClick={() => go("add-method")}>Other payment methods</button></div>
    </>
  );
}
