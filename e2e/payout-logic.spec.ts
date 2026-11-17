import { test, expect } from "./fixtures";
import { fmtCurrency, fmtFee } from "@/features/wallet/payout/payoutMath";
import { sendSummary } from "@/features/wallet/send/sendSummary";
import { asSendRecipient, sourceAllowed } from "@/features/wallet/send/sources";
import { listPayoutRecipients } from "@/lib/mock-api";
import { setPin, verifyPin, verifyPinResetCode, hasPin, resetPayoutServer } from "@/lib/mock-api";
import { usePayout } from "@/features/wallet/payout/usePayout";
import { useNgn } from "@/features/wallet/ngn/useNgn";
import { reservationEffect, isOnHold } from "@/features/wallet/payout/withdrawals";

/** Send’s maths (fees, totals, arrival, sources) and PIN logic, without a browser. */
test.beforeEach(() => { resetPayoutServer(); usePayout.getState().reset(); useNgn.getState().reset(); });

const recipient = (id: string) => listPayoutRecipients().find((r) => r.id === id)!;
const asSend = (id: string) => asSendRecipient(recipient(id));

test("NGN fees are undecided: shown as ₦[fee], left out of the maths; other banks keep their fees", () => {
  // Naira account (lb2) has been paid before
  const ngn = sendSummary(recipient("lb2"), "cash:NGN:open", 1250000, 1250000, 1);
  expect(ngn).toMatchObject({ feeTarget: 2500, feeText: "₦25.00 NGN", sourceTotal: 1252500, totalText: "₦12,525.00 NGN", arrival: "Usually within seconds" });
  expect(fmtFee(0, "NGN")).toBe("Free");
  expect(fmtFee(2500, "NGN")).toBe("₦25.00 NGN");
  expect(fmtFee(50, "USD")).toBe("$0.50 USD");
  expect(fmtCurrency(3026, "USD")).toBe("$30.26 USD");
  // A US bank: one speed, 1 to 3 business days; the fee is undecided ($[fee], 0 in the maths)
  const us = sendSummary({ ...recipient("r4"), paidBefore: true }, "cash:USD:open", 1000, 1000, 1);
  expect(us).toMatchObject({ feeTarget: 600, feeText: "$6.00 USD", sourceTotal: 1600, totalText: "$16.00 USD", arrival: "1 to 3 business days" });
  // A debit card: $[fee], undecided (0 in the maths), instant
  const card = { id: "dc1", isSelf: false, name: "Ada", currency: "USD" as const, methodType: "card" as const, bankName: "Visa", accountNumber: "4242" };
  expect(sendSummary(card, "cash:USD:open", 1000, 1000, 1)).toMatchObject({ feeTarget: 600, feeText: "$6.00 USD", sourceTotal: 1600, totalText: "$16.00 USD", arrival: "Instantly", firstPayment: false });
});

test("step-up is judged on the USD value leaving the source; converting totals include every decided fee", async () => {
  const { needsStepUp } = await import("@/features/wallet/payout/payoutMath");
  const wallet = { id: "sw1", isSelf: false, name: "Ledger", currency: "USD" as const, methodType: "wallet" as const, walletAddress: "0x3Fa9cE21b7D04a5e9C6b1d82F7e0A4c39bD58e12", asset: "USDC" as const, network: "Base" as const };
  // ₦25,000 to a USDC wallet: ₦27,325 leaves (with 1.50 USDC = ₦2,325), about $17.63
  const fromNgn = sendSummary(wallet, "cash:NGN:open", 2500000, 1613, 1);
  expect(fromNgn).toMatchObject({ sourceTotal: 3430000, totalText: "₦34,300.00 NGN" });
  expect(Math.round(fromNgn.usdOut)).toBe(2213); // 10.00 USDC and the 6.00 USDC fee, in naira, as USD
  expect(needsStepUp(fromNgn.usdOut)).toBe(true);
  // The demo limit is ₦20,000.00 in USD: exactly that isn’t over it, a kobo more is
  expect(needsStepUp(sendSummary(recipient("lb2"), "cash:NGN:open", 1997500, 1997500, 1).usdOut)).toBe(false); // ₦19,975.00 and the ₦25.00 fee: ₦20,000.00 leaves
  expect(needsStepUp(sendSummary(recipient("lb2"), "cash:NGN:open", 2000100, 2000100, 1).usdOut)).toBe(true);
  // Sending’s message is the send’s own arrival, without the first-payment hold ($500 or more to a new account)
  expect(sendSummary(recipient("r6"), "cash:NGN:open", 80000000, 80000000, 1)).toMatchObject({ arrival: "After [hold]", eta: "Usually within seconds" });
  expect(sendSummary(wallet, "coin:USDC:Base", 100, 100, 1).eta).toBe("About 1 minute");
});

test("CentryLink users from card-funded money: the FIAT-ONLY tag carries to their balance", async () => {
  const { reservePayout, createPayout, getPoketUserBalances } = await import("@/lib/mock-api");
  const poket = { id: "pu1", isSelf: false, name: "Tobi Bello", currency: "NGN" as const, methodType: "poket" as const, handle: "tobi@lagos.ng" };
  expect(sendSummary(poket, "cash:USD:fiat", 500, 500, 1).tag).toBe("FIAT-ONLY");
  expect(sendSummary(poket, "cash:NGN:open", 100, 100, 1).tag).toBeUndefined();
  const send = async (sourceKey: string, amount: number) => {
    const r = await reservePayout({ currency: "NGN", amount });
    return createPayout({ currency: "NGN", amount, fee: 0, recipientId: "pu1", reservationId: r.id, kind: "poket", recipientName: "Tobi Bello", sourceKey, sourceTotal: amount, reservedIn: "source" });
  };
  expect((await send("cash:USD:fiat", 500)).tag).toBe("FIAT-ONLY");
  expect((await send("cash:NGN:open", 2000)).tag).toBeUndefined();
  expect(getPoketUserBalances("pu1")).toEqual({ "USD:fiat": 500, "NGN:open": 2000 });
});

test("first-payment hold: one rule for every recipient, a first payment of $500 or more (USD value leaving) to a new one; never your own accounts", async () => {
  const { reservePayout, createPayout, saveDebitCard, getPoketUserBalances } = await import("@/lib/mock-api");
  const send = async (kind: "card" | "wallet" | "poket" | "bank", recipientId: string, usdOut: number, sourceKey = "coin:USDC:Base") => {
    const r = await reservePayout({ currency: "USD", amount: usdOut });
    return createPayout({ currency: "USD", amount: usdOut, fee: 0, recipientId, reservationId: r.id, kind, recipientName: "x", sourceKey, sourceTotal: usdOut, reservedIn: "source", usdOut });
  };
  const card = await saveDebitCard({ number: "4242424242424242", name: "Kemi Adeyemi", zip: "10001", saved: true, verifiedName: "Ada Osun" });
  expect(await send("card", card.id, 49999)).toMatchObject({ status: "sending" }); // under $500: not held
  const card2 = await saveDebitCard({ number: "5200828282828210", name: "Kemi Adeyemi", zip: "10001", saved: true, verifiedName: "Ada Osun" });
  expect(await send("card", card2.id, 50000)).toMatchObject({ status: "scheduled" });
  expect(await send("card", card2.id, 50000)).toMatchObject({ status: "sending" }); // paid before now
  const own = await saveDebitCard({ number: "4000056655665556", name: "OSUN ADA", zip: "10001", saved: true, verifiedName: "Ada Osun" });
  expect(own.isSelf).toBe(true);
  expect(await send("card", own.id, 90000)).toMatchObject({ status: "sending" }); // your own accounts are never held
  // Your own accounts on the amount and review too: no hold, whatever the amount
  expect(sendSummary({ ...own, paidBefore: false }, "cash:USD:open", 90000, 90000, 1)).toMatchObject({ firstPayment: false, arrival: "Instantly" });
  expect(sendSummary({ ...own, isSelf: false, paidBefore: false }, "cash:USD:open", 90000, 90000, 1).firstPayment).toBe(true);
  expect(await send("wallet", "sw1", 60000)).toMatchObject({ status: "scheduled" });
  expect(await send("wallet", "wallet-new-1", 60000)).toMatchObject({ status: "scheduled" }); // unsaved: new
  // A held CentryLink send is credited only once it’s paid
  const held = await send("poket", "pu2", 70000, "cash:USD:fiat");
  expect(held).toMatchObject({ status: "scheduled", tag: "FIAT-ONLY" });
  expect("quickCheck" in held).toBe(false); // no quick check any more
  expect(getPoketUserBalances("pu2")).toEqual({});
  const { setWithdrawalStatus } = await import("@/lib/mock-api");
  await setWithdrawalStatus(held.id, "sending");
  await setWithdrawalStatus(held.id, "paid");
  expect(getPoketUserBalances("pu2")).toEqual({ "USD:fiat": 70000 });
  // Bank accounts follow the same rule: under $500 goes, $500 or more is held
  expect((await send("bank", "r6", 49999)).status).toBe("sending");
  expect((await send("bank", "r4", 90000)).status).toBe("scheduled");
  // A CentryLink user under $500: paid at once
  expect((await send("poket", "pu3", 1000, "cash:NGN:open")).status).toBe("paid");
});

test("Max: the whole balance (the NGN fee is undecided)", () => {
  const p = () => usePayout.getState();
  p().sendTo(recipient("r6"));
  expect(p().payFrom).toBe("cash:NGN:open");
  p().max();
  expect(p().payCents).toBe(4997500); // less the ₦25.00 fee
  expect(p().cents).toBe(4997500);
});

test("PIN: 3 wrong tries lock it; the emailed passcode clears it", async () => {
  await setPin("1234");
  expect(await verifyPin("0000")).toEqual({ ok: false, attemptsLeft: 2, locked: false });
  expect(await verifyPin("1234")).toEqual({ ok: true });
  for (const left of [2, 1, 0]) expect(await verifyPin("0000")).toEqual({ ok: false, attemptsLeft: left, locked: left === 0 });
  await verifyPinResetCode("123456");
  expect(hasPin()).toBe(false);
  await expect(setPin("12a4")).rejects.toThrow();
});

test("store: the PIN reserves the amount; a first payment of $500 or more to an account is Scheduled", async () => {
  const p = () => usePayout.getState();
  useNgn.setState({ ngnBalance: 100000000 }); // ₦1,000,000.00
  p().seedPin("1234");
  p().sendTo(recipient("r6")); // as Send does for a saved recipient
  for (const k of "80000000") p().key(k); // ₦800,000.00: about $516 with the fee
  p().setAck(true);
  p().confirm();
  expect(p().pinStage).toBe("entry");
  await p().pinComplete("1234");
  expect(p().stage).toBe("done");
  expect(p().lastRef).toMatch(/^TXN-\d{6}$/);
  expect(p().sent?.status).toBe("scheduled"); // Ngozi Eze has never been paid
  expect(useNgn.getState().ngnBalance).toBe(100000000 - 80002500); // the amount and its ₦25.00 fee
  expect(useNgn.getState().ngnReserved).toBe(80002500);
  expect(p().recipients.find((r) => r.id === "r6")?.paidBefore).toBe(true);
});

test("name enquiry mock and name matching", async () => {
  const { nameEnquiry } = await import("@/lib/mock-api");
  const { sameName } = await import("@/features/wallet/payout/usePayout");
  expect(await nameEnquiry("058", "0123456789", "Ada Osun")).toEqual({ status: "found", accountName: "Ada Osun" });
  expect(await nameEnquiry("058", "0123450000", "Ada Osun")).toEqual({ status: "not_found" });
  const other = await nameEnquiry("058", "0123451111", "Ada Osun");
  expect(other.status === "found" && other.accountName).not.toBe("Ada Osun");
  await expect(nameEnquiry("999", "0123456789", "Ada Osun")).rejects.toThrow("invalid_request");
  expect(sameName("OSUN, ADA", "Ada  Osun")).toBe(true);
  expect(sameName("Ada Osun", "Ada Okafor")).toBe(false);
});

test("debit cards: only USD pays them; Visa and Mastercard debit only (credit cards refused)", async () => {
  const card = { kind: "card" as const, id: "card:x", self: false, card: { id: "x", isSelf: false, name: "Ada", currency: "USD" as const, methodType: "card" as const } };
  expect(["cash:USD:open", "cash:USD:fiat"].every((k) => sourceAllowed(k, card, false))).toBe(true);
  expect(["cash:NGN:open", "coin:USDC:Base", "cash:GBP:open"].some((k) => sourceAllowed(k, card, false))).toBe(false);
  const { saveDebitCard } = await import("@/lib/mock-api");
  await expect(saveDebitCard({ number: "4111 1111 1111 1111", name: "Ada Osun", zip: "10001", saved: true })).rejects.toThrow("credit_card");
  await expect(saveDebitCard({ number: "6011 0000 0000 0004", name: "Ada Osun", zip: "10001", saved: true })).rejects.toThrow("unsupported_card");
  const saved = await saveDebitCard({ number: "4242 4242 4242 4242", name: "Ada Osun", zip: "10001", saved: true });
  expect(saved).toMatchObject({ methodType: "card", currency: "USD", bankName: "Visa", accountNumber: "4242" });
});

test("NGN: one speed, Nigerian bank accounts only; a first payment of $500 or more is held", () => {
  expect(sourceAllowed("cash:NGN:open", asSend("r6"), false)).toBe(true);
  expect(sourceAllowed("cash:NGN:open", asSend("r4"), false)).toBe(false); // a US bank account
  expect(sendSummary(recipient("r6"), "cash:NGN:open", 100, 100, 1)).toMatchObject({ arrival: "Usually within seconds", firstPayment: false, converting: false });
  // ₦774,975.00 and the ₦25.00 fee: exactly $500 leaves, so it’s held; a kobo less isn’t
  expect(sendSummary(recipient("r6"), "cash:NGN:open", 77497500, 77497500, 1)).toMatchObject({ arrival: "After [hold]", firstPayment: true });
  expect(sendSummary(recipient("r6"), "cash:NGN:open", 77497499, 77497499, 1).firstPayment).toBe(false);
  expect(sendSummary(recipient("lb2"), "cash:NGN:open", 80000000, 80000000, 1).firstPayment).toBe(false); // paid before
});

test("reservations: a first NGN payment of $500 or more is Scheduled, others Sending; a used or mismatched reservation is refused", async () => {
  const { reservePayout, createPayout, releaseReservation } = await import("@/lib/mock-api");
  const a = await reservePayout({ currency: "NGN", amount: 100000 });
  expect(a.status).toBe("reserved");
  expect((await createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "lb2", reservationId: a.id })).status).toBe("sending"); // paid before
  const b = await reservePayout({ currency: "NGN", amount: 100000 });
  expect((await createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "r6", reservationId: b.id, usdOut: 50000 })).status).toBe("scheduled"); // first payment, $500
  const c = await reservePayout({ currency: "NGN", amount: 100000 });
  expect((await createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "r6", reservationId: c.id })).status).toBe("sending"); // paid now
  await expect(createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "r6", reservationId: c.id })).rejects.toThrow("invalid_reservation"); // used
  const d = await reservePayout({ currency: "NGN", amount: 100000 });
  await expect(createPayout({ currency: "NGN", amount: 99999, fee: 0, recipientId: "r6", reservationId: d.id })).rejects.toThrow("invalid_reservation");
  await releaseReservation(d.id);
  await expect(createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "r6", reservationId: d.id })).rejects.toThrow("invalid_reservation");
});

test("reservation effect of each status change", () => {
  const t = 500000;
  expect(reservationEffect("scheduled", "sending", t)).toEqual({ balance: 0, reserved: 0 });
  expect(reservationEffect("sending", "review", t)).toEqual({ balance: 0, reserved: 0 });
  expect(reservationEffect("review", "paid", t)).toEqual({ balance: 0, reserved: -t }); // paid clears it
  expect(reservationEffect("scheduled", "failed", t)).toEqual({ balance: t, reserved: -t }); // failed releases it
  expect(reservationEffect("paid", "reversed", t)).toEqual({ balance: t, reserved: 0 }); // reversed returns the money
  expect(["scheduled", "review", "sending"].every((s) => isOnHold(s as never))).toBe(true);
  expect(["paid", "failed", "reversed"].some((s) => isOnHold(s as never))).toBe(false);
});

test("mock: only allowed status changes", async () => {
  const { reservePayout, createPayout, setWithdrawalStatus } = await import("@/lib/mock-api");
  const r = await reservePayout({ currency: "NGN", amount: 100000 });
  const w = await createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "lb2", reservationId: r.id });
  await expect(setWithdrawalStatus(w.id, "reversed")).rejects.toThrow("cannot_sending_to_reversed");
  expect((await setWithdrawalStatus(w.id, "paid")).status).toBe("paid");
  await expect(setWithdrawalStatus(w.id, "failed")).rejects.toThrow("cannot_paid_to_failed");
  expect((await setWithdrawalStatus(w.id, "reversed")).status).toBe("reversed");
  await expect(setWithdrawalStatus(w.id, "paid")).rejects.toThrow();
});

test("your own new bank account isn’t held either, at any amount", async () => {
  const { reservePayout, createPayout, savePayoutRecipient } = await import("@/lib/mock-api");
  const own = await savePayoutRecipient({ isSelf: true, name: "My Chase", bankName: "Chase Bank", accountNumber: "000123456789", routingNumber: "021000021", currency: "USD", methodType: "bank" });
  expect(own.paidBefore).toBe(false);
  expect(sendSummary(own, "cash:USD:open", 100000, 100000, 1).firstPayment).toBe(false);
  const r = await reservePayout({ currency: "USD", amount: 100600 });
  expect((await createPayout({ currency: "USD", amount: 100000, fee: 600, recipientId: own.id, reservationId: r.id, kind: "bank", sourceKey: "cash:USD:open", sourceTotal: 100600, reservedIn: "source", usdOut: 100600 })).status).toBe("sending");
});
