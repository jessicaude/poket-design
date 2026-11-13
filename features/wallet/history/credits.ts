import { create } from "zustand";
import { DEMO_ACCOUNT_SENDER, DEMO_POKET_SENDER, listNgnCredits, recordNgnCredit, type NgnCredit, type NgnCreditKind } from "@/lib/mock-api";
import { formatNaira, type Kobo } from "@/lib/money";
import { useNotifications } from "../useNotifications";
import { useNgn } from "../ngn/useNgn";
import { attribute } from "./ledger";

/**
 * WGT-11: the NGN balance's own credits (lib/mock-api.ts recordNgnCredit): temporary-account top-ups, transfers to
 * the NGN account details (on time or delayed), naira from Poket users and recovered recalls. Each is a record in
 * the history with its own receipt.
 */
export const useNgnCredits = create<{ list: NgnCredit[]; refresh: () => void }>((set) => ({
  list: listNgnCredits(),
  refresh: () => set({ list: listNgnCredits() }),
}));

/** Credit the NGN balance and record it. `description`: the statement's line (default: the record's title). */
export function creditNgn(p: { kind: NgnCreditKind; amount: Kobo; from: string; ref?: string; withdrawalId?: string; description?: string }): NgnCredit {
  const { description, ...rec } = p;
  const c = recordNgnCredit(rec);
  const line = description ?? (c.kind === "temp" ? "Top-up · Bank transfer" : c.kind === "recall" ? `Recall · ${c.from}` : `From ${c.from.split(" · ")[0]}`);
  attribute({ description: line, reference: c.ref }, () => useNgn.setState((s) => ({ ngnBalance: s.ngnBalance + c.amount })));
  useNgnCredits.getState().refresh();
  return c;
}

/** The demo's transfers in: ₦25,000.00 to the NGN account details, ₦10,000.00 from a Poket user. */
export const DEMO_ACCOUNT_TRANSFER_KOBO: Kobo = 2500000;
export const DEMO_POKET_TRANSFER_KOBO: Kobo = 1000000;

/**
 * Demo "Transfer to account details" (a bank transfer to the user's dedicated NGN account) and "Receive from a
 * Poket user": credited at once, each with its record and a notification (NEW copy, as the delayed transfer's).
 */
export function receiveNaira(kind: "account" | "poket", amount: Kobo) {
  const from = kind === "account" ? DEMO_ACCOUNT_SENDER : DEMO_POKET_SENDER;
  const c = creditNgn({ kind, amount, from });
  useNotifications.getState().add({ type: "info", title: "Transfer received", desc: `${formatNaira(amount).replace(/ NGN$/, "")} from ${from.split(" · ")[0]} added to your NGN balance.` });
  return c;
}
