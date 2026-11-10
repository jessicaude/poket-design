import { create } from "zustand";
import {
  createPayout, hasPin, listPayoutRecipients, nameEnquiry, releaseReservation, reservePayout, resetPayoutServer, resetPinAttempts, savePayoutRecipient, seedPayoutServer,
  setNameEnquiryAvailable, setPin, verifyPin, verifyPinResetCode,
  type BalanceSource, type NgBank, type PayoutCurrency, type PayoutRecipient, type WithdrawalStatus,
} from "@/lib/mock-api";
import { useWithdrawals } from "./useWithdrawals";
import { useSend } from "../send/useSend";
import { holderName, useNgn } from "../ngn/useNgn";
import { holderMatches, maxPayout, methodReady, needsStepUp, payoutFee, payoutMethodSub, type Draft, type Speed } from "./payoutMath";

/**
 * Payout flow controller, rendered by PayoutBody inside WalletShell's #panelBody.
 * Ported from tPayout and its bindings (wallet engine) in reference/poket-unified.html, with the checkout's PIN steps
 * (tPin, pinComplete, tPinLocked, tPinResetOtp, tMoneyDone) in place of the wallet's passcode 'authorize' stage.
 * Stage names are the reference's: S.payoutStage values, then the checkout's wScreen names for the PIN screens.
 * Not in the reference: ngn-account and ngn-bank (an NGN bank account with name enquiry, replacing the add-recipient
 * forms for NGN), unavailable (a merchant-held balance can't be sent to a bank), and stepup (the reference's
 * tStepupIntro, shown before the PIN for amounts over ₦[step-up]).
 */
export const PAYOUT_STAGES = [
  "recipient", "add-recipient", "add-recipient-details", "add-recipient-method", "amount", "review",
  "pin", "pinLocked", "pinResetOtp", "moneyDone",
  "processing", "done",
  "ngn-account", "ngn-bank", "unavailable", "stepup",
] as const;
export type PayoutStage = (typeof PAYOUT_STAGES)[number];
export const isPayoutStage = (s: unknown): s is PayoutStage => PAYOUT_STAGES.includes(s as PayoutStage);
/** S.pinStage. */
export type PinStage = "create" | "confirm" | "entry";

/**
 * Name enquiry on ngn-account. matched: the account is in the verified user's name. other: someone else's name,
 * which needs confirming as a third-party payee. unavailable: the lookup service is down.
 */
export type Enquiry =
  | { status: "idle" } | { status: "resolving" } | { status: "not_found" } | { status: "unavailable" }
  | { status: "matched"; name: string } | { status: "other"; name: string };
/** ngn-account's fields. */
export type NgnAccountDraft = { bank: NgBank | null; number: string; enquiry: Enquiry; thirdPartyOk: boolean; /** "Save recipient" (from Send). */ save: boolean };
const EMPTY_ACCOUNT: NgnAccountDraft = { bank: null, number: "", enquiry: { status: "idle" }, thirdPartyOk: false, save: true };

/** Same person: case, spacing and word order don't matter ("OSUN ADA" is "Ada Osun"). */
export const sameName = (a: string, b: string) => {
  const key = (n: string) => n.toLowerCase().split(/[\s,.-]+/).filter(Boolean).sort().join(" ");
  return key(a) === key(b);
};

/** The PIN the demo bar sets ("PIN: Set"). */
export const DEMO_PIN = "1234";

/** Largest amount the keypad takes: 100,000,000 minor units (₦1,000,000.00). */
const KEYPAD_MAX = 100000000;

type State = {
  stage: PayoutStage | null;
  currency: PayoutCurrency;
  /** Your linked methods and saved recipients (S.linkedBanks + cash S.recipients). */
  recipients: PayoutRecipient[];
  recipient: PayoutRecipient | null;
  cents: number;
  speed: Speed;
  draft: Draft;
  /** add-recipient: linking your own method (true) or adding someone else (add-recipient-details first). */
  addingSelf: boolean;
  ack: boolean;
  lastRef: string | null;
  /** The payout just made: its withdrawal id, amount, fee and status (scheduled for a first payment, else sending). */
  sent: { id: string; amount: number; fee: number; status: WithdrawalStatus } | null;
  pinStage: PinStage;
  /** "reset" after Reset PIN with passcode (S.pinPurpose). */
  pinPurpose: "payout" | "reset";
  pinDraft: string | null;
  pinError: string;
  otpError: string;
  /** Whether a PIN exists (mirrors the server, for the demo bar). */
  pinSet: boolean;
  /** Which part of the balance is being withdrawn. */
  source: BalanceSource;
  account: NgnAccountDraft;
  /** Name enquiry is down (demo bar). */
  enquiryDown: boolean;
  /** Opened from Send: Back and "Change" return to Send's recipients, and a new bank account goes on to the amount. */
  fromSend: boolean;

  /** Send: a saved Nigerian bank account, straight to the amount. */
  sendTo: (r: PayoutRecipient) => void;
  /** Send's "+ New recipient" → Bank account: the bank-account step, then the amount. */
  sendToNewBank: () => void;
  /** The amount screen's "Change": back to the recipients (Send's, when opened from Send). */
  changeRecipient: () => void;
  /** A merchant-held balance opens on "unavailable" instead. */
  open: (currency?: PayoutCurrency, source?: BalanceSource) => void;
  close: () => void;
  go: (stage: PayoutStage) => void;
  back: () => void;

  selectRecipient: (r: PayoutRecipient) => void;
  startAdd: (self: boolean) => void;
  editDraft: (patch: Draft) => void;
  saveDraft: () => Promise<void>;
  key: (k: string) => void;
  max: () => void;
  setAck: (ack: boolean) => void;
  /** confirmPayout: on to the PIN (create it the first time). */
  confirm: () => void;
  /** On to the PIN (after review, or Continue on the step-up placeholder). */
  toPin: () => void;
  pinComplete: (pin: string) => Promise<void>;
  startPinReset: () => void;
  pinResetCode: (code: string) => Promise<void>;

  setAccountBank: (bank: NgBank) => void;
  setAccountNumber: (text: string) => void;
  /** Run the name enquiry for the current bank and number (also "Try again"). */
  lookUpName: () => Promise<void>;
  setThirdPartyOk: (ok: boolean) => void;
  setAccountSave: (save: boolean) => void;
  saveNgnAccount: () => Promise<void>;
  setEnquiryDown: (down: boolean) => void;

  /** Demo controls. */
  seedPin: (pin: string | null) => void;
  reset: () => void;
};

const TRANSIENT = {
  stage: null, recipient: null, cents: 0, speed: "standard" as Speed, draft: {}, addingSelf: false, ack: false, lastRef: null, sent: null,
  pinStage: "create" as PinStage, pinPurpose: "payout" as const, pinDraft: null, pinError: "", otpError: "",
  source: "open" as BalanceSource, account: EMPTY_ACCOUNT, fromSend: false,
};

/** Balance of the payout currency. Only NGN is wired to a balance (useNgn.ngnBalance) in this design repo. */
export const availableFor = (cur: PayoutCurrency) => (cur === "NGN" ? useNgn.getState().ngnBalance : 0);

export const usePayout = create<State>((set, get) => {
  /** Increments per enquiry, so a slow answer for an older bank/number is ignored. */
  let enquiryId = 0;

  /** Move NGN between the available balance and the reserved total (positive: reserve; negative: give back or settle). */
  const moveReserved = (toReserved: number, fromBalance: number) =>
    useNgn.setState((s) => ({ ngnBalance: s.ngnBalance - fromBalance, ngnReserved: s.ngnReserved + toReserved }));

  /**
   * executeWithdraw, called once the PIN is accepted: reserve the amount from the balance, then create the payout.
   * The withdrawal starts Scheduled (first payment to an account) or Sending; its reservation is cleared when it's
   * paid and released when it fails (useWithdrawals). If the payout can't be created, the reservation is released.
   */
  const execute = async () => {
    const { currency, recipient: r, cents, speed, source } = get();
    if (!r) return;
    const fee = payoutFee(currency, r, speed, cents);
    const total = cents + fee;
    const isNgn = currency === "NGN";
    set({ stage: "processing" });
    const rsv = await reservePayout({ currency, amount: total, source });
    if (isNgn) moveReserved(total, total);
    try {
      // The reservation stays until the withdrawal is paid (cleared) or fails (released): see useWithdrawals.
      const w = await createPayout({ currency, amount: cents, fee, recipientId: r.id, reservationId: rsv.id, recipientSub: payoutMethodSub(r) });
      useWithdrawals.getState().refresh();
      set({ stage: "done", lastRef: w.ref, sent: { id: w.id, amount: cents, fee, status: w.status }, recipients: listPayoutRecipients() });
    } catch {
      await releaseReservation(rsv.id);
      if (isNgn) moveReserved(-total, -total);
      set({ stage: "review" });
    }
  };

  return {
    ...TRANSIENT,
    currency: "NGN",
    recipients: listPayoutRecipients(),
    pinSet: hasPin(),
    enquiryDown: false,

    /** detailPayout: a cash balance's Payout goes straight to the recipient stage in that currency. */
    open: (currency = "NGN", source = "open") =>
      set({ ...TRANSIENT, currency, source, recipients: listPayoutRecipients(), stage: source === "merchant" ? "unavailable" : "recipient" }),
    close: () => set({ ...TRANSIENT }),
    go: (stage) => set({ stage }),

    sendTo: (r) => set({
      ...TRANSIENT, currency: "NGN", recipients: listPayoutRecipients(), recipient: r, fromSend: true, stage: "amount",
      ...(r.isSelf ? { speed: r.methodType === "card" ? "instant" as Speed : "standard" as Speed } : {}),
    }),
    sendToNewBank: () => set({ ...TRANSIENT, currency: "NGN", recipients: listPayoutRecipients(), fromSend: true, account: EMPTY_ACCOUNT, stage: "ngn-account" }),
    changeRecipient: () => {
      if (!get().fromSend) return set({ stage: "recipient" });
      get().close();
      useSend.getState().open();
    },

    back: () => {
      const { stage, fromSend } = get();
      // From Send, the first step's Back returns to Send (its recipients, or "New recipient").
      if (fromSend && (stage === "amount" || stage === "ngn-account")) {
        get().close();
        useSend.getState().open();
        if (stage === "ngn-account") useSend.setState({ stage: "bankCurrency" });
        return;
      }
      const prev: Partial<Record<PayoutStage, PayoutStage | null>> = {
        // The reference goes back to its currency picker, which this flow skips (it opens from the NGN balance).
        recipient: null,
        "add-recipient": "recipient", "add-recipient-details": "recipient", "add-recipient-method": "add-recipient-details",
        amount: "recipient", review: "amount", pin: "review", stepup: "review",
        "ngn-account": "recipient", "ngn-bank": "ngn-account", unavailable: null,
      };
      if (!stage || !(stage in prev)) return;
      const to = prev[stage]!;
      if (to === null) return get().close();
      set({ stage: to, pinDraft: null, pinError: "" });
    },

    selectRecipient: (r) => set({ recipient: r, ...(r.isSelf ? { speed: r.methodType === "card" ? "instant" : "standard" } : {}) }),
    // NGN bank accounts go through name enquiry, which decides whether it's yours or a third party's.
    startAdd: (self) => get().currency === "NGN"
      ? set({ account: EMPTY_ACCOUNT, addingSelf: self, stage: "ngn-account" })
      : set({ draft: { currency: get().currency, methodType: "bank" }, addingSelf: self, stage: self ? "add-recipient" : "add-recipient-details" }),
    editDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

    /** savePayoutRecipientBtn / saveOtherPayoutMethodBtn. Saves, selects it and returns to the list. */
    saveDraft: async () => {
      const { draft: d, addingSelf } = get();
      if (!methodReady(d) || !d.name) return;
      const base = { isSelf: addingSelf, name: d.name, holderName: addingSelf ? d.holderName : undefined, currency: d.currency ?? get().currency, methodType: d.methodType ?? "bank" } as const;
      const r: Omit<PayoutRecipient, "id"> =
        base.methodType === "card" ? { ...base, bankName: "Debit card", accountNumber: "•••• " + (d.cardNumber || "").replace(/\D/g, "").slice(-4), cardNumber: d.cardNumber, address: d.address, city: d.city, state: d.state, zip: d.zip, country: d.country }
        : base.methodType === "zelle" ? { ...base, zelleContact: d.zelleContact }
        : base.methodType === "cashapp" ? { ...base, cashtag: d.cashtag }
        : { ...base, bankName: d.bankName, accountNumber: d.accountNumber, routingNumber: d.routingNumber || "", railType: d.railType, address: d.address, city: d.city, state: d.state, zip: d.zip, country: d.country };
      const saved = await savePayoutRecipient(r);
      set((s) => ({
        recipients: [...s.recipients, saved], recipient: saved, stage: "recipient",
        ...(addingSelf ? { speed: saved.methodType === "bank" ? "standard" : "instant" } : {}),
      }));
    },

    /** data-payoutkey: digits shift in from the right; back drops the last one. */
    key: (k) => set((s) => {
      if (k === "back") return { cents: Math.floor(s.cents / 10) };
      if (s.cents >= KEYPAD_MAX) return {};
      return { cents: s.cents * 10 + Number(k) };
    }),
    max: () => {
      const { currency, recipient, speed } = get();
      set({ cents: maxPayout(currency, recipient, speed, availableFor(currency)) });
    },
    setAck: (ack) => set({ ack }),

    confirm: () => {
      if (!get().ack) return;
      if (get().stage === "review" && needsStepUp(get().currency, get().cents)) return set({ stage: "stepup" });
      get().toPin();
    },
    toPin: () => {
      resetPinAttempts(); // wdGo: S.pinAttempts = 0
      set({ stage: "pin", pinStage: hasPin() ? "entry" : "create", pinPurpose: "payout", pinDraft: null, pinError: "" });
    },

    pinComplete: async (pin) => {
      const { pinStage, pinDraft, pinPurpose } = get();
      if (pinStage === "create") return set({ pinDraft: pin, pinStage: "confirm", pinError: "" });
      if (pinStage === "confirm") {
        if (pin !== pinDraft) return set({ pinStage: "create", pinDraft: null, pinError: "PINs did not match. Start over." });
        await setPin(pin);
        set({ pinDraft: null, pinError: "", pinSet: true });
        if (pinPurpose === "reset") return set({ stage: "moneyDone" });
        return execute();
      }
      const res = await verifyPin(pin);
      if (res.ok) { set({ pinError: "" }); return execute(); }
      if (res.locked) return set({ stage: "pinLocked", pinError: "" });
      set({ pinError: `Incorrect PIN. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? "" : "s"} left.` });
    },

    startPinReset: () => set({ stage: "pinResetOtp", otpError: "" }),
    pinResetCode: async (code) => {
      await verifyPinResetCode(code);
      set({ pinSet: false, stage: "pin", pinPurpose: "reset", pinStage: "create", pinDraft: null, pinError: "", otpError: "" });
    },

    setAccountBank: (bank) => {
      enquiryId++;
      set((s) => ({ account: { ...s.account, bank, enquiry: { status: "idle" }, thirdPartyOk: false }, stage: "ngn-account" }));
      void get().lookUpName();
    },
    setAccountNumber: (text) => {
      const number = text.replace(/\D/g, "").slice(0, 10);
      if (number === get().account.number) return;
      enquiryId++;
      set((s) => ({ account: { ...s.account, number, enquiry: { status: "idle" }, thirdPartyOk: false } }));
      void get().lookUpName();
    },
    lookUpName: async () => {
      const { bank, number } = get().account;
      if (!bank || number.length !== 10) return;
      const id = ++enquiryId;
      const patch = (enquiry: Enquiry) => { if (id === enquiryId) set((s) => ({ account: { ...s.account, enquiry, thirdPartyOk: false } })); };
      patch({ status: "resolving" });
      try {
        const res = await nameEnquiry(bank.code, number, holderName());
        if (res.status === "not_found") return patch({ status: "not_found" });
        patch(sameName(res.accountName, holderName()) ? { status: "matched", name: res.accountName } : { status: "other", name: res.accountName });
      } catch {
        patch({ status: "unavailable" });
      }
    },
    setThirdPartyOk: (ok) => set((s) => ({ account: { ...s.account, thirdPartyOk: ok } })),
    setAccountSave: (save) => set((s) => ({ account: { ...s.account, save } })),

    /** Saves the account as yours (matched) or as a third-party recipient (other, once confirmed), selects it and returns to the list. */
    saveNgnAccount: async () => {
      const { bank, number, enquiry, thirdPartyOk, save } = get().account;
      if (!bank || !(enquiry.status === "matched" || (enquiry.status === "other" && thirdPartyOk))) return;
      const isSelf = enquiry.status === "matched";
      const existing = get().recipients.find((r) => r.currency === "NGN" && r.bankName === bank.name && r.accountNumber === number);
      const saved = existing ?? await savePayoutRecipient({
        isSelf, name: enquiry.name, holderName: enquiry.name, currency: "NGN", methodType: "bank", bankName: bank.name, accountNumber: number, routingNumber: "",
        // From Send, "Save recipient" unticked keeps it for this send only.
        ...(get().fromSend && !save ? { saved: false } : {}),
      });
      set((s) => ({
        recipients: existing ? s.recipients : [...s.recipients, saved], recipient: saved, account: EMPTY_ACCOUNT,
        // From Send, a new recipient goes straight on to the amount (the explore prototype's Continue).
        ...(s.fromSend ? { stage: "amount" as const, cents: 0 } : { stage: "recipient" as const }),
        ...(saved.isSelf ? { speed: "standard" as Speed } : {}),
      }));
    },
    setEnquiryDown: (down) => { setNameEnquiryAvailable(!down); set({ enquiryDown: down }); },

    seedPin: (pin) => { seedPayoutServer({ pin }); set({ pinSet: pin !== null }); },
    reset: () => { resetPayoutServer(); set({ ...TRANSIENT, currency: "NGN", recipients: listPayoutRecipients(), pinSet: false, enquiryDown: false }); },
  };
});

/** Whether the add-recipient form can be saved (checkPayoutDraft / checkPayoutOtherMethodDraft). */
export function draftReady(d: Draft, self: boolean, legalName: string): boolean {
  if (self) return !!(d.holderName && holderMatches(d, legalName) && d.name) && methodReady(d);
  return methodReady(d);
}
