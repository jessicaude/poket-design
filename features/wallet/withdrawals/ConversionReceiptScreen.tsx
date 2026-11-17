"use client";
import { conversionTitle, useConvert } from "../convert/useConvert";
import { conversionFields } from "../history/fields";
import { TxDetailView, TxNotFound } from "../history/TxView";
import { conversionReceipt } from "../receipt/receipt";

/** A conversion's detail (the reference's tTxDetail for a 'convert' transaction): the shared template, ⇄. */
export function ConversionReceiptScreen({ id }: { id: string }) {
  const c = useConvert((s) => s.conversions.find((x) => x.id === id));
  if (!c) return <TxNotFound />;
  return <TxDetailView dir="convert" amount={c.receivedText} title={conversionTitle(c)} f={conversionFields(c)} receipt={conversionReceipt(c)} cardId="cvReceipt" />;
}
