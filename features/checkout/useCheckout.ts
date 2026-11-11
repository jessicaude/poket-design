import { create } from "zustand";
import { useAccount, type Account, type PaymentMethod } from "@/store/account";
import { useDemo, type BankTransferAccount, type MerchantAccepts, type OrderCurrency } from "@/store/demo";
import { useEvents } from "@/store/events";
import { DIRECTORY, createPayment } from "@/lib/mock-api";
import { orderUsdCents, type Cents } from "@/lib/money";

/**
 * Checkout flow controller. Each `screen` has one component in ./screens.
 * Ported from SCREENS[...] in reference/poket-widgets.html.
 */
export type Screen = "signup" | "pay" | "add-method" | "add-card" | "id-needed" | "processing" | "declined" | "done";

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
  failed: PaymentMethod | null;
  paid: { ref: string; method: PaymentMethod } | null;
  toast: string | null;

  start: (order: Order) => void;
  close: (reason?: string) => void;
  go: (s: Screen) => void;
  showToast: (msg: string) => void;
  signedUp: (a: Account) => void;
  loggedIn: (a: Account) => void;
  select: (id: string) => void;
  pay: () => Promise<void>;
};

/** After sign-in: pay, unless the amount needs an ID the person doesn't have yet. */
const nextAfterSignIn = (a: Account, o: Order): Screen => (orderUsdCents(o.amount, o.currency) >= NO_ID_LIMIT && a.tier < 1 ? "id-needed" : a.methods.length ? "pay" : "add-method");

export const useCheckout = create<State>((set, get) => ({
  open: false, order: null, settings: null, screen: "signup", onboarding: false, selected: null, failed: null, paid: null, toast: null,

  start: (order) => {
    const { customer, shareDetails, merchantAccepts, bankTransferAccount } = useDemo.getState();
    const settings: MerchantSettings = { accepts: { ...merchantAccepts }, bankTransferAccount };
    useEvents.getState().emit("widget.opened", { widget: "checkout", amount: order.amount, currency: order.currency, customer_details: shareDetails });
    if (customer === "returning") {
      const a = structuredClone(DIRECTORY["ada@osun.co"]);
      useAccount.getState().signIn(a);
      set({ open: true, order, settings, onboarding: false, screen: nextAfterSignIn(a, order), selected: a.methods[0]?.id ?? null, failed: null, paid: null });
      return;
    }
    useAccount.getState().signOut();
    set({ open: true, order, settings, onboarding: true, screen: "signup", selected: null, failed: null, paid: null });
  },
  close: (reason = "closed") => {
    useEvents.getState().emit("widget.closed", { widget: "checkout", reason });
    set({ open: false });
  },
  go: (screen) => set({ screen }),
  showToast: (msg) => { set({ toast: msg }); setTimeout(() => set({ toast: null }), 2400); },

  signedUp: (a) => {
    useAccount.getState().signIn(a);
    useEvents.getState().emit("user.account_created", { widget: "checkout" });
    set({ screen: nextAfterSignIn(a, get().order!) });
  },
  loggedIn: (a) => {
    useAccount.getState().signIn(a);
    set({ onboarding: false, selected: a.methods[0]?.id ?? null, screen: nextAfterSignIn(a, get().order!) });
  },
  select: (id) => set({ selected: id }),

  pay: async () => {
    const { order, selected } = get();
    const account = useAccount.getState().account;
    const m = account?.methods.find((x) => x.id === selected);
    if (!order || !account || !m) return;
    set({ screen: "processing" });
    try {
      const { id } = await createPayment(m, useDemo.getState().cardOutcome);
      useAccount.getState().update((a) => ({
        ...a,
        methods: a.methods.filter((x) => !x.oneTime || x.id === m.id),
        payments: [{ id, merchant: order.merchant, amount: order.amount, currency: order.currency, method: m.name, at: new Date().toISOString(), status: "paid" }, ...a.payments],
      }));
      useEvents.getState().emit("payment.succeeded", { widget: "checkout", amount: order.amount, currency: order.currency, poket_reference: id, method: m.kind, identity_verified: account.tier >= 1 });
      set({ paid: { ref: id, method: m }, screen: "done" });
    } catch {
      useEvents.getState().emit("payment.failed", { widget: "checkout", amount: order.amount, currency: order.currency, reason: "card_declined" });
      set({ failed: m, screen: "declined" });
    }
  },
}));
