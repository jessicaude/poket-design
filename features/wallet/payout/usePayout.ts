import { create } from "zustand";
import { attribute, dropEntries, relabel } from "../history/ledger";
import {
  createPayout, hasPin, screenAddress, listPayoutRecipients, nameEnquiry, releaseReservation, reservePayout, resetPayoutServer, resetPinAttempts, savePayoutRecipient, seedPayoutServer,
  setNameEnquiryAvailable, setPin, verifyPin, verifyPinResetCode,
  type NgBank, type PayoutCurrency, type PayoutRecipient, type WithdrawalStatus,
 getInstantSentToday, verifyCode } from "@/lib/mock-api";
import { useWithdrawals } from "./useWithdrawals";
import { useSend } from "../send/useSend";
import { asSendRecipient, defaultSource, sameAsTarget, targetKeyFor } from "../send/sources";
import { sendSummary } from "../send/sendSummary";
import { cvAvail, cvFeeText, cvFmt, cvParse, cvQuote, cvRateText, cvType } from "../convert/convertMath";
import { cashAmount, setCashAmount, useHoldings, type CashCurrency } from "../useHoldings";
import { useConvert } from "../convert/useConvert";
import { NGN_MAX_ATTEMPTS, holderName, useNgn } from "../ngn/useNgn";
import { INSTANT_TIER_MAX_DEMO_KOBO, useSettings } from "../settings/useSettings";
import { handleCodeError } from "@/store/lock";
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
  "pin", "pinLocked", "pinResetOtp", "moneyDone", "device",
  "processing", "done",
  "ngn-account", "ngn-bank", "selfie", "selfieChecking", "selfieRetry", "payFrom", "screening", "screeningBlocked",
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
export type NgnAccountDraft = {
  bank: NgBank | null; number: string; enquiry: Enquiry; thirdPartyOk: boolean;
  /** Nickname (optional, the exploration's), shown once the name is found. */ nick: string;
  /** "Save recipient". */ save: boolean;
};
const EMPTY_ACCOUNT: NgnAccountDraft = { bank: null, number: "", enquiry: { status: "idle" }, thirdPartyOk: false, nick: "", save: true };

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
  /** Your own bank accounts and saved bank recipients (to find an NGN account already added). */
  recipients: PayoutRecipient[];
  recipient: PayoutRecipient | null;
  /** What the recipient gets ("They get"), in the recipient's currency. */
  cents: number;
  ack: boolean;
  lastRef: string | null;
  /** The payout just made: its withdrawal id, amount, fee and status (scheduled for a first payment, else sending). */
  sent: { id: string; amount: number; fee: number; status: WithdrawalStatus; quickCheck?: boolean } | null;
  pinStage: PinStage;
  /** "reset" after Reset PIN with passcode (S.pinPurpose). "approve": a setting that needs the PIN (approveWithPin). */
  pinPurpose: "payout" | "reset" | "approve";
  /** "approve": what the PIN approves, under "Enter your PIN" (e.g. "Turns on instant transfers."). */
  pinReason: string;
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
  /**
   * Ask for the PIN (or create one) to approve a setting, then run `onApproved`. Asked during a send (the amount
   * screen's "Turn on"), the send comes back as it was, approved or cancelled; otherwise the PIN screens close.
   */
  approveWithPin: (reason: string, onApproved: () => void) => void;
  cancelApprove: () => void;
  /**
   * The selfie check before a send's PIN (Checkout's vendor handoff and "Checking your ID"). selfiePhone: on the phone;
   * selfieFail: the last failure (retry or declined) and its reason. Failures count toward the 3 ID check attempts
   * (useNgn.attempts, with NGN ID matches); the 3rd holds the send for review and blocks the account.
   */
  selfiePhone: boolean;
  selfieFail: { kind: "retry" | "declined"; reason: string } | null;
  selfieOpenPhone: () => void;
  selfieFinish: () => void;
  selfieTryAgain: () => void;
  selfieCancel: () => void;
  /**
   * WGT-10: run `next` once this device is bound. A known device runs it now; a new one shows "Confirm this device"
   * (a 6-digit code to the user's email) first, then continues where it left off (a send comes back as it was).
   */
  requireDevice: (next: () => void) => void;
  deviceCode: (code: string) => Promise<void>;
  cancelDevice: () => void;
  startPinReset: () => void;
  pinResetCode: (code: string) => Promise<void>;

  setAccountBank: (bank: NgBank) => void;
  setAccountNumber: (text: string) => void;
  /** Run the name enquiry for the current bank and number (also "Try again"). */
  lookUpName: () => Promise<void>;
  setThirdPartyOk: (ok: boolean) => void;
  setAccountSave: (save: boolean) => void;
  setAccountNick: (nick: string) => void;
  saveNgnAccount: () => Promise<void>;
  setEnquiryDown: (down: boolean) => void;

  /** Demo controls. */
  seedPin: (pin: string | null) => void;
  reset: () => void;
};

const TRANSIENT = {
  stage: null, recipient: null, cents: 0, ack: false, lastRef: null, sent: null,
  selfiePhone: false, selfieFail: null as State["selfieFail"],
  pinStage: "create" as PinStage, pinPurpose: "payout" as State["pinPurpose"], pinReason: "", pinDraft: null, pinError: "", otpError: "",
  account: EMPTY_ACCOUNT,
  payFrom: null as string | null, payCents: 0, quoteAt: 0, jitter: 1, quoteExpired: false,
};

/** approveWithPin: what runs once the PIN is accepted. */
let onApproved: (() => void) | null = null;
let selfieTimer: ReturnType<typeof setTimeout> | null = null;
/** The next send is created held for review (the 3rd failed selfie check). */
let holdForReview = false;
const takeHold = () => { const h = holdForReview; holdForReview = false; return h; };
/** The reference's VF_RETRY_REASONS_SELFIE. */
export const SELFIE_RETRY_REASONS = [
  "We couldn't see your face clearly. Try again in good light.",
  "Your selfie was blurry. Hold your phone still.",
  "Something was covering your face. Remove glasses or hats.",
];
/** requireDevice: what runs once the device is bound. */
let onDeviceBound: (() => void) | null = null;
/** approveWithPin during a send: the send's state, restored afterwards. */
let resumeSnapshot: Partial<State> | null = null;

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
    const { currency, recipient: r, cents, payFrom, payCents, jitter } = get();
    if (!r || !payFrom) return;
    if (!(r.methodType === "bank" && r.currency === "NGN")) return executeSend();
    const s = sendSummary(r, payFrom, payCents, cents, jitter);
    const total = cents + s.feeTarget; // NGN fees aren't decided: 0 in the maths (ngn.mdc)
    set({ stage: "processing" });
    const conversion = conversionDetails();
    // The NGN balance's ledger: the naira bought for the send, and the send itself, get its reference once it exists
    const cvIds = attribute({ description: `Converted to NGN · To ${r.name}`, reference: "" }, convertPayFrom);
    const rsv = await reservePayout({ currency, amount: total });
    const sendIds = attribute({ description: `To ${r.name}`, reference: "" }, () => moveReserved(total, total));
    try {
      // The reservation stays until the withdrawal is paid (cleared) or fails (released): see useWithdrawals.
      const w = await createPayout({
        currency, amount: cents, fee: s.feeTarget, recipientId: r.id, reservationId: rsv.id, recipientSub: payoutMethodSub(r), conversion, kind: "bank",
        amountText: s.theyGetText, feeText: s.feeText, arrival: s.arrival, eta: s.eta, sourceKey: payFrom,
        ...(takeHold() ? { heldForReview: true } : {}),
      });
      relabel([...cvIds, ...sendIds], { reference: w.ref, withdrawalId: w.id });
      useWithdrawals.getState().refresh();
      set({ stage: "done", lastRef: w.ref, sent: { id: w.id, amount: cents, fee: s.feeTarget, status: w.status }, recipients: listPayoutRecipients() });
    } catch {
      await releaseReservation(rsv.id);
      // Never created: the reservation and its release cancel out
      dropEntries([...sendIds, ...attribute({ description: "", reference: "" }, () => moveReserved(-total, -total))]);
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
  /**
   * The selfie check's result (the demo bar's outcome). Passes: on to the PIN. Needs retry or declined: one of the 3
   * ID check attempts (useNgn.attempts, shared with NGN ID matches); the 3rd holds the send for review (no PIN: it
   * isn't approved) and blocks the account.
   */
  const selfieResult = () => {
    const outcome = useSettings.getState().selfieOutcome;
    if (outcome === "pass") return get().toPin();
    const attempts = useNgn.getState().attempts + 1;
    useNgn.getState().set({ attempts });
    if (attempts >= NGN_MAX_ATTEMPTS) {
      useSettings.getState().setDemo({ idBlocked: true });
      holdForReview = true;
      return execute();
    }
    const reason = outcome === "retry" ? SELFIE_RETRY_REASONS[(attempts - 1) % SELFIE_RETRY_REASONS.length] : "";
    set({ stage: "selfieRetry", selfieFail: { kind: outcome, reason } });
  };

  /** The PIN approved a setting: close the PIN screens, then run what it approved. */
  const approved = () => {
    const run = onApproved;
    onApproved = null;
    resumeAfterPin();
    run?.();
  };
  /** Back to the send the PIN was asked from (its stage, amount and quote), else closed. */
  const resumeAfterPin = () => {
    const snap = resumeSnapshot;
    resumeSnapshot = null;
    if (snap) set({ ...snap, pinSet: hasPin(), pinStage: "create", pinPurpose: "payout", pinReason: "", pinDraft: null, pinError: "" });
    else set({ ...TRANSIENT });
  };
  const conversionDetails = () => {
    const { payFrom, payCents, recipient: r, cents, jitter } = get();
    if (!payFrom || !r || sameAsTarget(payFrom, asSendRecipient(r))) return undefined;
    const q = cvQuote(payFrom, targetKeyFor(r, payFrom), payCents, jitter);
    return { paidText: cvFmt(payCents, q.f), receivedText: cvFmt(cents, q.to), rateText: cvRateText(q.f, q.to, jitter, false), feeText: cvFeeText(q) };
  };
  /** Add to (or, negative, take from) a balance by its cvKey: cash (keeping FIAT-ONLY in step) or a coin. */
  const adjustBalance = (key: string, delta: number) => {
    const f = cvParse(key);
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
    const { recipient: r, payFrom, payCents, cents, jitter } = get();
    if (!r || !payFrom) return;
    const s = sendSummary(r, payFrom, payCents, cents, jitter);
    const fromNgn = payFrom === "cash:NGN:open";
    set({ stage: "processing" });
    const conversion = conversionDetails();
    const rsv = await reservePayout({ currency: r.currency, amount: s.sourceTotal });
    const sendIds = attribute({ description: `To ${r.name}`, reference: "" }, () => { if (fromNgn) moveReserved(s.sourceTotal, s.sourceTotal); else adjustBalance(payFrom, -s.sourceTotal); });
    try {
      // A Poket user: your record is in your paying balance's currency; what they receive (USD when naira converts on
      // receipt, WGT-07) is its targetKey, and only their side is credited in it
      const src = cvParse(payFrom);
      const w = await createPayout({
        currency: s.kind === "poket" && src.k === "cash" ? src.cur as typeof r.currency : r.currency, amount: cents, fee: s.feeTarget, recipientId: r.id, reservationId: rsv.id, recipientSub: payoutMethodSub(r),
        kind: s.kind, recipientName: r.name, ...(s.kind === "poket" ? { targetKey: s.targetKey } : {}), amountText: s.theyGetText, feeText: s.feeText, arrival: s.arrival, eta: s.eta,
        sourceKey: payFrom, sourceTotal: s.sourceTotal, reservedIn: fromNgn ? "ngn" : "source", conversion, usdOut: s.usdOut,
        ...(takeHold() ? { heldForReview: true } : {}),
      });
      relabel(sendIds, { reference: w.ref, withdrawalId: w.id });
      if (w.status === "paid" && fromNgn) moveReserved(-s.sourceTotal, 0); // paid at once: nothing left on hold
      useWithdrawals.getState().refresh();
      set({ stage: "done", lastRef: w.ref, sent: { id: w.id, amount: cents, fee: s.feeTarget, status: w.status, quickCheck: w.quickCheck }, recipients: listPayoutRecipients() });
    } catch {
      await releaseReservation(rsv.id);
      dropEntries([...sendIds, ...attribute({ description: "", reference: "" }, () => { if (fromNgn) moveReserved(-s.sourceTotal, -s.sourceTotal); else adjustBalance(payFrom, s.sourceTotal); })]);
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
      set({ ...TRANSIENT, currency: r.currency, recipients: listPayoutRecipients(), recipient: r, stage: "amount" });
      startAmount(r);
    },
    toReview: async () => {
      const r = get().recipient;
      // WGT-09: instant transfers off: sends to Nigerian banks don't go (the amount screen says so)
      if (r?.methodType === "bank" && r.currency === "NGN" && !useSettings.getState().instantOn) return;
      // ...nor over the daily limit (today's total to Nigerian banks, WGT-09)
      if (r?.methodType === "bank" && r.currency === "NGN") {
        const { instantLimit } = useSettings.getState();
        const limit = Math.min(instantLimit, INSTANT_TIER_MAX_DEMO_KOBO[Math.max(0, Math.min(3, useNgn.getState().tier)) as 0 | 1 | 2 | 3]);
        if (get().cents > Math.max(0, limit - getInstantSentToday())) return;
      }
      if (r?.methodType === "wallet" && r.walletAddress) {
        set({ stage: "screening" });
        const { ok } = await screenAddress(r.walletAddress);
        if (get().stage !== "screening") return;
        return set(ok ? { ack: false, stage: "review" } : { stage: "screeningBlocked" });
      }
      set({ ack: false, stage: "review" });
    },
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
        review: "amount", pin: "review", selfie: "review", payFrom: "amount", "ngn-bank": "ngn-account",
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
      // The whole balance, less a decided fee (a wallet's); undecided fees (₦[fee], $[fee]) count as 0
      const { payFrom, recipient: r, jitter } = get();
      if (!payFrom || !r) return;
      const avail = cvAvail(cvParse(payFrom));
      const fee = sendSummary(r, payFrom, avail, 0, jitter).sourceTotal - avail;
      set({ payCents: Math.max(0, avail - fee) });
      recompute();
    },
    setAck: (ack) => set({ ack }),

    confirm: () => {
      if (!get().ack) return;
      // A new device confirms itself first (WGT-10), then this confirm runs again
      if (!useSettings.getState().deviceKnown) return get().requireDevice(() => get().confirm());
      // A send that converts can't go ahead on an expired quote (Refresh rate first).
      const { payFrom, recipient, quoteExpired } = get();
      if (payFrom && recipient && quoteExpired && !sameAsTarget(payFrom, asSendRecipient(recipient))) return;
      // Step-up: the USD value of what leaves the source balance (amount and fees), whatever the recipient gets
      const { cents, payCents, jitter } = get();
      // The selfie check before the PIN: over ₦[step-up] (judged on what leaves the source), or flagged as unusual
      const flagged = useSettings.getState().flagUnusual;
      if (get().stage === "review" && payFrom && recipient && (flagged || needsStepUp(sendSummary(recipient, payFrom, payCents, cents, jitter).usdOut))) {
        return set({ stage: "selfie", selfiePhone: false, selfieFail: null });
      }
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
        if (pinPurpose === "approve") return approved();
        return execute();
      }
      const res = await verifyPin(pin);
      if (res.ok) { set({ pinError: "" }); return pinPurpose === "approve" ? approved() : execute(); }
      if (res.locked) return set({ stage: "pinLocked", pinError: "" });
      set({ pinError: `Incorrect PIN. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? "" : "s"} left.` });
    },

    approveWithPin: (reason, run) => {
      onApproved = run;
      const st = get();
      resumeSnapshot = st.stage ? { ...st } : null;
      resetPinAttempts();
      set({ ...(resumeSnapshot ? {} : TRANSIENT), stage: "pin", pinStage: hasPin() ? "entry" : "create", pinPurpose: "approve", pinReason: reason, pinDraft: null, pinError: "" });
    },

    cancelApprove: () => { onApproved = null; resumeAfterPin(); },

    selfieOpenPhone: () => set({ selfiePhone: true }),
    selfieFinish: () => {
      set({ stage: "selfieChecking" });
      if (selfieTimer) clearTimeout(selfieTimer);
      selfieTimer = setTimeout(() => { selfieTimer = null; if (get().stage === "selfieChecking") selfieResult(); }, 1400);
    },
    selfieTryAgain: () => set({ stage: "selfie", selfiePhone: false }),
    selfieCancel: () => { if (selfieTimer) clearTimeout(selfieTimer); set({ stage: "review", selfiePhone: false, selfieFail: null }); },

    requireDevice: (next) => {
      if (useSettings.getState().deviceKnown) return next();
      onDeviceBound = next;
      const st = get();
      resumeSnapshot = st.stage ? { ...st } : null;
      set({ ...(resumeSnapshot ? {} : TRANSIENT), stage: "device" });
    },
    deviceCode: async (code) => {
      // The mock's email code: 000000 is wrong (throws with the message to show). Too many wrong codes lock the
      // account: the wallet shows "Account locked" over this step (WalletBody) and the merchant hears about it.
      try { await verifyCode(code); }
      catch (e) { if (handleCodeError(e, "wallet")) return; throw e; }
      useSettings.getState().bindDevice();
      const next = onDeviceBound;
      onDeviceBound = null;
      resumeAfterPin();
      next?.();
    },
    cancelDevice: () => { onDeviceBound = null; resumeAfterPin(); },

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
    setAccountNick: (nick) => set((s) => ({ account: { ...s.account, nick } })),

    /** Saves the account as yours (matched) or as a third-party recipient (other, once confirmed), selects it and returns to the list. */
    saveNgnAccount: async () => {
      const { bank, number, enquiry, thirdPartyOk, save, nick } = get().account;
      if (!bank || !(enquiry.status === "matched" || (enquiry.status === "other" && thirdPartyOk))) return;
      const isSelf = enquiry.status === "matched";
      const existing = get().recipients.find((r) => r.currency === "NGN" && r.bankName === bank.name && r.accountNumber === number);
      const saved = existing ?? await savePayoutRecipient({
        // The nickname names it; the account holder stays the enquiry's name (shown on review when they differ)
        isSelf, name: nick.trim() || enquiry.name, holderName: enquiry.name, currency: "NGN", methodType: "bank", bankName: bank.name, accountNumber: number, routingNumber: "",
        // From Send, "Save recipient" unticked keeps it for this send only.
        ...(!save ? { saved: false } : {}),
      });
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
