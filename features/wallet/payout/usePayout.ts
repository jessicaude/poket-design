import { create } from "zustand";
import {
  createPayout, hasPin, screenAddress, listPayoutRecipients, nameEnquiry, releaseReservation, reservePayout, resetPayoutServer, resetPinAttempts, savePayoutRecipient, seedPayoutServer,
  setNameEnquiryAvailable, setPin, verifyPin, verifyPinResetCode,
  type NgBank, type PayoutCurrency, type PayoutRecipient, type WithdrawalStatus,
} from "@/lib/mock-api";
import { useWithdrawals } from "./useWithdrawals";
import { sourceBlock, useSend } from "../send/useSend";
import { asSendRecipient, defaultSource, sameAsTarget, targetKeyFor } from "../send/sources";
import { sendSummary } from "../send/sendSummary";
import { cvAvail, cvFeeText, cvFmt, cvParse, cvQuote, cvRateText, cvType } from "../convert/convertMath";
import { cashAmount, setCashAmount, useHoldings, type CashCurrency } from "../useHoldings";
import { useConvert } from "../convert/useConvert";
import { holderName, useNgn } from "../ngn/useNgn";
import { needsStepUp, payoutMethodSub } from "./payoutMath";

/**
 * Send's controller from the amount on (the recipient is chosen in Send, features/wallet/send), rendered by
 * PayoutBody inside WalletShell's #panelBody. The only way in is Send: sendTo (a recipient) or sendToNewBank (a new
 * Nigerian bank account). Review, PIN, done and processing are ported from tPayout in reference/poket-unified.html,
 * with the checkout's PIN steps (tPin, pinComplete, tPinLocked, tPinResetOtp, tMoneyDone) in place of the wallet's
 * passcode 'authorize' stage. Not in the reference: ngn-account and ngn-bank (an NGN bank account with name
 * enquiry), stepup (the reference's tStepupIntro, before the PIN for amounts over ₦[step-up]), payFrom (the "You
 * send" chip's list) and screening / screeningBlocked (a stablecoin wallet's address check).
 */
export const PAYOUT_STAGES = [
  "amount", "review",
  "pin", "pinLocked", "pinResetOtp", "moneyDone",
  "processing", "done",
  "ngn-account", "ngn-bank", "stepup", "payFrom", "screening", "screeningBlocked",
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

export type WireAddress = { street: string; city: string; state: string; zip: string };

type State = {
  stage: PayoutStage | null;
  currency: PayoutCurrency;
  /** Your own bank accounts and saved bank recipients (to find an NGN account already added). */
  recipients: PayoutRecipient[];
  recipient: PayoutRecipient | null;
  /** What the recipient gets ("They get"), in the recipient's currency. */
  cents: number;
  /**
   * A US bank send's speed, chosen per send on the amount screen (the explore prototype's speedsFor): rtp (Instant,
   * if the bank supports it), ach (Standard, the default) or wire, which needs the recipient's address.
   */
  speed: string;
  wire: WireAddress;
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
  account: NgnAccountDraft;
  /** Name enquiry is down (demo bar). */
  enquiryDown: boolean;
  /**
   * Send's amount screen: the balance paying ("You send" chip, a cvKey), the amount typed in its currency, and the
   * inline quote when it's another currency (quoted at quoteAt, held CV_QUOTE_SECONDS). `cents` is what the recipient
   * gets ("They get"), in the recipient's currency.
   */
  payFrom: string | null;
  payCents: number;
  quoteAt: number;
  jitter: number;
  quoteExpired: boolean;

  /** Send: a recipient (saved, or just added), straight to the amount. */
  sendTo: (r: PayoutRecipient) => void;
  setSpeed: (speed: string) => void;
  editWire: (p: Partial<WireAddress>) => void;
  /** The chip: pay from another balance (a new quote if it's another currency). */
  setPayFrom: (key: string) => void;
  /** Send's Review: a stablecoin wallet's address is screened first (the reference's gateAddress). */
  toReview: () => Promise<void>;
  refreshQuote: () => void;
  expireQuote: () => void;
  /** Send's "+ New recipient" → Bank account: the bank-account step, then the amount. */
  sendToNewBank: () => void;
  /** The amount screen's "Change": back to Send's recipients. */
  changeRecipient: () => void;
  close: () => void;
  go: (stage: PayoutStage) => void;
  back: () => void;

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
  stage: null, recipient: null, cents: 0, speed: "ach", wire: { street: "", city: "", state: "", zip: "" } as WireAddress, ack: false, lastRef: null, sent: null,
  pinStage: "create" as PinStage, pinPurpose: "payout" as const, pinDraft: null, pinError: "", otpError: "",
  account: EMPTY_ACCOUNT,
  payFrom: null as string | null, payCents: 0, quoteAt: 0, jitter: 1, quoteExpired: false,
};

export const usePayout = create<State>((set, get) => {
  /** Increments per enquiry, so a slow answer for an older bank/number is ignored. */
  let enquiryId = 0;

  /** Move NGN between the available balance and the reserved total (positive: reserve; negative: give back or settle). */
  const moveReserved = (toReserved: number, fromBalance: number) =>
    useNgn.setState((s) => ({ ngnBalance: s.ngnBalance - fromBalance, ngnReserved: s.ngnReserved + toReserved }));

  /**
   * executeWithdraw, called once the PIN is accepted, for NGN to a Nigerian bank: a source in another currency
   * converts into naira first, then the amount is reserved from the NGN balance and the send created. It starts
   * Scheduled (first payment to an account) or Sending; its reservation is cleared when it's paid and released when it
   * fails (useWithdrawals). If it can't be created, the reservation is released. Every other send: executeSend.
   */
  const execute = async () => {
    const { currency, recipient: r, cents, payFrom, payCents, jitter, speed } = get();
    if (!r || !payFrom) return;
    if (!(r.methodType === "bank" && r.currency === "NGN")) return executeSend();
    const s = sendSummary(r, payFrom, payCents, cents, jitter, speed);
    const total = cents + s.feeTarget; // NGN fees aren't decided: 0 in the maths (ngn.mdc)
    set({ stage: "processing" });
    const conversion = conversionDetails();
    convertPayFrom();
    const rsv = await reservePayout({ currency, amount: total });
    moveReserved(total, total);
    try {
      // The reservation stays until the withdrawal is paid (cleared) or fails (released): see useWithdrawals.
      const w = await createPayout({
        currency, amount: cents, fee: s.feeTarget, recipientId: r.id, reservationId: rsv.id, recipientSub: payoutMethodSub(r), conversion, kind: "bank",
        amountText: s.theyGetText, feeText: s.feeText, arrival: s.arrival, eta: s.eta, sourceKey: payFrom,
      });
      useWithdrawals.getState().refresh();
      set({ stage: "done", lastRef: w.ref, sent: { id: w.id, amount: cents, fee: s.feeTarget, status: w.status }, recipients: listPayoutRecipients() });
    } catch {
      await releaseReservation(rsv.id);
      moveReserved(-total, -total);
      set({ stage: "review" });
    }
  };

  const ngnCoinsBlocked = () => useConvert.getState().ngnCoinsBlocked;
  /** "They get": the typed amount, or what it converts to at the current quote (into the recipient's target). */
  const recompute = () => {
    const { payFrom, payCents, recipient: r, jitter } = get();
    if (!payFrom || !r) return;
    set({ cents: sameAsTarget(payFrom, asSendRecipient(r)) ? payCents : cvQuote(payFrom, targetKeyFor(r, payFrom), payCents, jitter).receive });
  };
  const newQuote = () => {
    const { payFrom, recipient: r } = get();
    if (!payFrom || !r) return;
    const fx = cvType(cvParse(payFrom), cvParse(targetKeyFor(r, payFrom))) === "fx";
    set({ quoteAt: Date.now(), quoteExpired: false, jitter: fx ? 1 + (Math.random() - 0.5) * 0.004 : 1 });
  };
  /** Opening Send's amount: the default source, nothing typed. */
  const startAmount = (r: PayoutRecipient) => {
    const payFrom = defaultSource(asSendRecipient(r), useSend.getState().source, ngnCoinsBlocked());
    set({ payFrom, payCents: 0, cents: 0 });
    newQuote();
  };
  /** A send that converts: what leaves the source, what arrives, the rate and the conversion fee, for its one record. */
  const conversionDetails = () => {
    const { payFrom, payCents, recipient: r, cents, jitter } = get();
    if (!payFrom || !r || sameAsTarget(payFrom, asSendRecipient(r))) return undefined;
    const q = cvQuote(payFrom, targetKeyFor(r, payFrom), payCents, jitter);
    return { paidText: cvFmt(payCents, q.f), receivedText: cvFmt(cents, q.to), rateText: cvRateText(q.f, q.to, jitter, false), feeText: cvFeeText(q) };
  };
  /** Add to (or, negative, take from) a balance by its cvKey: cash (keeping FIAT-ONLY in step), merchant-held naira, a coin. */
  const adjustBalance = (key: string, delta: number) => {
    const f = cvParse(key);
    if (f.k === "cash" && f.bucket === "merchant") return useNgn.setState((s) => ({ ngnMerchantBalance: s.ngnMerchantBalance + delta }));
    if (f.k === "cash") {
      setCashAmount(f.cur, cashAmount(f.cur) + delta);
      if (f.bucket === "fiat") useHoldings.setState((s) => ({ fiatOnly: { ...s.fiatOnly, [f.cur]: Math.max(0, (s.fiatOnly[f.cur] || 0) + delta) } }));
      return;
    }
    const c = useHoldings.getState().coins;
    useHoldings.setState({ coins: { ...c, [f.asset]: { ...c[f.asset], [f.net]: Math.max(0, (c[f.asset][f.net] || 0) + delta) } } });
  };
  /**
   * NGN to a Nigerian bank from another currency: once the PIN is accepted, the source converts into naira at the
   * quote (the source is debited, the NGN balance credited), then the send reserves naira as usual.
   */
  const convertPayFrom = () => {
    const { payFrom, payCents, recipient: r, cents } = get();
    if (!payFrom || !r || sameAsTarget(payFrom, asSendRecipient(r))) return;
    adjustBalance(payFrom, -payCents);
    setCashAmount(r.currency as CashCurrency, cashAmount(r.currency as CashCurrency) + cents);
  };

  /**
   * Every other send (a US or UK bank, a Poket user, a stablecoin wallet): once the PIN is accepted the whole amount
   * (plus fee) is reserved from the paying balance, NGN into "on hold" as for bank sends, others taken from the
   * balance and given back if the send fails. A Poket user is paid at once.
   */
  const executeSend = async () => {
    const { recipient: r, payFrom, payCents, cents, jitter, speed, wire } = get();
    if (!r || !payFrom) return;
    const s = sendSummary(r, payFrom, payCents, cents, jitter, speed);
    const usBank = r.methodType === "bank" && r.currency === "USD";
    const fromNgn = payFrom === "cash:NGN:open";
    set({ stage: "processing" });
    const conversion = conversionDetails();
    const rsv = await reservePayout({ currency: r.currency, amount: s.sourceTotal });
    if (fromNgn) moveReserved(s.sourceTotal, s.sourceTotal); else adjustBalance(payFrom, -s.sourceTotal);
    try {
      const w = await createPayout({
        currency: r.currency, amount: cents, fee: s.feeTarget, recipientId: r.id, reservationId: rsv.id, recipientSub: payoutMethodSub(r),
        kind: s.kind, recipientName: r.name, amountText: s.theyGetText, feeText: s.feeText, arrival: s.arrival, eta: s.eta,
        sourceKey: payFrom, sourceTotal: s.sourceTotal, reservedIn: fromNgn ? "ngn" : "source", conversion,
        ...(usBank ? { speed, ...(speed === "wire" ? { wireAddress: wire } : {}) } : {}),
      });
      if (w.status === "paid" && fromNgn) moveReserved(-s.sourceTotal, 0); // paid at once: nothing left on hold
      useWithdrawals.getState().refresh();
      set({ stage: "done", lastRef: w.ref, sent: { id: w.id, amount: cents, fee: s.feeTarget, status: w.status }, recipients: listPayoutRecipients() });
    } catch {
      await releaseReservation(rsv.id);
      if (fromNgn) moveReserved(-s.sourceTotal, -s.sourceTotal); else adjustBalance(payFrom, s.sourceTotal);
      set({ stage: "review" });
    }
  };

  return {
    ...TRANSIENT,
    currency: "NGN",
    recipients: listPayoutRecipients(),
    pinSet: hasPin(),
    enquiryDown: false,

    close: () => set({ ...TRANSIENT }),
    go: (stage) => set({ stage }),

    sendTo: (r) => {
      // A US bank starts on Standard; a wire address saved with the recipient fills the wire fields
      set({
        ...TRANSIENT, currency: r.currency, recipients: listPayoutRecipients(), recipient: r, stage: "amount",
        wire: { street: r.address ?? "", city: r.city ?? "", state: r.state ?? "", zip: r.zip ?? "" },
      });
      startAmount(r);
    },
    toReview: async () => {
      const r = get().recipient;
      if (r?.methodType === "wallet" && r.walletAddress) {
        set({ stage: "screening" });
        const { ok } = await screenAddress(r.walletAddress);
        if (get().stage !== "screening") return;
        return set(ok ? { ack: false, stage: "review" } : { stage: "screeningBlocked" });
      }
      set({ ack: false, stage: "review" });
    },
    setSpeed: (speed) => { set({ speed }); recompute(); },
    editWire: (p) => set((s) => ({ wire: { ...s.wire, ...p } })),
    setPayFrom: (key) => { set({ payFrom: key, stage: "amount" }); newQuote(); recompute(); },
    refreshQuote: () => { newQuote(); recompute(); },
    expireQuote: () => set({ quoteExpired: true }),
    sendToNewBank: () => set({ ...TRANSIENT, currency: "NGN", recipients: listPayoutRecipients(), account: EMPTY_ACCOUNT, stage: "ngn-account" }),
    changeRecipient: () => {
      get().close();
      useSend.getState().open(useSend.getState().source);
    },

    back: () => {
      const { stage } = get();
      // The first step's Back returns to Send (its recipients, or the new bank account's currency).
      if (stage === "amount" || stage === "ngn-account") {
        get().close();
        useSend.getState().open(useSend.getState().source);
        if (stage === "ngn-account") useSend.setState({ stage: "bankCurrency" });
        return;
      }
      const prev: Partial<Record<PayoutStage, PayoutStage>> = {
        review: "amount", pin: "review", stepup: "review", payFrom: "amount", "ngn-bank": "ngn-account",
      };
      const to = stage ? prev[stage] : undefined;
      if (to) set({ stage: to, pinDraft: null, pinError: "" });
    },

    /** data-payoutkey: digits shift in from the right; back drops the last one. */
    key: (k) => {
      // The amount is typed in the source's currency ("You send").
      const p = get().payCents;
      if (k === "back") set({ payCents: Math.floor(p / 10) });
      else if (p < KEYPAD_MAX) set({ payCents: p * 10 + Number(k) });
      recompute();
    },
    max: () => {
      // The whole balance, less a decided fee (a US speed's, a wallet's); undecided fees (₦[fee], $[fee]) count as 0
      const { payFrom, recipient: r, jitter, speed } = get();
      if (!payFrom || !r) return;
      const avail = cvAvail(cvParse(payFrom));
      const fee = sendSummary(r, payFrom, avail, 0, jitter, speed).sourceTotal - avail;
      set({ payCents: Math.max(0, avail - fee) });
      recompute();
    },
    setAck: (ack) => set({ ack }),

    confirm: () => {
      if (!get().ack) return;
      // A send that converts can't go ahead on an expired quote (Refresh rate first).
      const { payFrom, recipient, quoteExpired } = get();
      if (payFrom && recipient && quoteExpired && !sameAsTarget(payFrom, asSendRecipient(recipient))) return;
      // Step-up: the USD value of what leaves the source balance (amount and fees), whatever the recipient gets
      const { cents, payCents, jitter, speed } = get();
      if (get().stage === "review" && payFrom && recipient && needsStepUp(sendSummary(recipient, payFrom, payCents, cents, jitter, speed).usdOut)) return set({ stage: "stepup" });
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
        ...(!save ? { saved: false } : {}),
      });
      // A source that can't send to a bank (merchant-held naira): the recipient is saved, then the source decides
      // what happens (sourceBlock).
      const src = useSend.getState().source;
      const block = sourceBlock(src);
      if (block) { set({ ...TRANSIENT }); useSend.getState().open(src); block(); return; }
      // On to the amount (the explore prototype's Continue).
      set((s) => ({
        recipients: existing ? s.recipients : [...s.recipients, saved], recipient: saved, account: EMPTY_ACCOUNT,
        stage: "amount", cents: 0, currency: saved.currency,
      }));
      startAmount(saved);
    },
    setEnquiryDown: (down) => { setNameEnquiryAvailable(!down); set({ enquiryDown: down }); },

    seedPin: (pin) => { seedPayoutServer({ pin }); set({ pinSet: pin !== null }); },
    reset: () => { resetPayoutServer(); set({ ...TRANSIENT, currency: "NGN", recipients: listPayoutRecipients(), pinSet: false, enquiryDown: false }); },
  };
});
