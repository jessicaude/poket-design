"use client";
import { useEffect } from "react";
import { useDemo, type BankTransferAccount, type CardOutcome, type Customer, type MerchantAccepts, type OrderCurrency, type Theme } from "@/store/demo";

const ACCEPTS: { key: keyof MerchantAccepts; label: string }[] = [
  { key: "ngnCard", label: "NGN card" }, { key: "ngnBank", label: "NGN bank transfer" }, { key: "conversion", label: "Conversion" },
];

/**
 * Prototype controls (styles: .pbar in styles/prototype.css). Dev-only, not part of the product.
 * `checkout` adds the merchant's checkout options (order currency, what it accepts, bank transfer account).
 */
export function DemoBar({ checkout = false }: { checkout?: boolean }) {
  const { customer, cardOutcome, theme, shareDetails, orderCurrency, merchantAccepts, bankTransferAccount, set } = useDemo();
  useEffect(() => {
    if (theme === "centry") document.documentElement.dataset.theme = "centry";
    else delete document.documentElement.dataset.theme;
  }, [theme]);
  return (
    <div className="pbar" role="region" aria-label="Prototype controls">
      <span className="name">Poket design</span>
      <label className="opt-lbl"><span>Customer</span>
        <select aria-label="Customer" value={customer} onChange={(e) => set({ customer: e.target.value as Customer })}>
          <option value="new">New to Poket</option><option value="returning">Ada (remembered)</option>
        </select>
      </label>
      <label className="opt-lbl"><span>Card</span>
        <select aria-label="Card outcome" value={cardOutcome} onChange={(e) => set({ cardOutcome: e.target.value as CardOutcome })}>
          <option value="approved">Approved</option><option value="declined">Declined</option>
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
      <label className="opt-lbl"><span>Theme</span>
        <select aria-label="Theme" value={theme} onChange={(e) => set({ theme: e.target.value as Theme })}>
          <option value="poket">Poket</option><option value="centry">CentryOS</option>
        </select>
      </label>
    </div>
  );
}
