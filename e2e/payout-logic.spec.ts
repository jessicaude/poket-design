import { test, expect } from "@playwright/test";
import { fmtCurrency, fmtFee } from "@/features/wallet/payout/payoutMath";
import { sendSummary } from "@/features/wallet/send/sendSummary";
import { asSendRecipient, sourceAllowed } from "@/features/wallet/send/sources";
import { listPayoutRecipients } from "@/lib/mock-api";
import { setPin, verifyPin, verifyPinResetCode, hasPin, resetPayoutServer } from "@/lib/mock-api";
import { usePayout } from "@/features/wallet/payout/usePayout";
import { useNgn } from "@/features/wallet/ngn/useNgn";
import { reservationEffect, isOnHold } from "@/features/wallet/payout/withdrawals";

/** Send's maths (fees, totals, arrival, sources) and PIN logic, without a browser. */
test.beforeEach(() => { resetPayoutServer(); usePayout.getState().reset(); useNgn.getState().reset(); });

const recipient = (id: string) => listPayoutRecipients().find((r) => r.id === id)!;
const asSend = (id: string) => asSendRecipient(recipient(id));

test("NGN fees are undecided: shown as ₦[fee], left out of the maths; other banks keep their fees", () => {
  // Naira account (lb2) has been paid before
  const ngn = sendSummary(recipient("lb2"), "cash:NGN:open", 1250000, 1250000, 1);
  expect(ngn).toMatchObject({ feeTarget: 0, feeText: "₦[fee]", sourceTotal: 1250000, totalText: "₦12,500.00 NGN + ₦[fee]", arrival: "Usually within seconds" });
  expect(fmtFee(0, "NGN")).toBe("₦[fee]");
  expect(fmtFee(50, "USD")).toBe("$0.50 USD");
  expect(fmtCurrency(3026, "USD")).toBe("$30.26 USD");
  // A US bank: the fee and arrival of the speed chosen for this send
  const us = (speed: string) => sendSummary({ ...recipient("r4"), paidBefore: true }, "cash:USD:open", 1000, 1000, 1, speed);
  expect(us("rtp")).toMatchObject({ feeTarget: 150, feeText: "$1.50 USD", sourceTotal: 1150, totalText: "$11.50 USD", arrival: "Within minutes, any day" });
  expect(us("ach")).toMatchObject({ feeTarget: 0, feeText: "Free", sourceTotal: 1000, arrival: "1 to 3 business days" });
  expect(us("wire")).toMatchObject({ feeTarget: 1500, feeText: "$15.00 USD", sourceTotal: 2500, arrival: "Same day if sent before 5 PM ET" });
  // A debit card: $[fee], undecided (0 in the maths), instant
  const card = { id: "dc1", isSelf: false, name: "Ada", currency: "USD" as const, methodType: "card" as const, bankName: "Visa", accountNumber: "4242" };
  expect(sendSummary(card, "cash:USD:open", 1000, 1000, 1)).toMatchObject({ feeTarget: 0, feeText: "$[fee]", sourceTotal: 1000, totalText: "$10.00 USD + $[fee]", arrival: "Instantly", firstPayment: false });
});

test("Max: the whole balance (the NGN fee is undecided)", () => {
  const p = () => usePayout.getState();
  p().sendTo(recipient("r6"));
  expect(p().payFrom).toBe("cash:NGN:open");
  p().max();
  expect(p().payCents).toBe(5000000);
  expect(p().cents).toBe(5000000);
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

test("store: the PIN reserves the amount; a first payment to an account is Scheduled", async () => {
  const p = () => usePayout.getState();
  p().seedPin("1234");
  p().sendTo(recipient("r6")); // as Send does for a saved recipient
  for (const k of "500000") p().key(k);
  p().setAck(true);
  p().confirm();
  expect(p().pinStage).toBe("entry");
  await p().pinComplete("1234");
  expect(p().stage).toBe("done");
  expect(p().lastRef).toMatch(/^TXN-\d{6}$/);
  expect(p().sent?.status).toBe("scheduled"); // Ngozi Eze has never been paid
  expect(useNgn.getState().ngnBalance).toBe(5000000 - 500000);
  expect(useNgn.getState().ngnReserved).toBe(500000);
  expect(p().recipients.find((r) => r.id === "r6")?.paidBefore).toBe(true);
});

test("name enquiry mock and name matching", async () => {
  const { nameEnquiry, reservePayout } = await import("@/lib/mock-api");
  const { sameName } = await import("@/features/wallet/payout/usePayout");
  expect(await nameEnquiry("058", "0123456789", "Ada Osun")).toEqual({ status: "found", accountName: "Ada Osun" });
  expect(await nameEnquiry("058", "0123450000", "Ada Osun")).toEqual({ status: "not_found" });
  const other = await nameEnquiry("058", "0123451111", "Ada Osun");
  expect(other.status === "found" && other.accountName).not.toBe("Ada Osun");
  await expect(nameEnquiry("999", "0123456789", "Ada Osun")).rejects.toThrow("invalid_request");
  expect(sameName("OSUN, ADA", "Ada  Osun")).toBe(true);
  expect(sameName("Ada Osun", "Ada Okafor")).toBe(false);
  // Merchant-held money can't be paid out
  await expect(reservePayout({ currency: "NGN", amount: 100, source: "merchant" })).rejects.toThrow("balance_not_withdrawable");
});

test("debit cards: only USD pays them; Visa and Mastercard debit only (credit cards refused)", async () => {
  const card = { kind: "card" as const, id: "card:x", card: { id: "x", isSelf: false, name: "Ada", currency: "USD" as const, methodType: "card" as const } };
  expect(["cash:USD:open", "cash:USD:fiat"].every((k) => sourceAllowed(k, card, false))).toBe(true);
  expect(["cash:NGN:open", "cash:NGN:merchant", "coin:USDC:Base", "cash:GBP:open"].some((k) => sourceAllowed(k, card, false))).toBe(false);
  const { saveDebitCard } = await import("@/lib/mock-api");
  await expect(saveDebitCard({ number: "4111 1111 1111 1111", name: "Ada Osun", zip: "10001", saved: true })).rejects.toThrow("credit_card");
  await expect(saveDebitCard({ number: "6011 0000 0000 0004", name: "Ada Osun", zip: "10001", saved: true })).rejects.toThrow("unsupported_card");
  const saved = await saveDebitCard({ number: "4242 4242 4242 4242", name: "Ada Osun", zip: "10001", saved: true });
  expect(saved).toMatchObject({ methodType: "card", currency: "USD", bankName: "Visa", accountNumber: "4242" });
});

test("NGN: one speed, Nigerian bank accounts only; a first payment is held", () => {
  expect(sourceAllowed("cash:NGN:open", asSend("r6"), false)).toBe(true);
  expect(sourceAllowed("cash:NGN:open", asSend("r4"), false)).toBe(false); // a US bank account
  expect(sourceAllowed("cash:NGN:merchant", asSend("r6"), false)).toBe(false); // merchant-held: not to a bank
  expect(sendSummary(recipient("r6"), "cash:NGN:open", 100, 100, 1)).toMatchObject({ arrival: "After [hold]", firstPayment: true, converting: false });
});

test("reservations: a first NGN payment is Scheduled, others Sending; a used or mismatched reservation is refused", async () => {
  const { reservePayout, createPayout, releaseReservation } = await import("@/lib/mock-api");
  const a = await reservePayout({ currency: "NGN", amount: 100000 });
  expect(a.status).toBe("reserved");
  expect((await createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "lb2", reservationId: a.id })).status).toBe("sending"); // paid before
  const b = await reservePayout({ currency: "NGN", amount: 100000 });
  expect((await createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "r6", reservationId: b.id })).status).toBe("scheduled"); // first payment
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
