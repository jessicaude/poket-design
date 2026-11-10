/**
 * Mock Poket API: stands in for the backend while designing.
 * Function names follow the planned endpoints so engineering can swap in real calls.
 */
import type { Account, PaymentMethod } from "@/store/account";
import type { CardOutcome } from "@/store/demo";
import type { Kobo } from "@/lib/money";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** People who already have a Poket account (from the prototype's DIRECTORY). */
export const DIRECTORY: Record<string, Account> = {
  "ada@osun.co": {
    email: "ada@osun.co", first: "Ada", last: "Osun", tier: 1, payments: [],
    methods: [
      { id: "pm_visa", kind: "card", brand: "visa", last4: "4242", name: "Visa ••• 4242", sub: "Debit · Expires 12/2028" },
      { id: "pm_bank", kind: "bank", last4: "6789", name: "Chase checking ••• 6789", sub: "Bank account · Pay by bank" },
    ],
  },
};

export const findAccount = (email: string) => DIRECTORY[email.trim().toLowerCase()] ?? null;

/** POST /v1/auth/verify. In the demo any 6 digits work; 000000 is a wrong code. */
export async function verifyCode(code: string): Promise<void> {
  await wait(700);
  if (code === "000000") throw new Error("That code isn’t right. Check it and try again.");
}

/** POST /v1/payments */
export async function createPayment(method: PaymentMethod, outcome: CardOutcome): Promise<{ id: string }> {
  await wait(1200);
  if (outcome === "declined" && method.kind === "card") throw new Error("card_declined");
  return { id: "pay_" + Math.random().toString(36).slice(2, 10) };
}

/* ---------- NGN (naira) ----------
   From ngnTempCreate, ngnTempArrive, ngnIdCheck and vaCreate in reference/poket-unified.html.
   The mock backend remembers the current temporary account and the verified ID, like the real one would. */

/** IDs that can open a dedicated NGN account. "permit" (passport and residence permit) depends on the partner. */
export type NgnIdRoute = "bvn" | "nin" | "nrbvn" | "permit";
/** A temporary account, created per top-up for one exact amount (kobo). */
export type TemporaryAccount = { num: string; amount: Kobo; expiresAt: number; ref: string };
export type DedicatedAccount = { status: "pending" | "ready" | "frozen" | "rejected"; num: string };

/** Validity of a temporary account. [time] placeholder until the partner confirms it. */
export const NGN_TEMP_MINUTES = 30;

const ngnServer: { temp: TemporaryAccount | null; verifiedId: { route: NgnIdRoute; last4: string } | null; dedicated: DedicatedAccount | null } = { temp: null, verifiedId: null, dedicated: null };
const genRef = () => "TXN-" + Math.floor(100000 + Math.random() * 900000);

/** POST /v1/ngn/temporary-accounts. A 10-digit account for one exact amount, valid NGN_TEMP_MINUTES. */
export async function createTemporaryAccount(amount: Kobo): Promise<TemporaryAccount> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("amount must be positive integer kobo");
  await wait(1200);
  const temp = { num: String(Math.floor(1e9 + Math.random() * 8.9e9)), amount, expiresAt: Date.now() + NGN_TEMP_MINUTES * 60000, ref: genRef() };
  ngnServer.temp = temp;
  return temp;
}

/** Demo only: the person's bank transfer reaches the current temporary account and is credited. */
export async function simulateTransferArrives(): Promise<{ amount: Kobo; ref: string }> {
  const temp = ngnServer.temp;
  if (!temp) throw new Error("no_temporary_account");
  if (Date.now() > temp.expiresAt) throw new Error("temporary_account_expired");
  await wait(1800);
  ngnServer.temp = null; // use it once
  return { amount: temp.amount, ref: temp.ref };
}

/**
 * POST /v1/ngn/id-checks. Looks up the BVN, NIN or NRBVN and matches it to the verified name and date of birth.
 * Demo: 00000000000 is a mismatch; any other 11 digits match. Attempts are counted by the caller (shared with Veriff).
 */
export async function checkId(route: NgnIdRoute, number: string): Promise<{ match: true; last4: string } | { match: false }> {
  if (route === "permit") throw new Error("permit_not_supported"); // documents, not a number lookup
  if (!/^\d{11}$/.test(number)) throw new Error("id_number_must_be_11_digits");
  await wait(1400);
  if (number === "00000000000") return { match: false };
  ngnServer.verifiedId = { route, last4: number.slice(-4) };
  return { match: true, last4: number.slice(-4) };
}

/** POST /v1/ngn/accounts. Needs a matched ID. NGN transfers are instant, so the account is ready at once. */
export async function createDedicatedAccount(): Promise<DedicatedAccount> {
  if (!ngnServer.verifiedId) throw new Error("id_not_verified");
  await wait(1500);
  ngnServer.dedicated = { status: "ready", num: String(Math.floor(1e9 + Math.random() * 8.9e9)) };
  return { ...ngnServer.dedicated };
}

/** POST /v1/ngn/accounts/freeze | unfreeze. While frozen, incoming transfers are returned. */
export async function setDedicatedAccountFrozen(frozen: boolean): Promise<DedicatedAccount> {
  const d = ngnServer.dedicated;
  if (!d) throw new Error("no_dedicated_account");
  d.status = frozen ? "frozen" : "ready";
  return { ...d };
}

/** DELETE /v1/ngn/accounts. The balance stays in the wallet; later transfers to the old number are returned. */
export async function closeDedicatedAccount(): Promise<void> {
  if (!ngnServer.dedicated) throw new Error("no_dedicated_account");
  ngnServer.dedicated = null;
}

/** Demo controls: put the mock backend in a given state (a dedicated account, a verified ID). */
export function seedNgnServer(patch: { dedicated?: DedicatedAccount | null; verifiedId?: { route: NgnIdRoute; last4: string } | null }) {
  if ("dedicated" in patch) ngnServer.dedicated = patch.dedicated ? { ...patch.dedicated } : null;
  if ("verifiedId" in patch) ngnServer.verifiedId = patch.verifiedId ?? null;
}

/** Demo reset (the prototype's setScenario). */
export function resetNgnServer() {
  ngnServer.temp = null;
  ngnServer.verifiedId = null;
  ngnServer.dedicated = null;
}
