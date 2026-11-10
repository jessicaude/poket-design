import { test, expect } from "@playwright/test";
import { convertAmount, fmtCurrency, fmtFee, fmtWithFee, fxRateLabel, hasSpeeds, isCrossBorder, maxPayout, payoutEta, payoutFee, recipientsFor, sendFee, withdrawFee } from "@/features/wallet/payout/payoutMath";
import { listPayoutRecipients } from "@/lib/mock-api";
import { setPin, verifyPin, verifyPinResetCode, hasPin, resetPayoutServer, type PayoutRecipient } from "@/lib/mock-api";
import { usePayout } from "@/features/wallet/payout/usePayout";
import { useNgn } from "@/features/wallet/ngn/useNgn";

/** Payout maths and PIN logic, without a browser. Values follow the reference's sendFee / withdrawFee / fxToUSD. */
test.beforeEach(() => { resetPayoutServer(); usePayout.getState().reset(); useNgn.getState().reset(); });

const self = { isSelf: true, methodType: "bank" } as PayoutRecipient;
const other = { isSelf: false, methodType: "bank" } as PayoutRecipient;

test("NGN fees are undecided: shown as ₦[fee], left out of the maths", () => {
  expect(payoutFee("NGN", self, "standard", 1250000)).toBe(0);
  expect(payoutFee("NGN", other, "standard", 1250000)).toBe(0);
  expect(fmtFee(0, "NGN")).toBe("₦[fee]");
  expect(fmtWithFee(1250000, 0, "NGN")).toBe("₦12,500.00 NGN + ₦[fee]");
  // Other currencies keep the reference's fees
  expect(payoutFee("USD", other, "standard", 1000)).toBe(100);
  expect(fmtFee(50, "USD")).toBe("$0.50 USD");
  expect(fmtWithFee(1000, 100, "USD")).toBe("$11.00 USD");
});

test("the reference's fee functions (kept for when NGN fees are decided)", () => {
  expect(sendFee("NGN")).toBe(155000);
  expect(sendFee("USD")).toBe(100);
  expect(withdrawFee("NGN", "standard", 9999999)).toBe(77500);
  expect(withdrawFee("NGN", "instant", 1000000)).toBe(155000); // 1.5% is below the minimum
  expect(withdrawFee("NGN", "instant", 20000000)).toBe(300000);
});

test("FX: integer conversion and the 4-decimal rate label", () => {
  expect(convertAmount(155000, "NGN", "USD")).toBe(100);
  expect(convertAmount(100, "USD", "NGN")).toBe(155000);
  expect(convertAmount(1000, "GBP", "EUR")).toBe(1176);
  expect(fxRateLabel("NGN", "USD")).toBe("1 NGN = 0.0006 USD");
  expect(fxRateLabel("USD", "NGN")).toBe("1 USD = 1,550 NGN");
  expect(fmtCurrency(3026, "USD")).toBe("$30.26 USD");
});

test("Max: the whole NGN balance while the fee is undecided; otherwise room for the fee, as in the reference", () => {
  expect(maxPayout("NGN", other, "standard", 5000000)).toBe(5000000);
  expect(maxPayout("NGN", self, "instant", 5000000)).toBe(5000000);
  expect(maxPayout("USD", other, "standard", 10000)).toBe(9900);
  expect(maxPayout("USD", self, "instant", 10000)).toBe(9852);
  expect(maxPayout("USD", self, "standard", 10000)).toBe(10000);
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

test("store: the PIN reserves the amount; a first payment to an account stays reserved (held)", async () => {
  const p = () => usePayout.getState();
  p().seedPin("1234");
  p().open("NGN");
  p().selectRecipient(p().recipients.find((r) => r.id === "r6")!);
  for (const k of "500000") p().key(k);
  p().setAck(true);
  p().confirm();
  expect(p().pinStage).toBe("entry");
  await p().pinComplete("1234");
  expect(p().stage).toBe("done");
  expect(p().lastRef).toMatch(/^TXN-\d{6}$/);
  expect(p().sent?.status).toBe("held"); // Ngozi Eze has never been paid
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

test("NGN: one speed, Nigerian bank accounts only, no conversion", () => {
  const all = listPayoutRecipients();
  expect(recipientsFor(all, "NGN").map((r) => r.id)).toEqual(["lb2", "r6"]);
  expect(recipientsFor(all, "USD")).toHaveLength(all.length);
  expect(hasSpeeds("NGN")).toBe(false);
  expect(hasSpeeds("USD")).toBe(true);
  expect(payoutEta("NGN", self, "instant")).toBe("Usually within seconds");
  expect(payoutEta("USD", self, "standard")).toBe("1-3 business days");
  const usd = all.find((r) => r.id === "r4")!;
  expect(isCrossBorder("NGN", usd)).toBe(false);
  expect(isCrossBorder("GBP", usd)).toBe(true);
});

test("reservations: sent settles, a first NGN payment is held, a mismatched reservation is refused", async () => {
  const { reservePayout, createPayout, releaseReservation } = await import("@/lib/mock-api");
  const a = await reservePayout({ currency: "NGN", amount: 100000 });
  expect(a.status).toBe("reserved");
  expect((await createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "lb2", reservationId: a.id })).status).toBe("sent"); // paid before
  const b = await reservePayout({ currency: "NGN", amount: 100000 });
  expect((await createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "r6", reservationId: b.id })).status).toBe("held"); // first payment
  const c = await reservePayout({ currency: "NGN", amount: 100000 });
  expect((await createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "r6", reservationId: c.id })).status).toBe("sent"); // paid now
  await expect(createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "r6", reservationId: c.id })).rejects.toThrow("invalid_reservation"); // used
  const d = await reservePayout({ currency: "NGN", amount: 100000 });
  await expect(createPayout({ currency: "NGN", amount: 99999, fee: 0, recipientId: "r6", reservationId: d.id })).rejects.toThrow("invalid_reservation");
  await releaseReservation(d.id);
  await expect(createPayout({ currency: "NGN", amount: 100000, fee: 0, recipientId: "r6", reservationId: d.id })).rejects.toThrow("invalid_reservation");
});
