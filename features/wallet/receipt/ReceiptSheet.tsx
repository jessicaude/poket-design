"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { Raw } from "@/components/ui/Raw";
import { WALLET_LOCKUP, WICON } from "@/lib/icons";
import { brandInfo, POWERED_BY, useWalletBrand } from "../brand";
import { Grey } from "../payout/parts";
import { useWalletToast } from "../useWalletToast";
import { receiptFileName, receiptText, type Receipt } from "./receipt";
import { receiptPdf, receiptPng, saveBlob } from "./render";

/**
 * "Share receipt" on a naira transaction's detail (the exploration's #shareRcpt, "Share sheet opens here"; NEW): a
 * sheet over the wallet with the receipt and Share (the native share sheet where there is one, else the receipt's
 * text copied), Download PDF and Download image.
 */
export const useReceiptSheet = create<{ receipt: Receipt | null; open: (r: Receipt) => void; close: () => void }>((set) => ({
  receipt: null,
  open: (receipt) => set({ receipt }),
  close: () => set({ receipt: null }),
}));

/** The detail's button. Nothing for a transaction that isn't naira (`receipt` null). */
export function ShareReceiptButton({ receipt }: { receipt: Receipt | null }) {
  if (!receipt) return null;
  return <button className="btn-secondary" id="shareReceipt" style={{ width: "100%", marginTop: "14px" }} onClick={() => useReceiptSheet.getState().open(receipt)}>Share receipt</button>;
}

/** The receipt as the sheet shows it, in the wallet's look and the brand's. */
export function ReceiptCard({ r }: { r: Receipt }) {
  const brand = useWalletBrand((s) => s.brand);
  const b = brandInfo(brand);
  return (
    <div className="rc-card" id="receiptCard" style={{ borderTopColor: b.color }}>
      <div className="rc-head">
        <span className="rc-brand" id="receiptBrand" data-brand={brand.kind}>
          {brand.kind === "poket" ? <Raw html={WALLET_LOCKUP} /> : <><Raw html={b.logoSvg!} /><b>{b.name}</b></>}
        </span>
        <span className="rc-kind">Receipt</span>
      </div>
      {r.notice && (
        <div className={`alert ${r.notice.tone === "err" ? "err" : "warn"}`} id="receiptNotice" role="note" style={{ margin: "0 0 12px" }}>
          <Raw html={WICON.alert} /><span>{r.notice.text}</span>
        </div>
      )}
      <div className="rc-amount mono" id="receiptAmount"><Grey>{r.amount}</Grey></div>
      <div className="rc-title" id="receiptTitle">{r.title}</div>
      <div style={{ textAlign: "center" }}><span className={`va-status${r.status.tone ? " " + r.status.tone : ""}`} id="receiptStatus">{r.status.label}</span></div>
      <div className="rc-rows">
        {r.rows.map(([k, v]) => (
          <div className="rc-row" key={k} data-label={k}><span>{k}</span><span className="mono">{v}</span></div>
        ))}
      </div>
      <div className="rc-foot" id="receiptFooter">{POWERED_BY}</div>
    </div>
  );
}

/** The sheet, over the panel (WalletShell renders it). Escape or the backdrop closes it. */
export function ReceiptSheet() {
  const { receipt: r, close } = useReceiptSheet();
  const brand = useWalletBrand((s) => s.brand);
  const [busy, setBusy] = useState<"pdf" | "png" | null>(null);
  useEffect(() => {
    if (!r) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [r, close]);
  if (!r) return null;
  const toast = useWalletToast.getState();
  const share = async () => {
    const text = receiptText(r, brand);
    if (typeof navigator.share === "function") {
      try { await navigator.share({ title: `Receipt ${r.reference}`, text }); } catch { /* cancelled */ }
      return;
    }
    try { await navigator.clipboard?.writeText(text); } catch { /* no clipboard */ }
    toast.showNotice("Receipt copied", "Paste it into a message or email.", 2400);
  };
  const download = async (kind: "pdf" | "png") => {
    setBusy(kind);
    try {
      const blob = kind === "pdf" ? await receiptPdf(r, brand) : await receiptPng(r, brand);
      saveBlob(blob, receiptFileName(r, kind));
      toast.showToast(kind === "pdf" ? "PDF downloaded" : "Image downloaded");
    } finally { setBusy(null); }
  };
  return (
    <div className="rc-backdrop" id="receiptBackdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="rc-sheet" id="receiptSheet" role="dialog" aria-modal="true" aria-label="Share receipt">
        <div className="rc-sheet-head">
          <b>Share receipt</b>
          <button type="button" className="panel-settings-btn" id="receiptClose" aria-label="Close" onClick={close}><Raw html={WICON.closeIc} /></button>
        </div>
        <ReceiptCard r={r} />
        <button className="btn-primary" id="receiptShare" style={{ marginTop: "14px" }} onClick={share}>Share</button>
        <div className="rc-downloads">
          <button className="btn-secondary" id="receiptPdf" disabled={busy !== null} onClick={() => download("pdf")}>Download PDF</button>
          <button className="btn-secondary" id="receiptImage" disabled={busy !== null} onClick={() => download("png")}>Download image</button>
        </div>
      </div>
    </div>
  );
}
