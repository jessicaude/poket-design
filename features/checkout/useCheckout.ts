import { create } from "zustand";
import { useNairaPartner } from "@/store/partner";
import { useAccount, type Account, type PaymentMethod } from "@/store/account";
import { useDemo, type BankTransferAccount, type MerchantAccepts, type OrderCurrency } from "@/store/demo";
import { useEvents } from "@/store/events";
import { DIRECTORY, registerAccount, createCheckoutVirtualAccount, createPayment, expireCheckoutVirtualAccount, getMerchantPoolAccount, simulateCheckoutTransfer, type CheckoutVirtualAccount } from "@/lib/mock-api";
import { orderUsdCents, type Cents } from "@/lib/money";
import { useAccountLock } from "@/store/lock";
import { firstUsable, isBlockedMethod, isConverting, newQuote, quoteFxRate, quoteLeft, quoteRateText, quoteUsdCents, type Quote } from "./quote";

/**
 * Checkout flow controller. Each `screen` has one component in ./screens.
 * Ported from SCREENS[...] in reference/poket-widgets.html.
 */

/**
 * Bank transfer: getting the account, waiting for the transfer, the transfer arriving, then (CentryOS matches it)
 * paid (the done screen), underpaid or overpaid; a one-time account can also expire.
 */
export type TransferState = "creating" | "waiting" | "arriving" | "expired" | "underpaid" | "overpaid";
/** Demo: how much of the order's amount the transfer carries. */
export type TransferAmount = "exact" | "less" | "more";

/** Demo amounts for "Less arrives" / "More arrives": 10% under or over, in whole naira. */
export const demoTransferAmount = (amount: number, a: TransferAmount) =>
  a === "exact" ? amount : amount + (a === "less" ? -1 : 1) * Math.round(amount / 10 / 100) * 100;
export type Screen = "signup" | "pay" | "add-method" | "add-card" | "bank-transfer" | "details" | "vendor" | "verifying" | "id-review"
  | "id-retry" | "id-done" | "blocked" | "locked" | "processing" | "declined" | "done"
  /** WGT-12: Checkout's Poket account (Activity tab, a payment's detail, a dispute) */
  | "activity" | "pay-detail" | "dispute" | "refund-detail";

/** SCREENS['blocked'] reasons: the prototype's age and id_declined, plus a sanctions match (copy from tSanctionsDeclined). */
export type BlockReason = "age" | "id_declined" | "sanctions";

/** The reference's VF_MAX_TRIES and VF_RETRY_REASONS (wallet engine, reference/poket-widgets.html). */
export const ID_MAX_TRIES = 3;
export const ID_RETRY_REASONS = [
  "The photo is blurry. Retake it in good light.",
  "There was glare on your ID. Avoid direct light.",
  "Part of your ID was cut off. Fit all four corners in the frame.",
];

/** Identity verification state for this checkout (the reference's S.det, S.noSsn, S.vendor, S.vstage). Failed checks
 * are counted on the account (idFailures), not here, so the limit carries across checkouts. */
export type Idv = {
  det: { d: string; m: string; y: string; ssn: string };
  noSsn: boolean;
  vendor: "veriff" | "plaid";
  vstage: "start" | "phone";
  retryReason: string | null;
};
const NEW_IDV: Idv = { det: { d: "", m: "", y: "", ssn: "" }, noSsn: false, vendor: "veriff", vstage: "start", retryReason: null };

/** Where the location check puts a new account (the reference's GEO_COUNTRY), and the details screen's countries. */
export const GEO_COUNTRY = "Nigeria";
export const ID_COUNTRIES = ["United States", "Nigeria", "United Kingdom", "Ghana", "Canada"];

/** Age from a date of birth (the details screen's age()); null until the date is complete. */
export function ageFrom(d: string, m: string, y: string, now = new Date()): number | null {
  const Y = +y, M = +m, D = +d;
  if (!Y || !M || !D || y.length < 4) return null;
  let a = now.getFullYear() - Y;
  if (now.getMonth() + 1 < M || (now.getMonth() + 1 === M && now.getDate() < D)) a--;
  return a;
}
/** A US SSN: 9 digits, not starting 000, 666 or 9. */
export const ssnOk = (v: string) => { const d = v.replace(/\D/g, ""); return d.length === 9 && !/^(000|666|9)/.test(d); };

/** Every Checkout payment under $500 skips the ID check (agreed rule). */
export const NO_ID_LIMIT: Cents = 50000;

/**
 * The merchant and order, plus customer details the merchant shares (prefill sign-up).
 * `amount` is in the order's currency, in minor units (cents or kobo).
 */
export type Order = { merchant: string; orderRef: string; amount: number; currency: OrderCurrency; customer?: { email: string; first: string; last: string } };

/** The merchant's checkout settings, read when the widget opens (demo bar: Merchant accepts, Bank transfer account). */
export type MerchantSettings = { accepts: MerchantAccepts; bankTransferAccount: BankTransferAccount };

type State = {
  open: boolean;
  order: Order | null;
  settings: MerchantSettings | null;
  screen: Screen;
  onboarding: boolean;        // true while a new user signs up: shows the stepper
  selected: string | null;    // selected payment method id
  transfer: { state: TransferState; va: CheckoutVirtualAccount | null; received?: number };
  cardCurrency: OrderCurrency; // the card being added: an NGN card, or a USD card (paid in USD, converted for an NGN order)
  failed: PaymentMethod | null;
  paid: { ref: string; method: PaymentMethod; charged?: { amount: Cents; currency: "USD"; rate: string; fxRate: number } } | null;
  quote: Quote | null;        // USD method on an NGN order (Conversion): the held rate
  charging: Cents | null;     // converted payment in progress: the dollars being charged (processing screen)
  toast: string | null;
  /** WGT-12: the payment open in pay-detail (and its dispute), and where its Back goes (S.viewPay, S.navFrom). */
  viewPay: string | null;
  navFrom: "done" | "activity" | null;
  /** The refund open in refund-detail. */
  viewRefund: string | null;
  skipId: boolean;            // the order is under $500: the stepper shows Account and Payment only
  idv: Idv;
  blockReason: BlockReason | null;

  start: (order: Order) => void;
  close: (reason?: string) => void;
  /** Too many wrong codes: "Account locked" (shared with the wallet's device codes; store/lock.ts). */
  locked: () => void;
  /** The lock ended (or the demo skipped it): back to signing in. */
  unlocked: () => void;
  /** Where an opened widget starts: "Account locked", the returning customer, or sign-up. */
  route: (order: Order, settings: MerchantSettings) => void;
  go: (s: Screen) => void;
  /** "Your Poket": the account's Activity tab. */
  openAccount: () => void;
  /** A payment's detail (pay-detail), from the done screen's View receipt or an Activity row. */
  viewPayment: (id: string, from: "done" | "activity") => void;
  viewRefundDetail: (id: string) => void;
  addCard: (currency: OrderCurrency) => void;
  startTransfer: () => Promise<void>;
  transferArrives: (amount?: TransferAmount) => Promise<void>;
  expireTransfer: () => void;
  showToast: (msg: string) => void;
  signedUp: (a: Account) => void;
  loggedIn: (a: Account) => void;
  select: (id: string) => void;
  refreshQuote: () => void;
  pay: () => Promise<void>;

  // Identity verification (SCREENS details, vendor, verifying, id-done, blocked)
  setIdv: (patch: Partial<Idv>) => void;
  submitDetails: (p: { first: string; last: string; country: string; age: number }) => void;
  openOnPhone: () => void;
  finishOnPhone: () => void;
  approveReview: () => void;
  tryAgain: () => void;
  finishLater: (reason: string) => void;
  verifiedContinue: () => void;
  block: (reason: BlockReason) => void;
};

/**
 * After sign-in: pay, unless the amount needs an ID the person doesn't have yet. Tier 0 rule: under $500 needs no ID
 * check, using the USD value of a naira total (orderUsdCents); $500 or more verifies first (SCREENS['details']).
 */
const needsId = (o: Order) => orderUsdCents(o.amount, o.currency) >= NO_ID_LIMIT;
/** A blocked account (under 18, declined or out of attempts, sanctions) can't pay at any amount: straight to its blocked
 * screen after sign-in, before Pay. A verified (Tier 1) user is never asked again. */
const nextAfterSignIn = (a: Account, o: Order): Screen =>
  idBlockOf(a) ? "blocked" : needsId(o) && a.tier < 1 ? "details" : a.methods.length ? "pay" : "add-method";
const idBlockOf = (a: Account): BlockReason | null => a.idBlocked ?? ((a.idFailures ?? 0) >= ID_MAX_TRIES ? "id_declined" : null);
/** Where sign-in lands, with the block reason when it's the blocked screen. */
const afterSignIn = (a: Account, o: Order) => {
  const screen = nextAfterSignIn(a, o);
  return { screen, blockReason: screen === "blocked" ? idBlockOf(a) : null };
};

let verifyTimer: ReturnType<typeof setTimeout> | null = null;

export const useCheckout = create<State>((set, get) => ({
  open: false, order: null, settings: null, transfer: { state: "creating", va: null }, cardCurrency: "USD", screen: "signup", onboarding: false, selected: null, failed: null, paid: null, quote: null, charging: null, toast: null, viewPay: null, navFrom: null, viewRefund: null,
  skipId: true, idv: NEW_IDV, blockReason: null,

  start: (order) => {
    const { shareDetails, merchantAccepts, bankTransferAccount } = useDemo.getState();
    const settings: MerchantSettings = { accepts: { ...merchantAccepts }, bankTransferAccount };
    useEvents.getState().emit("widget.opened", { widget: "checkout", amount: order.amount, currency: order.currency, customer_details: shareDetails });
    get().route(order, settings);
  },
  locked: () => set({ screen: "locked", onboarding: false }),
  unlocked: () => {
    const { order, settings } = get();
    if (order && settings) get().route(order, settings); // as when the widget opened (no second widget.opened)
  },
  route: (order, settings) => {
    const { customer } = useDemo.getState();
    // A locked account can't sign in or pay until the lock ends
    useAccountLock.getState().sync();
    if (useAccountLock.getState().until) {
      useAccount.getState().signOut();
      set({ open: true, order, settings, quote: null, onboarding: false, screen: "locked", selected: null, failed: null, paid: null,
        skipId: !needsId(order), idv: NEW_IDV, blockReason: null });
      return;
    }
    if (customer === "returning") {
      const a = structuredClone(DIRECTORY["ada@osun.co"]);
      useAccount.getState().signIn(a);
      set({ open: true, order, settings, quote: null, onboarding: false, ...afterSignIn(a, order), selected: firstUsable(a.methods, order, settings), failed: null, paid: null,
        skipId: !needsId(order), idv: NEW_IDV });
      return;
    }
    useAccount.getState().signOut();
    set({ open: true, order, settings, quote: null, onboarding: true, screen: "signup", selected: null, failed: null, paid: null,
      skipId: !needsId(order), idv: NEW_IDV, blockReason: null });
  },
  close: (reason = "closed") => {
    if (verifyTimer) { clearTimeout(verifyTimer); verifyTimer = null; }
    useEvents.getState().emit("widget.closed", { widget: "checkout", reason });
    set({ open: false });
  },
  go: (screen) => set({ screen }),
  openAccount: () => set({ screen: "activity", onboarding: false }),
  viewPayment: (id, from) => set({ viewPay: id, navFrom: from, screen: "pay-detail", onboarding: false }),
  viewRefundDetail: (id) => set({ viewRefund: id, screen: "refund-detail", onboarding: false }),
  addCard: (cardCurrency) => set({ cardCurrency, screen: "add-card" }),

  // Bank transfer: "Dynamic" creates a one-time virtual account ("Get a new account" calls this again); "Merchant pool"
  // shows the merchant's pool account. Both for the exact naira amount.
  startTransfer: async () => {
    const { order, settings } = get();
    const account = useAccount.getState().account;
    if (!order || (account && idBlockOf(account))) return; // a blocked account can't pay
    if (useNairaPartner.getState().down) return; // WGT-13: no naira bank transfers while the naira partner is down
    set({ screen: "bank-transfer", transfer: { state: "creating", va: null } });
    const p = { amount: order.amount, merchant: order.merchant, orderRef: order.orderRef };
    const va = settings?.bankTransferAccount === "pool" ? await getMerchantPoolAccount(p) : await createCheckoutVirtualAccount(p);
    if (get().screen === "bank-transfer") set({ transfer: { state: "waiting", va } });
  },
  transferArrives: async (amount = "exact") => {
    const { order, transfer } = get();
    const va = transfer.va;
    if (!order || !va || transfer.state !== "waiting") return;
    set({ transfer: { ...transfer, state: "arriving" } });
    // CentryOS matches the transfer to the order, for either account (a late one-time transfer is refused: expired)
    let match;
    try { match = await simulateCheckoutTransfer(va.id, demoTransferAmount(order.amount, amount)); }
    catch { set({ transfer: { ...transfer, state: "expired" } }); return; }
    if (match.status !== "paid") {
      // Short or over: the merchant hears about it; what happens next is [handling]
      useEvents.getState().emit("payment.amount_mismatch", { widget: "checkout", order_reference: order.orderRef, currency: order.currency,
        expected_amount: order.amount, received_amount: match.received, rail: "ngn_bank_transfer", account_type: va.kind });
      set({ transfer: { ...transfer, state: match.status, received: match.received } });
      return;
    }
    const id = match.id;
    const m: PaymentMethod = { id: va.id, kind: "bank", last4: va.num.slice(-4), name: "Bank transfer", sub: `Account •••• ${va.num.slice(-4)}`, oneTime: true };
    useAccount.getState().update((a) => ({ ...a,
      payments: [{ id, merchant: order.merchant, amount: order.amount, currency: order.currency, method: m.name, at: new Date().toISOString(), status: "paid",
        order: order.orderRef, methodKind: m.kind, brand: m.brand }, ...a.payments] }));
    useEvents.getState().emit("payment.succeeded", { widget: "checkout", amount: order.amount, currency: order.currency, poket_reference: id, method: "bank_transfer",
      rail: "ngn_bank_transfer", account_type: va.kind, identity_verified: (useAccount.getState().account?.tier ?? 0) >= 1 });
    set({ paid: { ref: id, method: m }, screen: "done", transfer: { state: "creating", va: null } });
  },
  expireTransfer: () => {
    const { transfer } = get();
    if (transfer.va) expireCheckoutVirtualAccount(transfer.va.id);
    set({ transfer: { ...transfer, state: "expired" } });
  },
  showToast: (msg) => { set({ toast: msg }); setTimeout(() => set({ toast: null }), 2400); },

  signedUp: (a) => {
    const account = { country: GEO_COUNTRY, ...a };
    registerAccount(account); // the same email logs in next time
    useAccount.getState().signIn(account);
    useEvents.getState().emit("user.account_created", { widget: "checkout" });
    set(afterSignIn(account, get().order!));
  },
  // A returning person: verified, they pay; still Tier 0 on an order that needs an ID, they verify (with the stepper,
  // as the reference's afterSignIn does); blocked before, the blocked screen
  loggedIn: (a) => {
    useAccount.getState().signIn(a);
    const next = afterSignIn(a, get().order!);
    set({ ...next, onboarding: next.screen === "details", selected: firstUsable(a.methods, get().order, get().settings) });
  },
  select: (id) => {
    const m = useAccount.getState().account?.methods.find((x) => x.id === id);
    if (isBlockedMethod(get().order, get().settings, m)) return; // naira only: dollar methods can't be selected
    set({ selected: id });
  },
  refreshQuote: () => set({ quote: newQuote(false) }),

  pay: async () => {
    const { order, selected } = get();
    const account = useAccount.getState().account;
    const m = account?.methods.find((x) => x.id === selected);
    if (!order || !account || !m || isBlockedMethod(order, get().settings, m) || idBlockOf(account)) return; // a blocked account can't pay
    // Converting: pay only on a rate that's still held; the debit is the quote's dollar amount
    const q = get().quote;
    const converting = isConverting(order, get().settings, m);
    if (converting && (!q || quoteLeft(q) <= 0)) return;
    const charged = converting && q ? { amount: quoteUsdCents(order.amount, q), currency: "USD" as const, rate: quoteRateText(q), fxRate: quoteFxRate(q) } : undefined;
    set({ screen: "processing", charging: charged?.amount ?? null });
    try {
      const { id } = await createPayment(m, useDemo.getState().cardOutcome);
      useAccount.getState().update((a) => ({
        ...a,
        methods: a.methods.filter((x) => !x.oneTime || x.id === m.id),
        payments: [{ id, merchant: order.merchant, amount: order.amount, currency: order.currency, method: m.name, at: new Date().toISOString(), status: "paid",
          order: order.orderRef, methodKind: m.kind, brand: m.brand,
          ...(charged ? { charged: { amount: charged.amount, currency: charged.currency } } : {}) }, ...a.payments],
      }));
      useEvents.getState().emit("payment.succeeded", { widget: "checkout", amount: order.amount, currency: order.currency, poket_reference: id, method: m.kind, identity_verified: account.tier >= 1,
        ...(m.currency === "NGN" ? { rail: "ngn_card" } : {}),
        ...(charged ? { charged_amount: charged.amount, charged_currency: charged.currency, fx_rate: charged.fxRate } : {}) });
      set({ paid: { ref: id, method: m, charged }, screen: "done", quote: null, charging: null });
    } catch {
      useEvents.getState().emit("payment.failed", { widget: "checkout", amount: order.amount, currency: order.currency, reason: "card_declined" });
      set({ failed: m, screen: "declined", quote: null, charging: null });
    }
  },

  setIdv: (patch) => set((st) => ({ idv: { ...st.idv, ...patch } })),
  // dGo: save the name and country; under 18 is blocked; US residents (with an SSN) go to Plaid, others to Veriff
  submitDetails: ({ first, last, country, age }) => {
    useAccount.getState().update((a) => ({ ...a, first, last, country }));
    if (age < 18 || useDemo.getState().idOutcome === "under18") { get().block("age"); return; }
    const us = country === "United States" && !get().idv.noSsn;
    set((st) => ({ idv: { ...st.idv, vendor: us ? "plaid" : "veriff", vstage: "start" }, screen: "vendor" }));
  },
  // The vendor screen's demo actions: "Open on phone", then "Finish on phone" (verifying, then the result after 1.4s)
  openOnPhone: () => set((st) => ({ idv: { ...st.idv, vstage: "phone" } })),
  finishOnPhone: () => {
    set({ screen: "verifying" });
    if (verifyTimer) clearTimeout(verifyTimer);
    verifyTimer = setTimeout(() => { verifyTimer = null; idResult(); }, 1400);
  },
  approveReview: () => { if (get().screen === "id-review") verified(); },
  tryAgain: () => set((st) => ({ idv: { ...st.idv, vstage: "start", retryReason: null }, screen: "vendor" })),
  finishLater: (reason) => get().close(reason),
  // id-done's Continue: the widget's start(), back to Pay (or add a method first)
  verifiedContinue: () => {
    const a = useAccount.getState().account;
    if (!a) return;
    set({ selected: firstUsable(a.methods, get().order, get().settings), screen: a.methods.length ? "pay" : "add-method" });
  },
  block: (reason) => {
    useAccount.getState().update((a) => ({ ...a, idBlocked: reason })); // kept on the account: never offered again
    useEvents.getState().emit("user.blocked", { widget: "checkout", reason });
    set({ blockReason: reason, screen: "blocked" });
  },
}));

/** Tier 1: the reference's idResult() success path. */
function verified() {
  useAccount.getState().update((a) => ({ ...a, tier: 1 }));
  useEvents.getState().emit("user.verified", { widget: "checkout", tier: 1 });
  useCheckout.setState({ screen: "id-done" });
}

/** idResult(): the demo bar's ID check outcome decides what happens after "Checking your ID". */
function idResult() {
  const st = useCheckout.getState();
  if (st.screen !== "verifying") return;
  const outcome = useDemo.getState().idOutcome;
  if (outcome === "declined") { st.block("id_declined"); return; }
  if (outcome === "sanctions") { st.block("sanctions"); return; }
  if (outcome === "review") { useCheckout.setState({ screen: "id-review" }); return; }
  if (outcome === "retry") {
    // Veriff's shared limit: every failed check counts, on the account, across checkouts; the 3rd is a decline
    const failures = (useAccount.getState().account?.idFailures ?? 0) + 1;
    useAccount.getState().update((a) => ({ ...a, idFailures: failures }));
    if (failures >= ID_MAX_TRIES) { st.block("id_declined"); return; }
    useCheckout.setState({ idv: { ...st.idv, retryReason: ID_RETRY_REASONS[(failures - 1) % ID_RETRY_REASONS.length] }, screen: "id-retry" });
    return;
  }
  verified(); // pass (under 18 is caught on the details screen)
}
