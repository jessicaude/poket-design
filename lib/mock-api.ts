/**
 * Mock Poket API: stands in for the backend while designing.
 * Function names follow the planned endpoints so engineering can swap in real calls.
 */
import type { Account, PaymentMethod } from "@/store/account";
import type { CardOutcome } from "@/store/demo";
import type { Kobo } from "@/lib/money";
import { detectBrand, fundingOf } from "@/lib/card";

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

/** POST /v1/accounts: a new sign-up is remembered, so the same email logs in next time. */
export function registerAccount(a: Account) {
  DIRECTORY[a.email.trim().toLowerCase()] = structuredClone(a);
}
/** The account as the server keeps it (tier, failed ID checks, a block, methods, payments) after a change in a widget. */
export function saveAccount(a: Account) {
  const key = a.email.trim().toLowerCase();
  if (DIRECTORY[key]) DIRECTORY[key] = structuredClone(a);
}

/**
 * Wrong verification codes lock the account: after CODE_LIMIT_DEMO wrong codes in a row ([n]: a demo value, never
 * shown) it's locked for ACCOUNT_LOCK_MS (2 hours). Checkout's sign-up and log-in codes and the wallet's device codes
 * count together. A right code resets the count.
 */
export const CODE_LIMIT_DEMO = 5;
export const ACCOUNT_LOCK_MS = 2 * 60 * 60 * 1000;
/** The error a code check throws when the account is (or has just become) locked. */
export const ACCOUNT_LOCKED = "account_locked";
const codeServer = { failures: 0, lockedUntil: 0 };

/** POST /v1/auth/verify. In the demo any 6 digits work; 000000 is a wrong code. Throws ACCOUNT_LOCKED while locked. */
export async function verifyCode(code: string): Promise<void> {
  await wait(700);
  if (accountLockedUntil()) throw new Error(ACCOUNT_LOCKED);
  if (code === "000000") {
    codeServer.failures++;
    if (codeServer.failures >= CODE_LIMIT_DEMO) {
      codeServer.failures = 0;
      codeServer.lockedUntil = Date.now() + ACCOUNT_LOCK_MS;
      throw new Error(ACCOUNT_LOCKED);
    }
    throw new Error("That code isn’t right. Check it and try again.");
  }
  codeServer.failures = 0;
}
/** When the account's lock ends (ms), or null when it isn't locked. */
export const accountLockedUntil = () => (codeServer.lockedUntil > Date.now() ? codeServer.lockedUntil : null);
/** Demo: "Skip lock time" (and tests): unlock now, and start the count again. */
export function skipAccountLock() { codeServer.lockedUntil = 0; codeServer.failures = 0; }

/** POST /v1/payments */
export async function createPayment(method: PaymentMethod, outcome: CardOutcome): Promise<{ id: string }> {
  await wait(1200);
  if (outcome === "declined" && method.kind === "card") throw new Error("card_declined");
  return { id: "pay_" + Math.random().toString(36).slice(2, 10) };
}

/**
 * The account Checkout shows for a bank transfer. "Dynamic": a one-time virtual account for one exact naira amount and one
 * order, valid NGN_TEMP_MINUTES [time]. "Merchant pool": the merchant's shared account; it doesn't expire (expiresAt null),
 * and CentryOS matches each transfer to its order.
 */
export type CheckoutVirtualAccount = { id: string; kind: "dynamic" | "pool"; num: string; amount: number; accountName: string; orderRef: string; expiresAt: number | null };
const checkoutServer: { va: CheckoutVirtualAccount | null } = { va: null };

/** POST /v1/checkout/virtual-accounts. Replaces any earlier account for this checkout. */
export async function createCheckoutVirtualAccount(p: { amount: number; merchant: string; orderRef: string }): Promise<CheckoutVirtualAccount> {
  if (!Number.isInteger(p.amount) || p.amount <= 0) throw new Error("amount must be positive integer kobo");
  await wait(1000);
  const va = { id: "va_" + Math.random().toString(36).slice(2, 10), kind: "dynamic" as const, num: String(Math.floor(1e9 + Math.random() * 8.9e9)), amount: p.amount,
    accountName: `${p.merchant} via Poket`, orderRef: p.orderRef, expiresAt: Date.now() + NGN_TEMP_MINUTES * 60000 };
  checkoutServer.va = va;
  return va;
}


/** Each merchant's pool account number (demo values, stable per merchant). */
const POOL_NUMBERS: Record<string, string> = { "Ilé Living": "2045118830" };

/** GET /v1/checkout/pool-account: the merchant's pool account, with this order's exact amount to send. */
export async function getMerchantPoolAccount(p: { amount: number; merchant: string; orderRef: string }): Promise<CheckoutVirtualAccount> {
  if (!Number.isInteger(p.amount) || p.amount <= 0) throw new Error("amount must be positive integer kobo");
  await wait(600);
  const va = { id: "pool_" + p.orderRef, kind: "pool" as const, num: POOL_NUMBERS[p.merchant] ?? "2045110000", amount: p.amount,
    accountName: `${p.merchant} via Poket`, orderRef: p.orderRef, expiresAt: null };
  checkoutServer.va = va;
  return va;
}

/** What CentryOS made of a transfer into a checkout account: matched to the order, then paid, short or over. */
export type TransferMatch = { status: "paid" | "underpaid" | "overpaid"; received: number; id: string };

/**
 * Demo only: a transfer of `received` kobo reaches the one-time account or the pool, and CentryOS matches it to the order
 * automatically. Each account is used once; a one-time account refuses transfers after it expires.
 */
export async function simulateCheckoutTransfer(id: string, received: number): Promise<TransferMatch> {
  const va = checkoutServer.va;
  if (!va || va.id !== id) throw new Error("no_virtual_account");
  if (va.expiresAt !== null && Date.now() > va.expiresAt) throw new Error("virtual_account_expired");
  if (!Number.isInteger(received) || received <= 0) throw new Error("received must be positive integer kobo");
  await wait(1200);
  checkoutServer.va = null;
  const status = received === va.amount ? "paid" : received < va.amount ? "underpaid" : "overpaid";
  return { status, received, id: "pay_" + Math.random().toString(36).slice(2, 10) };
}

/** Demo only: "Let it expire". */
export function expireCheckoutVirtualAccount(id: string) {
  if (checkoutServer.va?.id === id) checkoutServer.va = { ...checkoutServer.va, expiresAt: Date.now() - 1 };
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

/* ---------- Payout and PIN ----------
   From the wallet's tPayout (seed data: seedAccount()'s linkedBanks and cash recipients) and the checkout's PIN steps
   (tPin, pinComplete, tPinLocked, tPinResetOtp) in reference/poket-unified.html. */

export type PayoutCurrency = "USD" | "NGN" | "EUR" | "GBP" | "GHS";
/** "poket" and "wallet": Send's Poket users and stablecoin wallets, carried through the same send flow as bank accounts. */
export type PayoutMethodType = "bank" | "card" | "zelle" | "cashapp" | "poket" | "wallet";
/** A payout destination. isSelf: one of your own linked methods (S.linkedBanks); otherwise a saved recipient. */
export type PayoutRecipient = {
  id: string;
  isSelf: boolean;
  /** Nickname for your own methods, the person's name for recipients. */
  name: string;
  holderName?: string;
  currency: PayoutCurrency;
  methodType: PayoutMethodType;
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  railType?: string;
  cardNumber?: string;
  zelleContact?: string;
  cashtag?: string;
  address?: string; city?: string; state?: string; zip?: string; country?: string;
  /** Has received a payout before. A first NGN payment to an account is held for [hold] before it sends. */
  paidBefore?: boolean;
  /** false: added for one send without saving it ("Save recipient" unticked); kept off Send's saved list. */
  saved?: boolean;
  /** US bank accounts: the bank's full name (Send's new-recipient form). US banks have one speed. */
  bankFullName?: string;
  /** Poket users: their @handle, email or phone. Stablecoin wallets: the address, coin and network. */
  handle?: string;
  /** Poket users (WGT-07): whether they can hold naira; unset follows the demo bar ("Recipient can hold naira"). */
  holdsNaira?: boolean;
  walletAddress?: string;
  asset?: "USDC" | "USDT";
  network?: WalletNetwork;
};

const PAYOUT_SEED: PayoutRecipient[] = [
  { id: "lb1", isSelf: true, name: "Personal checking", bankName: "Chase Bank", accountNumber: "****4821", routingNumber: "021000021", currency: "USD", methodType: "bank" },
  { id: "lb2", isSelf: true, name: "Naira account", bankName: "GTBank", accountNumber: "0123456789", routingNumber: "", currency: "NGN", methodType: "bank", paidBefore: true },
  { id: "r4", isSelf: false, name: "Jordan Blake", currency: "USD", bankName: "Chase Bank", accountNumber: "****4821", routingNumber: "021000021", methodType: "bank" },
  { id: "r6", isSelf: false, name: "Ngozi Eze", currency: "NGN", bankName: "GTBank", accountNumber: "0123456789", routingNumber: "", methodType: "bank" },
];

export const PIN_MAX_ATTEMPTS = 3;
const payoutServer: { recipients: PayoutRecipient[]; pin: string | null; pinAttempts: number } = {
  recipients: PAYOUT_SEED.map((r) => ({ ...r })), pin: null, pinAttempts: 0,
};

/** GET /v1/payout/recipients: your linked methods first, then saved recipients. */
export function listPayoutRecipients(): PayoutRecipient[] {
  return payoutServer.recipients.map((r) => ({ ...r }));
}

/** A name for comparing: case, spacing and word order don't matter ("OSUN ADA" is "Ada Osun"). */
const nameKey = (n: string) => n.toLowerCase().split(/[\s,.-]+/).filter(Boolean).sort().join(" ");

/**
 * POST /v1/send/recipients/cards: a debit card to send to (the explore prototype's card fields). Only Visa and
 * Mastercard debit cards: credit cards can't receive payouts (docs/decisions.md). Only the last 4 digits are kept.
 */
export async function saveDebitCard(c: { number: string; name: string; zip: string; saved: boolean; /** The verified user's name: a card in that name is theirs. */ verifiedName?: string }): Promise<PayoutRecipient> {
  await wait(500);
  const n = c.number.replace(/\D/g, ""), brand = detectBrand(n);
  if ((brand !== "visa" && brand !== "mc") || n.length !== 16) throw new Error("unsupported_card");
  if (fundingOf(n) === "credit") throw new Error("credit_card");
  if (!/^\d{5}$/.test(c.zip) || c.name.trim().length < 2) throw new Error("invalid_request");
  const isSelf = !!c.verifiedName && nameKey(c.name) === nameKey(c.verifiedName);
  const saved: PayoutRecipient = {
    id: "dc" + Date.now(), isSelf, name: c.name.trim(), holderName: c.name.trim(), currency: "USD", methodType: "card",
    bankName: brand === "visa" ? "Visa" : "Mastercard", accountNumber: n.slice(-4), zip: c.zip, saved: c.saved, paidBefore: false,
  };
  payoutServer.recipients.push(saved);
  return { ...saved };
}

/** POST /v1/payout/recipients. Your own methods must be in your name (checked on screen against the verified name). */
export async function savePayoutRecipient(r: Omit<PayoutRecipient, "id">): Promise<PayoutRecipient> {
  await wait(500);
  const saved = { ...r, id: (r.isSelf ? "lb" : "r") + Date.now(), paidBefore: false };
  payoutServer.recipients.push(saved);
  return { ...saved };
}

/**
 * A reservation holds money out of the available balance for one payout, from the moment the PIN is accepted.
 * "used" once a withdrawal is created against it (the withdrawal's status then decides when it clears);
 * "released" if no withdrawal was made.
 */
export type Reservation = { id: string; amount: number; status: "reserved" | "used" | "released" };
const reservations = new Map<string, Reservation>();

/** POST /v1/payouts/reservations, called once the PIN is accepted. `amount` includes any fee. */
export async function reservePayout(p: { currency: string; amount: number }): Promise<Reservation> {
  if (!Number.isInteger(p.amount) || p.amount <= 0) throw new Error("invalid_amount");
  const r: Reservation = { id: "rsv_" + Math.random().toString(36).slice(2, 10), amount: p.amount, status: "reserved" };
  reservations.set(r.id, r);
  return { ...r };
}

/** DELETE /v1/payouts/reservations/:id: the money goes back to the available balance. */
export async function releaseReservation(id: string): Promise<void> {
  const r = reservations.get(id);
  if (r && r.status === "reserved") r.status = "released";
}

/**
 * A withdrawal's status. scheduled: a first payment to an account, sends after [hold]. review: held for a risk check
 * (open-ended). sending: on its way. paid. failed: never left, funds returned. reversed: paid, then returned by the bank.
 * While scheduled, review or sending, its amount (plus fee) stays reserved out of the balance.
 */
export type WithdrawalStatus = "scheduled" | "review" | "sending" | "paid" | "failed" | "reversed";
export type Withdrawal = {
  id: string; ref: string; currency: PayoutCurrency; amount: number; fee: number;
  recipientId: string; recipientName: string; recipientSub: string; createdAt: number; status: WithdrawalStatus;
  /** A send paid from another balance converts on the way: one record, with what left the source and at what rate. */
  conversion?: { paidText: string; receivedText: string; rateText: string; feeText: string };
  /** Bank account, debit card, Poket user or stablecoin wallet. */
  kind: "bank" | "card" | "poket" | "wallet";
  /** How the send reads (they get, fee, arrival), for any kind; the source and what it reserved. */
  amountText?: string; feeText?: string; arrival?: string;
  /** How long it takes once sending ("Usually within seconds", "About 1 minute", "1 to 3 business days"...). */
  eta?: string;
  /** A Poket user paid from card-funded USD: the tag their money keeps. */
  tag?: "FIAT-ONLY";
  /** Held (status "review") for a quick check: a first payment of $500 or more to a new card, wallet or Poket user. */
  quickCheck?: boolean;
  sourceKey?: string; sourceTotal?: number;
  /** A Poket user: what they receive (a cvKey); naira converts to USD on receipt when they can't hold naira (WGT-07). */
  targetKey?: string;
  /** Where the reservation sits: the NGN balance's "on hold" ("ngn"), or taken from the paying balance ("source"). */
  reservedIn?: "ngn" | "source";
};
const withdrawals: Withdrawal[] = [];

/**
 * POST /v1/payouts (a send), against a reservation. A first payment to a bank account is "scheduled" (it sends after
 * [hold]); a Poket user is paid at once ("paid"); otherwise it's "sending". A bank account then counts as paid before.
 * Bank accounts and debit cards must be saved recipients; Poket users and stablecoin wallets aren't in that list, so
 * their name and details come with the send.
 */
export async function createPayout(p: {
  currency: PayoutCurrency; amount: number; fee: number; recipientId: string; reservationId: string; recipientSub?: string;
  conversion?: Withdrawal["conversion"]; kind?: Withdrawal["kind"]; recipientName?: string;
  amountText?: string; feeText?: string; arrival?: string; eta?: string; sourceKey?: string; sourceTotal?: number; reservedIn?: "ngn" | "source";
  /** The USD value leaving the source, in cents: a first payment of $500 or more to a new card, wallet or Poket user is held for a quick check. */
  usdOut?: number;
  /** A Poket user: what they receive (a cvKey), when it isn't the source (naira converted to USD on receipt). */
  targetKey?: string;
  /** The 3rd failed selfie check before the send: it's held for review (status "review"), not sent. */
  heldForReview?: boolean;
}): Promise<Withdrawal> {
  const kind = p.kind ?? "bank";
  // WGT-07: a Poket user who can't hold naira never receives naira
  if (kind === "poket") {
    const target = p.targetKey ?? p.sourceKey ?? "cash:NGN:open";
    const user = POKET_USERS.find((u) => u.id === p.recipientId);
    if (target.startsWith("cash:NGN:") && !poketUserHoldsNaira(user)) throw new Error("recipient_cannot_hold_naira");
  }
  const rsv = reservations.get(p.reservationId);
  const reserved = p.sourceTotal ?? p.amount + p.fee;
  if (!rsv || rsv.status !== "reserved" || rsv.amount !== reserved) throw new Error("invalid_reservation");
  const listed = kind === "bank" || kind === "card";
  const recipient = listed ? payoutServer.recipients.find((r) => r.id === p.recipientId) : undefined;
  if (listed && !recipient) throw new Error("unknown_recipient");
  await wait(1500);
  rsv.status = "used";
  const w: Withdrawal = {
    id: "wd_" + Math.random().toString(36).slice(2, 10), ref: "TXN-" + Math.floor(100000 + Math.random() * 900000),
    currency: p.currency, amount: p.amount, fee: p.fee, recipientId: p.recipientId, recipientName: recipient?.name ?? p.recipientName ?? "",
    recipientSub: p.recipientSub ?? "", createdAt: Date.now(), ...(p.conversion ? { conversion: { ...p.conversion } } : {}),
    kind, amountText: p.amountText, feeText: p.feeText, arrival: p.arrival, eta: p.eta, sourceKey: p.sourceKey, sourceTotal: p.sourceTotal, reservedIn: p.reservedIn ?? "ngn",
    ...(p.targetKey ? { targetKey: p.targetKey } : {}),
    status: kind === "poket" ? "paid" : kind === "bank" && !recipient!.paidBefore ? "scheduled" : "sending",
  };
  // A first payment of $500 or more to a new card, stablecoin wallet or Poket user: held for a quick check (the
  // exploration's applySend). Bank accounts have the first-payment hold instead; your own card isn't checked.
  const poketUser = kind === "poket" ? POKET_USERS.find((u) => u.id === p.recipientId) : undefined;
  const wallet = kind === "wallet" ? STABLECOIN_WALLETS.find((x) => x.id === p.recipientId) : undefined;
  const isNew = kind === "card" ? !recipient!.isSelf && !recipient!.paidBefore : kind === "poket" ? !poketUser?.paidBefore : kind === "wallet" ? !wallet?.paidBefore : false;
  if (isNew && (p.usdOut ?? 0) >= QUICK_CHECK_USD_CENTS) { w.status = "review"; w.quickCheck = true; }
  if (p.heldForReview) { w.status = "review"; delete w.quickCheck; }
  if (recipient) recipient.paidBefore = true;
  if (poketUser) poketUser.paidBefore = true;
  if (wallet) wallet.paidBefore = true;
  // A Poket user is credited in the source's currency once paid (at once, unless held for a quick check);
  // card-funded money keeps its FIAT-ONLY tag
  if (kind === "poket") {
    const bucket = (p.sourceKey ?? "cash:NGN:open").split(":")[2];
    if (p.sourceKey?.startsWith("cash:") && bucket === "fiat") w.tag = "FIAT-ONLY";
    if (w.status === "paid") creditPoketUser(w);
  }
  withdrawals.unshift(w);
  return { ...w };
}

/** Poket users' balances, as credited by sends: "{currency}:{open | merchant | fiat}" → minor units. */
const poketBalances: Record<string, Record<string, number>> = {};
/** What a Poket user sees in their activity: what they received, in their currency, with its tag. */
export type PoketActivity = { id: string; recipientId: string; recipientName: string; amountText: string; tag?: Withdrawal["tag"]; at: number };
const poketActivity: PoketActivity[] = [];
/**
 * A paid send to a Poket user lands in their balance in what they receive (the target: the source's currency, or USD
 * when naira converted on receipt), keeping its tag, and shows in their activity.
 */
function creditPoketUser(w: Withdrawal) {
  const [k, cur, bucket] = (w.targetKey ?? w.sourceKey ?? "cash:NGN:open").split(":");
  const tagged = k === "cash" && bucket === "fiat" ? "fiat" : "open";
  const asset = k === "cash" ? cur : `${cur} (${bucket})`;
  const book = (poketBalances[w.recipientId] ??= {});
  book[`${asset}:${tagged}`] = (book[`${asset}:${tagged}`] ?? 0) + w.amount;
  poketActivity.unshift({ id: w.id, recipientId: w.recipientId, recipientName: w.recipientName, amountText: w.amountText ?? "", ...(w.tag ? { tag: w.tag } : {}), at: Date.now() });
}
/** Demo: every Poket user's received payments, newest first (the recipient's activity, for the demo panel). */
export const listPoketActivity = () => poketActivity.map((a) => ({ ...a }));
/** $500.00: a first payment at least this much (USD value) to a new card, wallet or Poket user is held for a quick check. */
export const QUICK_CHECK_USD_CENTS = 50000;
/** Demo / tests: what a Poket user has received, by currency and tag (e.g. { "USD:fiat": 500 }). */
export const getPoketUserBalances = (id: string) => ({ ...(poketBalances[id] ?? {}) });

/** The reference's FLAGGED_ADDRESSES: test addresses that fail screening (standing in for a sanctions list provider). */
const FLAGGED_ADDRESSES = new Set(["0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", "0xbadc0debadc0debadc0debadc0debadc0debadc0", "flagged-test-wallet", "@flagged"]);
/** POST /v1/addresses/screen: the reference's gateAddress (900 ms), before sending to a stablecoin wallet. */
export async function screenAddress(address: string): Promise<{ ok: boolean }> {
  await wait(900);
  return { ok: !FLAGGED_ADDRESSES.has(address.trim().toLowerCase()) };
}

/** GET /v1/payouts, newest first. */
export function listWithdrawals(): Withdrawal[] {
  return withdrawals.map((w) => ({ ...w }));
}

/**
 * GET /v1/ngn/instant-transfers/today (WGT-09): naira sent to Nigerian bank accounts today, in kobo (what the banks
 * receive, whatever paid it). Failed and reversed sends don't count; scheduled, held and sending ones do.
 */
export function getInstantSentToday(now = new Date()): number {
  return withdrawals
    .filter((w) => (w.kind ?? "bank") === "bank" && w.currency === "NGN" && !["failed", "reversed"].includes(w.status)
      && new Date(w.createdAt).toDateString() === now.toDateString())
    .reduce((t, w) => t + w.amount, 0);
}

/** Which statuses each demo action can move a withdrawal from (the provider's webhooks, in production). */
export const WITHDRAWAL_TRANSITIONS: Record<WithdrawalStatus, WithdrawalStatus[]> = {
  scheduled: ["sending", "review", "paid", "failed"],
  review: ["sending", "paid", "failed"],
  sending: ["review", "paid", "failed"],
  paid: ["reversed"],
  failed: [],
  reversed: [],
};

/** Demo: move a withdrawal to a new status, as the payout provider would. Throws if the move isn't allowed. */
export async function setWithdrawalStatus(id: string, to: WithdrawalStatus): Promise<Withdrawal> {
  const w = withdrawals.find((x) => x.id === id);
  if (!w) throw new Error("unknown_withdrawal");
  if (!WITHDRAWAL_TRANSITIONS[w.status].includes(to)) throw new Error(`cannot_${w.status}_to_${to}`);
  w.status = to;
  if (to === "paid" && w.kind === "poket") creditPoketUser(w);
  return { ...w };
}

export const hasPin = () => payoutServer.pin !== null;

/** PUT /v1/pin. 4 digits. */
export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error("invalid_pin");
  payoutServer.pin = pin;
  payoutServer.pinAttempts = 0;
}

/** POST /v1/pin/verify. After PIN_MAX_ATTEMPTS wrong tries the PIN is locked until it is reset. */
export async function verifyPin(pin: string): Promise<{ ok: true } | { ok: false; attemptsLeft: number; locked: boolean }> {
  if (payoutServer.pin === null) throw new Error("no_pin");
  if (pin === payoutServer.pin) { payoutServer.pinAttempts = 0; return { ok: true }; }
  payoutServer.pinAttempts += 1;
  const attemptsLeft = Math.max(0, PIN_MAX_ATTEMPTS - payoutServer.pinAttempts);
  return { ok: false, attemptsLeft, locked: attemptsLeft === 0 };
}

/** The reference resets the PIN's attempt count each time the PIN step opens (wdGo: S.pinAttempts = 0). */
export function resetPinAttempts() { payoutServer.pinAttempts = 0; }

/** POST /v1/pin/reset: checks the 6-digit passcode emailed to you, then clears the PIN so a new one can be created. */
export async function verifyPinResetCode(code: string): Promise<void> {
  if (!/^\d{6}$/.test(code)) throw new Error("invalid_code");
  payoutServer.pin = null;
  payoutServer.pinAttempts = 0;
}

/** Demo controls. */
export function seedPayoutServer(patch: { pin?: string | null }) {
  if ("pin" in patch) { payoutServer.pin = patch.pin ?? null; payoutServer.pinAttempts = 0; }
}
export function resetPayoutServer() {
  enquiryServer.available = true;
  reservations.clear();
  withdrawals.length = 0;
  for (const k of Object.keys(poketBalances)) delete poketBalances[k];
  for (const x of [...POKET_USERS, ...STABLECOIN_WALLETS]) delete x.paidBefore;
  poketActivity.length = 0;
  poketNaira.othersHold = true;
  payoutServer.recipients = PAYOUT_SEED.map((r) => ({ ...r }));
  payoutServer.pin = null;
  payoutServer.pinAttempts = 0;
}

/* ---------- NGN bank accounts: bank list and name enquiry ---------- */

/** A Nigerian bank, with its CBN bank code (what a NIP name enquiry is addressed to). */
export type NgBank = { code: string; name: string };
/** The reference's ngBanks, plus Stanbic IBTC and Polaris, to make 12. */
export const NG_BANKS: NgBank[] = [
  { code: "044", name: "Access Bank" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "058", name: "GTBank" },
  { code: "076", name: "Polaris Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "032", name: "Union Bank" },
  { code: "033", name: "UBA" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
];

/** GET /v1/ngn/banks. */
export async function listNgBanks(): Promise<NgBank[]> {
  return NG_BANKS.map((b) => ({ ...b }));
}

export type NameEnquiry = { status: "found"; accountName: string } | { status: "not_found" };
/** `partner`: the naira partner is up (WGT-13); while it's down, the name enquiry is unavailable too. */
const enquiryServer = { available: true, partner: true };

/**
 * POST /v1/ngn/name-enquiry: the name on a 10-digit account at a bank. Throws "lookup_unavailable" when the
 * enquiry service is down. Mock: ending 0000 is not found; ending 1111 is someone else (a made-up name);
 * any other number is in `holderName`, the verified user's name.
 */
export async function nameEnquiry(bankCode: string, accountNumber: string, holderName: string): Promise<NameEnquiry> {
  if (!/^\d{10}$/.test(accountNumber) || !NG_BANKS.some((b) => b.code === bankCode)) throw new Error("invalid_request");
  await wait(900);
  if (!enquiryServer.available || !enquiryServer.partner) throw new Error("lookup_unavailable");
  if (accountNumber.endsWith("0000")) return { status: "not_found" };
  if (accountNumber.endsWith("1111")) return { status: "found", accountName: otherAccountName(accountNumber + bankCode) };
  return { status: "found", accountName: holderName };
}
/** Demo control: make the name enquiry service unavailable. */
export function setNameEnquiryAvailable(available: boolean) { enquiryServer.available = available; }
/** Demo control (WGT-13): the naira partner up or down. */
export function setNairaPartnerAvailable(up: boolean) { enquiryServer.partner = up; }

/** The reference's resolveNgAccountName: a seeded Nigerian name for an account that isn't yours. */
function otherAccountName(seed: string): string {
  const first = ["Adaeze", "Chinedu", "Ngozi", "Emeka", "Amaka", "Tunde", "Folake", "Ibrahim", "Aisha", "Chukwuemeka"];
  const last = ["Okafor", "Balogun", "Eze", "Abubakar", "Adeyemi", "Nwosu", "Okonkwo", "Yusuf", "Bello", "Chukwu"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 8) / 0x1000000; };
  return first[Math.floor(rand() * first.length)] + " " + last[Math.floor(rand() * last.length)];
}

/* ---------- Convert ---------- */

/** A completed conversion, for the activity list and its receipt. Texts are as shown at confirmation. */
export type Conversion = {
  id: string; ref: string; from: string; to: string; amount: number; fee: number; receive: number; createdAt: number;
  rateText: string; feeLabel: string; feeText: string; paidText: string; receivedText: string;
};
const conversionServer: { list: Conversion[]; ngnToCoins: boolean } = { list: [], ngnToCoins: true };

/** Demo control "NGN to stablecoins: Allowed / Blocked". */
export function setNgnToStablecoinsAllowed(allowed: boolean) { conversionServer.ngnToCoins = allowed; }

/**
 * POST /v1/conversions: convert `amount` of one balance (`from`, a cvKey like "cash:NGN:open") into another (`to`),
 * at the quote the user confirmed. The reference shows "Converting…" for 1.3s, then the result. Refused:
 * card-funded (FIAT-ONLY) cash to a stablecoin or to naira; naira to stablecoins (USDC or USDT) while that's switched off.
 */
export async function createConversion(p: Omit<Conversion, "id" | "ref" | "createdAt">): Promise<Conversion> {
  if (!Number.isInteger(p.amount) || p.amount <= 0 || !Number.isInteger(p.receive)) throw new Error("invalid_amount");
  const fiat = p.from.startsWith("cash:") && p.from.endsWith(":fiat");
  if (fiat && p.to.startsWith("coin:")) throw new Error("fiat_only_to_digital_asset");
  if (fiat && p.to.startsWith("cash:NGN:")) throw new Error("fiat_only_to_ngn");
  if (p.from.startsWith("cash:NGN:") && p.to.startsWith("coin:") && !conversionServer.ngnToCoins) throw new Error("ngn_to_stablecoins_unavailable");
  await wait(1300);
  const c: Conversion = { ...p, id: "cv_" + Math.random().toString(36).slice(2, 10), ref: "TXN-" + Math.floor(100000 + Math.random() * 900000), createdAt: Date.now() };
  conversionServer.list.unshift(c);
  return { ...c };
}

/** GET /v1/conversions, newest first. */
export function listConversions(): Conversion[] { return conversionServer.list.map((c) => ({ ...c })); }
export function resetConversionServer() { conversionServer.list = []; conversionServer.ngnToCoins = true; }

/* ---------- Send: saved recipients ----------
   Send is recipient-first (docs/decisions.md). Bank accounts are the payout recipients above (your own and saved);
   Poket users and stablecoin wallets are seeded from reference/poket-wallet-explore.html (DIRECTORY, SAVED.external). */

export type PoketUser = {
  id: string; name: string; handle: string; initials: string; /** Has been sent money before. */ paidBefore?: boolean;
  /** WGT-07: can hold naira (BVN or NIN, and eligible). Unset: the demo bar's "Recipient can hold naira" decides. */
  holdsNaira?: boolean;
};

/** Demo bar "Recipient can hold naira: Yes / No": every Poket user without their own setting (not Amara or Daniel). */
const poketNaira = { othersHold: true };
export function setOtherPoketUsersHoldNaira(v: boolean) { poketNaira.othersHold = v; }
/** Whether a Poket user can hold naira: their own setting, else the demo bar's. */
export const poketUserHoldsNaira = (u: Pick<PoketUser, "holdsNaira"> | undefined) => u?.holdsNaira ?? poketNaira.othersHold;
export type WalletNetwork = "Base" | "Polygon" | "Solana" | "Ethereum";
export type StablecoinWallet = { id: string; name: string; address: string; asset: "USDC" | "USDT"; network: WalletNetwork; /** Has been sent money before. */ paidBefore?: boolean };
export type SendRecipient =
  | { kind: "bank"; id: string; self: boolean; bank: PayoutRecipient }
  | { kind: "card"; id: string; self: boolean; card: PayoutRecipient }
  | { kind: "poket"; id: string; user: PoketUser }
  | { kind: "wallet"; id: string; wallet: StablecoinWallet };

const POKET_USERS: PoketUser[] = [
  { id: "pu1", name: "Tobi Bello", handle: "tobi@lagos.ng", initials: "TB" },
  { id: "pu2", name: "Ngozi Okafor", handle: "+2348031234567", initials: "NO" },
  { id: "pu3", name: "Kemi Adeyemi", handle: "kemi.a@gmail.com", initials: "KA" },
  // WGT-07: Amara can hold naira; Daniel can't (lives abroad)
  { id: "pu4", name: "Amara Okafor", handle: "@amara", initials: "AO", holdsNaira: true },
  { id: "pu5", name: "Daniel Cho", handle: "@dcho", initials: "DC", holdsNaira: false },
];
const STABLECOIN_WALLETS: StablecoinWallet[] = [
  { id: "sw1", name: "Ledger", address: "0x3Fa9cE21b7D04a5e9C6b1d82F7e0A4c39bD58e12", asset: "USDC", network: "Base" },
];

/**
 * GET /v1/send/recipients: your own bank accounts and debit cards (self), then saved bank accounts, debit cards, Poket
 * users and stablecoin wallets.
 */
export function listSendRecipients(): SendRecipient[] {
  const banks = payoutServer.recipients.filter((r) => r.methodType === "bank" && r.saved !== false);
  const cards = payoutServer.recipients.filter((r) => r.methodType === "card" && r.saved !== false);
  return [
    ...banks.filter((r) => r.isSelf).map((r) => ({ kind: "bank" as const, id: `bank:${r.id}`, self: true, bank: { ...r } })),
    ...banks.filter((r) => !r.isSelf).map((r) => ({ kind: "bank" as const, id: `bank:${r.id}`, self: false, bank: { ...r } })),
    ...cards.map((r) => ({ kind: "card" as const, id: `card:${r.id}`, self: r.isSelf, card: { ...r } })),
    ...POKET_USERS.map((u) => ({ kind: "poket" as const, id: `poket:${u.id}`, user: { ...u } })),
    ...STABLECOIN_WALLETS.map((w) => ({ kind: "wallet" as const, id: `wallet:${w.id}`, wallet: { ...w } })),
  ];
}

/**
 * The Poket directory for name lookup: the reference Transfer's contacts (w2wContacts, by @handle) and the explore
 * prototype's DIRECTORY (by email or phone). Saved Poket users are found too.
 */
const POKET_DIRECTORY: PoketUser[] = [
  { id: "pd1", name: "Amara Okafor", handle: "@amara", initials: "AO", holdsNaira: true },
  { id: "pd2", name: "Daniel Cho", handle: "@dcho", initials: "DC", holdsNaira: false },
  { id: "pd3", name: "Priya Nair", handle: "@priya", initials: "PN" },
  ...POKET_USERS.map((u) => ({ ...u, id: "pd-" + u.id })),
];
/** The reference Transfer's contacts, shown as recent recipients when adding a Poket user. */
export const RECENT_POKET_CONTACTS = POKET_DIRECTORY.slice(0, 3).map((u) => ({ ...u }));

const normHandle = (q: string) => (q.trim().startsWith("@") || q.includes("@") ? q.trim().toLowerCase() : q.replace(/[^\d+]/g, ""));
/** POST /v1/poket-users/lookup: the Poket user behind an @handle, email or phone number, or null. */
export async function lookupPoketUser(query: string): Promise<PoketUser | null> {
  await wait(700);
  const q = normHandle(query);
  const u = POKET_DIRECTORY.find((x) => normHandle(x.handle) === q);
  return u ? { ...u } : null;
}

/** POST /v1/send/recipients: save a Poket user or a stablecoin wallet (bank accounts use savePayoutRecipient). */
export async function savePoketUser(u: Omit<PoketUser, "id">): Promise<PoketUser> {
  await wait(400);
  const existing = POKET_USERS.find((x) => x.handle === u.handle);
  // Already saved: keep the record (and whether they can hold naira); a new nickname replaces the name shown
  if (existing) { existing.name = u.name; return { ...existing }; }
  const saved = { ...u, id: "pu" + Date.now() };
  POKET_USERS.push(saved);
  return { ...saved };
}
export async function saveStablecoinWallet(w: Omit<StablecoinWallet, "id">): Promise<StablecoinWallet> {
  await wait(400);
  const saved = { ...w, id: "sw" + Date.now() };
  STABLECOIN_WALLETS.push(saved);
  return { ...saved };
}
