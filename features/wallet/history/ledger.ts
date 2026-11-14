import { create } from "zustand";
import type { LedgerEntry } from "@/lib/statement";
import { NGN_START, useNgn } from "../ngn/useNgn";
import { useHoldings } from "../useHoldings";
import { seedLedger } from "./ledgerSeed";

/**
 * The cash balances' ledger, for statements: every change to a balance (useNgn.ngnBalance, useHoldings.cash) as it happens, with the
 * balance after it, labelled by the transaction that made it (attribute()). A change nothing labels (a demo control
 * setting the balance) is a "Balance adjustment", so the ledger always adds up to the balance.
 */
const ADJUSTMENT = { description: "Balance adjustment", reference: "" };
/** The cash balances other than NGN (whose balance lives in useNgn). */
const OTHER_CASH = ["USD", "EUR", "GBP", "GHS"] as const;
type Label = { description: string; reference: string; withdrawalId?: string };
let label: Label | null = null;
/** Entries made under the current label (so a send can add its reference once it has one). */
let made: string[] | null = null;

export const useNgnLedger = create<{ entries: LedgerEntry[] }>(() => ({ entries: [] }));

let started = false;
/** Start recording (once the wallet's stores exist: called by attribute() and on load). */
export function startLedger() {
  if (started) return;
  started = true;
  // Ada's past history, ending at the starting balance; if the balance has already moved, an adjustment bridges it
  const seeded = seedLedger();
  const now = useNgn.getState().ngnBalance, gap = now - NGN_START;
  useNgnLedger.setState({ entries: [...seeded, ...(gap ? [{ id: "le_start", at: Date.now(), delta: gap, balance: now, ...ADJUSTMENT }] : [])] });
  const record = (currency: string, delta: number, balance: number) => {
    if (!delta) return;
    const e: LedgerEntry = { id: "le_" + Math.random().toString(36).slice(2, 10), at: Date.now(), delta, balance, currency, ...(label ?? ADJUSTMENT) };
    made?.push(e.id);
    useNgnLedger.setState((st) => ({ entries: [...st.entries, e] }));
  };
  useNgn.subscribe((s, prev) => record("NGN", s.ngnBalance - prev.ngnBalance, s.ngnBalance));
  // The other cash balances (useHoldings): their statements work the same way, from the demo's start
  useHoldings.subscribe((s, prev) => {
    for (const cur of OTHER_CASH) record(cur, (s.cash[cur] || 0) - (prev.cash[cur] || 0), s.cash[cur] || 0);
  });
}
if (typeof window !== "undefined") queueMicrotask(startLedger);

/** Run `fn` (which changes the balance) with the changes labelled. Returns the entries it made. */
export function attribute(l: Label, fn: () => void): string[] {
  startLedger();
  const prevLabel = label, prevMade = made, mine: string[] = [];
  label = l; made = mine;
  try { fn(); } finally { label = prevLabel; made = prevMade; }
  return mine;
}
/** Give entries their transaction's reference (a send has one only once it's created). */
export function relabel(ids: string[], l: Partial<Label>) {
  if (!ids.length) return;
  useNgnLedger.setState((st) => ({ entries: st.entries.map((e) => (ids.includes(e.id) ? { ...e, ...l } : e)) }));
}
/** Drop entries that cancel out (a send that couldn't be created gives its reservation straight back). */
export function dropEntries(ids: string[]) {
  if (!ids.length) return;
  useNgnLedger.setState((st) => ({ entries: st.entries.filter((e) => !ids.includes(e.id)) }));
}
