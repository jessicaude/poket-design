import { create } from "zustand";
import { useAccount, type Account, type PaymentMethod } from "@/store/account";
import { useDemo, type BankTransferAccount, type MerchantAccepts, type OrderCurrency } from "@/store/demo";
import { useEvents } from "@/store/events";
import { DIRECTORY, createCheckoutVirtualAccount, createPayment, expireCheckoutVirtualAccount, getMerchantPoolAccount, simulateCheckoutTransfer, simulatePoolTransfer, type CheckoutVirtualAccount } from "@/lib/mock-api";
import { orderUsdCents, type Cents } from "@/lib/money";
import { firstUsable, isBlockedMethod, isConverting, newQuote, quoteFxRate, quoteLeft, quoteRateText, quoteUsdCents, type Quote } from "./quote";

/**
 * Checkout flow controller. Each `screen` has one component in ./screens.
 * Ported from SCREENS[...] in reference/poket-widgets.html.
 */
export type Screen = "signup" | "pay" | "add-method" | "add-card" | "bank-transfer" | "id-needed" | "processing" | "declined" | "done";

/**
 * Bank transfer: getting the account, waiting for the transfer, the transfer arriving, then (one-time account) expired,
 * or (merchant pool, matched by CentryOS) underpaid or overpaid. A matched exact amount goes to the done screen.
 */
export type TransferState = "creating" | "waiting" | "arriving" | "expired" | "underpaid" | "overpaid";
/** Demo: how much of the order's amount the transfer carries. */
export type TransferAmount = "exact" | "less" | "more";

/** Demo amounts for "Less arrives" / "More arrives": 10% under or over, in whole naira. */
export const demoTransferAmount = (amount: number, a: TransferAmount) =>
  a === "exact" ? amount : amount + (a === "less" ? -1 : 1) * Math.round(amount / 10 / 100) * 100;

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
  toast: string | null;

  start: (order: Order) => void;
  close: (reason?: string) => void;
  go: (s: Screen) => void;
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
};

/** After sign-in: pay, unless the amount needs an ID the person doesn't have yet. */
const nextAfterSignIn = (a: Account, o: Order): Screen => (orderUsdCents(o.amount, o.currency) >= NO_ID_LIMIT && a.tier < 1 ? "id-needed" : a.methods.length ? "pay" : "add-method");

export const useCheckout = create<State>((set, get) => ({
  open: false, order: null, settings: null, transfer: { state: "creating", va: null }, cardCurrency: "USD", screen: "signup", onboarding: false, selected: null, failed: null, paid: null, quote: null, toast: null,

  start: (order) => {
    const { customer, shareDetails, merchantAccepts, bankTransferAccount } = useDemo.getState();
    const settings: MerchantSettings = { accepts: { ...merchantAccepts }, bankTransferAccount };
    useEvents.getState().emit("widget.opened", { widget: "checkout", amount: order.amount, currency: order.currency, customer_details: shareDetails });
    if (customer === "returning") {
      const a = structuredClone(DIRECTORY["ada@osun.co"]);
      useAccount.getState().signIn(a);
      set({ open: true, order, settings, quote: null, onboarding: false, screen: nextAfterSignIn(a, order), selected: firstUsable(a.methods, order, settings), failed: null, paid: null });
      return;
    }
    useAccount.getState().signOut();
    set({ open: true, order, settings, quote: null, onboarding: true, screen: "signup", selected: null, failed: null, paid: null });
  },
  close: (reason = "closed") => {
    useEvents.getState().emit("widget.closed", { widget: "checkout", reason });
    set({ open: false });
  },
  go: (screen) => set({ screen }),
  addCard: (cardCurrency) => set({ cardCurrency, screen: "add-card" }),

  // Bank transfer: "Dynamic" creates a one-time virtual account ("Get a new account" calls this again); "Merchant pool"
  // shows the merchant's pool account. Both for the exact naira amount.
  startTransfer: async () => {
    const { order, settings } = get();
    if (!order) return;
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
    let id: string;
    if (va.kind === "pool") {
      const match = await simulatePoolTransfer(va.id, demoTransferAmount(order.amount, amount));
      if (match.status !== "paid") {
        // Short or over: the merchant hears about it; what happens next is [handling]
        useEvents.getState().emit("payment.amount_mismatch", { widget: "checkout", order_reference: order.orderRef, currency: order.currency,
          expected_amount: order.amount, received_amount: match.received });
        set({ transfer: { ...transfer, state: match.status, received: match.received } });
        return;
      }
      id = match.id;
    } else {
      try { ({ id } = await simulateCheckoutTransfer(va.id)); } catch { set({ transfer: { ...transfer, state: "expired" } }); return; }
    }
    const m: PaymentMethod = { id: va.id, kind: "bank", last4: va.num.slice(-4), name: "Bank transfer", sub: `Account •••• ${va.num.slice(-4)}`, oneTime: true };
    useAccount.getState().update((a) => ({ ...a,
      payments: [{ id, merchant: order.merchant, amount: order.amount, currency: order.currency, method: m.name, at: new Date().toISOString(), status: "paid" }, ...a.payments] }));
    useEvents.getState().emit("payment.succeeded", { widget: "checkout", amount: order.amount, currency: order.currency, poket_reference: id, method: "bank_transfer", identity_verified: (useAccount.getState().account?.tier ?? 0) >= 1 });
    set({ paid: { ref: id, method: m }, screen: "done", transfer: { state: "creating", va: null } });
  },
  expireTransfer: () => {
    const { transfer } = get();
    if (transfer.va) expireCheckoutVirtualAccount(transfer.va.id);
    set({ transfer: { ...transfer, state: "expired" } });
  },
  showToast: (msg) => { set({ toast: msg }); setTimeout(() => set({ toast: null }), 2400); },

  signedUp: (a) => {
    useAccount.getState().signIn(a);
    useEvents.getState().emit("user.account_created", { widget: "checkout" });
    set({ screen: nextAfterSignIn(a, get().order!) });
  },
  loggedIn: (a) => {
    useAccount.getState().signIn(a);
    set({ onboarding: false, selected: firstUsable(a.methods, get().order, get().settings), screen: nextAfterSignIn(a, get().order!) });
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
    if (!order || !account || !m || isBlockedMethod(order, get().settings, m)) return;
    // Converting: pay only on a rate that's still held; the debit is the quote's dollar amount
    const q = get().quote;
    const converting = isConverting(order, get().settings, m);
    if (converting && (!q || quoteLeft(q) <= 0)) return;
    const charged = converting && q ? { amount: quoteUsdCents(order.amount, q), currency: "USD" as const, rate: quoteRateText(q), fxRate: quoteFxRate(q) } : undefined;
    set({ screen: "processing" });
    try {
      const { id } = await createPayment(m, useDemo.getState().cardOutcome);
      useAccount.getState().update((a) => ({
        ...a,
        methods: a.methods.filter((x) => !x.oneTime || x.id === m.id),
        payments: [{ id, merchant: order.merchant, amount: order.amount, currency: order.currency, method: m.name, at: new Date().toISOString(), status: "paid",
          ...(charged ? { charged: { amount: charged.amount, currency: charged.currency } } : {}) }, ...a.payments],
      }));
      useEvents.getState().emit("payment.succeeded", { widget: "checkout", amount: order.amount, currency: order.currency, poket_reference: id, method: m.kind, identity_verified: account.tier >= 1,
        ...(charged ? { charged_amount: charged.amount, charged_currency: charged.currency, fx_rate: charged.fxRate } : {}) });
      set({ paid: { ref: id, method: m, charged }, screen: "done", quote: null });
    } catch {
      useEvents.getState().emit("payment.failed", { widget: "checkout", amount: order.amount, currency: order.currency, reason: "card_declined" });
      set({ failed: m, screen: "declined", quote: null });
    }
  },
}));
