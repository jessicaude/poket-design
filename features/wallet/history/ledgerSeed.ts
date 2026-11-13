import { adaLedgerSeed } from "@/lib/mock-api";
import type { LedgerEntry } from "@/lib/statement";

/**
 * Ada's NGN history before the demo starts, as ledger lines for statements: the same records the wallet shows in
 * Activity and the NGN balance's history (lib/mock-api.ts buildAdaHistory), with their timestamps and references.
 * It starts from nothing and ends at the demo's starting balance.
 */
export const seedLedger = (): LedgerEntry[] => adaLedgerSeed().map((l, i) => ({ id: `seed_${i}`, ...l }));
