import { test, expect, type Page } from "@playwright/test";
import { cvPress } from "./keypad";

/**
 * Fees (lib/fees.ts; docs/decisions.md, Fees): deposits 0.40% capped ($4.00, ₦5,000.00) out of what arrives; Convert
 * $2.00 + 0.40% from USD or a stablecoin, ₦2,000.00 + 0.40% from NGN, out of the amount in the source; sends to
 * external accounts $6.00 / 6.00 in the coin / ₦25.00 on top; to CentryLink users free. In every total, Max and balance.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
test("mock: the fees", async () => {
  const f = await import("@/lib/fees");
  expect(f.depositFee(1000000, "NGN")).toBe(4000); // ₦10,000.00: ₦40.00
  expect(f.depositFee(200000000, "NGN")).toBe(500000); // ₦2,000,000.00: capped at ₦5,000.00
  expect(f.depositFee(100000, "USD")).toBe(400); // $1,000.00: capped at $4.00
  expect(f.depositFee(50000, "USD")).toBe(200);
  expect(f.depositFeeText("NGN")).toBe("0.40% fee, up to ₦5,000.00");
  expect(f.depositFeeText("USD")).toBe("0.40% fee, up to $4.00");

  const cv = await import("@/features/wallet/convert/convertMath");
  const q = (from: string, to: string, amt: number) => cv.cvQuote(from, to, amt, 1);
  expect(q("cash:NGN:open", "cash:USD:open", 1000000)).toMatchObject({ fee: 204000, receive: 514 }); // ₦2,000.00 + ₦40.00
  expect(q("cash:USD:open", "coin:USDC:Base", 10000)).toMatchObject({ fee: 240, receive: 9760 }); // $2.00 + $0.40
  expect(q("coin:USDT:Base", "coin:USDC:Base", 10000)).toMatchObject({ fee: 240, receive: 9760 }); // 2.00 USDT + 0.40 USDT
  // EUR, GBP and GHS (to confirm): the dollar fees at the demo rates
  expect(q("cash:EUR:open", "cash:USD:open", 10000)).toMatchObject({ fee: 185 + 40 }); // €1.85 + 0.40%
  expect(f.convertFeeSpec({ k: "cash", cur: "GBP" })).toEqual({ pct: 0.004, flat: 157 }); // £1.57
  expect(f.convertFeeSpec({ k: "cash", cur: "GHS" })).toEqual({ pct: 0.004, flat: 3100 }); // GH₵31.00
  expect([f.externalSendFee({ k: "cash", cur: "EUR" }), f.externalSendFee({ k: "cash", cur: "GBP" }), f.externalSendFee({ k: "cash", cur: "GHS" })]).toEqual([556, 472, 9300]);
  expect([f.depositCap("EUR"), f.depositCap("GBP"), f.depositCap("GHS")]).toEqual([370, 315, 6200]);
  expect([f.depositFeeText("EUR"), f.depositFeeText("GBP")]).toEqual(["0.40% fee, up to €3.70", "0.40% fee, up to £3.15"]);
  // A CentryLink user's conversion on receipt: free
  expect(cv.cvQuote("cash:NGN:open", "cash:USD:open", 500000, 1, true)).toMatchObject({ fee: 0, receive: 323 });
  expect(cv.cvFeeText(cv.cvQuote("cash:NGN:open", "cash:USD:open", 500000, 1, true))).toBe("Free");
  expect(cv.underFee(q("cash:NGN:open", "cash:USD:open", 200000))).toBe(true);
  expect(cv.cvFeeText(q("cash:NGN:open", "cash:USD:open", 0))).toBe("₦2,000.00 + 0.40%");

  const { sendSummary } = await import("@/features/wallet/send/sendSummary");
  const { listPayoutRecipients } = await import("@/lib/mock-api");
  const r = (id: string) => listPayoutRecipients().find((x) => x.id === id)!;
  expect(sendSummary(r("lb2"), "cash:NGN:open", 500000, 500000, 1)).toMatchObject({ feeTarget: 2500, feeText: "₦25.00 NGN", sourceTotal: 502500, totalText: "₦5,025.00 NGN" });
  expect(sendSummary(r("lb1"), "cash:USD:open", 1000, 1000, 1)).toMatchObject({ feeTarget: 600, feeText: "$6.00 USD", sourceTotal: 1600 });
  const poket = { id: "pu4", name: "Amara Okafor", methodType: "poket", currency: "NGN", bankName: "", accountNumber: "", routingNumber: "", handle: "@amara" } as any;
  expect(sendSummary(poket, "cash:NGN:open", 500000, 500000, 1)).toMatchObject({ feeTarget: 0, feeText: "Free", sourceTotal: 500000 });
  // To a CentryLink user who can't hold naira: converted on receipt, still free
  const usdPoket = { ...poket, id: "pu5", name: "Daniel Cho", currency: "USD" };
  expect(sendSummary(usdPoket, "cash:NGN:open", 500000, 323, 1)).toMatchObject({ feeTarget: 0, feeText: "Free", sourceTotal: 500000 });
  // A UK bank (to confirm): $6.00 at the demo rate, £4.72
  const uk = { id: "uk1", name: "Oliver Smith", methodType: "bank", currency: "GBP", bankName: "Barclays", accountNumber: "12345678", routingNumber: "" } as any;
  expect(sendSummary(uk, "cash:GBP:open", 10000, 10000, 1)).toMatchObject({ feeTarget: 472, feeText: "£4.72 GBP", sourceTotal: 10472 });
  const wallet = { id: "sw1", name: "Ledger", methodType: "wallet", currency: "USD", asset: "USDC", network: "Base", walletAddress: "0x" + "a".repeat(40), bankName: "", accountNumber: "", routingNumber: "" } as any;
  expect(sendSummary(wallet, "coin:USDC:Base", 1000, 1000, 1)).toMatchObject({ feeTarget: 600, feeText: "6.00 USDC", sourceTotal: 1600, totalText: "16.00 USDC" });
});

async function wallet(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
}

test("deposit: the amount screen shows the fee and what you get; the account cards say the fee", async ({ page }) => {
  await page.goto("/demo/wallet?ngn=tempAmount");
  await page.waitForFunction(() => !!(window as any).__ngn);
  await page.locator("#ngnAmt").fill("25000");
  await expect(page.locator("#ngnTempFee .receipt-row")).toHaveText(["Fee₦100.00 NGN", "You get₦24,900.00 NGN"]);
  await wallet(page);
  await page.getByLabel("Tier").selectOption("1");
  await page.locator('[data-holdcur="NGN"][data-holdbucket="open"] .tx-title').click();
  await expect(page.locator("#vaOpen .t2")).toHaveText("Receive NGN by bank transfer. 0.40% fee, up to ₦5,000.00.");
});

test("send: the fee on the amount screen, in Max and the total; a CentryLink user is free", async ({ page }) => {
  await wallet(page);
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  await expect(page.locator("#sendFee")).toHaveText("₦25.00 NGN");
  await page.locator("#payoutMaxAmt").click();
  await expect(page.locator("#youSend")).toHaveText("49,975.00"); // ₦50,000.00 less the fee
  await page.locator("#payoutReview").click();
  await expect(page.locator("#panelBody .receipt-row").filter({ hasText: "Debited from balance" }).locator(".r-value")).toHaveText("₦50,000.00 NGN"); // your own account
});

test("convert: the fee before and after an amount; too small for the fee says so", async ({ page }) => {
  await wallet(page);
  await page.getByLabel("Tier").selectOption("1");
  // From the NGN balance
  await page.locator('[data-holdcur="NGN"][data-holdbucket="open"] .tx-title').click();
  await page.locator("#detailConvert").click();
  await expect(page.locator(".cv-meta")).toContainText("Fee: ₦2,000.00 + 0.40%");
  for (const d of "150000") await cvPress(page, d); // ₦1,500.00
  await expect(page.locator("#cvHint")).toHaveText("That’s no more than the ₦1,500.00 fee. Enter a larger amount.");
  await expect(page.locator("#cvReview")).toBeDisabled();
  for (let i = 0; i < 6; i++) await cvPress(page, "back");
  for (const d of "1000000") await cvPress(page, d); // ₦10,000.00
  await expect(page.locator(".cv-meta")).toContainText("Fee: ₦2,040.00 NGN");
  await expect(page.locator("#cvToAmt")).toHaveText("≈ 5.14");
});

test("the EUR, GBP and GHS account cards say their deposit fee (to confirm)", async ({ page }) => {
  await wallet(page);
  for (const [cur, text] of [["EUR", "Receive EUR by SEPA or SEPA Instant. 0.40% fee, up to €3.70."], ["GBP", "Receive GBP by Faster Payments or Bacs. 0.40% fee, up to £3.15."], ["GHS", "Receive GHS by GhIPSS bank transfer. 0.40% fee, up to GH₵62.00."]]) {
    await page.locator(`[data-holdcur="${cur}"][data-holdbucket="open"] .tx-title`).click();
    await expect(page.locator("#vaOpen .t2")).toHaveText(text);
    await page.locator("#backFromDetail").click();
  }
});
