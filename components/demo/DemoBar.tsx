"use client";
import { useEffect } from "react";
import { useDemo, type CardOutcome, type Customer, type Theme } from "@/store/demo";

/** Prototype controls (styles: .pbar in styles/prototype.css). Dev-only, not part of the product. */
export function DemoBar() {
  const { customer, cardOutcome, theme, shareDetails, set } = useDemo();
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
      <label className="opt-lbl"><span>Theme</span>
        <select aria-label="Theme" value={theme} onChange={(e) => set({ theme: e.target.value as Theme })}>
          <option value="poket">Poket</option><option value="centry">CentryOS</option>
        </select>
      </label>
    </div>
  );
}
