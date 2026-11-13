import { test, expect, type Page } from "@playwright/test";

/**
 * docs/copy.md applied: notifications follow the pattern (2 to 4 words, past tense; one sentence with the amount and
 * who, no currency code in running text), the ID terms keep short lines with "What's this?" for the full definition,
 * money-moving buttons carry the amount, and paused, error and done copy say what to do.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
async function wallet(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
}
const notes = (page: Page) => page.locator("#panelBody [data-notif]");

test("notifications follow the pattern: a short past-tense title, one sentence with the amount and who", async ({ page }) => {
  await wallet(page);
  // A temporary-account top-up (new), a transfer to the account details, naira from a Poket user, a delayed transfer
  await page.evaluate(async () => { const s = (window as any).__ngn.getState(); await s.createTemp(1000000); await s.transferArrives(); (window as any).__ngn.getState().close(); });
  await page.evaluate(() => (window as any).__ngn.getState().set({ dedicated: { status: "ready", num: "0123456789" } }));
  await page.locator("#demoAccountTransfer").click();
  await page.locator("#demoPoketTransfer").click();
  await page.getByLabel("Naira partner").selectOption("down");
  await page.locator("#demoQueuedArrival").click();
  await page.getByLabel("Naira partner").selectOption("up");
  await page.locator("#openNotifHeader").click();
  await expect(notes(page)).toHaveCount(4);
  const titles = await page.locator("#panelBody .settings-row-title > span:first-child").allTextContents();
  const bodies = await page.locator("#panelBody .settings-row-sub").allTextContents();
  expect(bodies).toEqual([
    "₦25,000.00 from Chinedu Eze added to your NGN balance, after a delay.",
    "₦10,000.00 from Amara Okafor added to your NGN balance.",
    "₦25,000.00 from Chinedu Eze added to your NGN balance.",
    "₦10,000.00 added to your NGN balance.", // the top-up: from your own bank
  ]);
  for (const t of titles) {
    expect(t.split(" ").length).toBeGreaterThanOrEqual(2);
    expect(t.split(" ").length).toBeLessThanOrEqual(4);
    expect(t).not.toMatch(/[:—]/);
  }
  for (const b of bodies) {
    expect(b.match(/\.(\s|$)/g)).toHaveLength(1); // one sentence
    expect(b).toMatch(/₦[\d,]+\.\d{2}/);
    expect(b).not.toMatch(/₦[\d,]+\.\d{2} NGN/); // running text drops the code
  }
});

test("NGN ID entry: a short line, and What’s this? with the full definition", async ({ page }) => {
  await page.goto("/demo/wallet?ngn=deposit-method");
  await page.waitForFunction(() => !!(window as any).__ngn);
  await page.evaluate(() => (window as any).__ngn.getState().set({ tier: 1 }));
  const cases: [string, string, string, string][] = [
    ["bvn", "Bank Verification Number, 11 digits.", "What’s a BVN?", "Bank Verification Number. The 11-digit number your bank gave you to confirm who you are. Dial *565*0# from the phone number linked to your bank to see it."],
    ["nin", "National Identification Number, 11 digits.", "What’s a NIN?", "National Identification Number. The 11-digit number on your NIN slip or national ID card."],
    ["nrbvn", "BVN for Nigerians living abroad, 11 digits.", "What’s an NRBVN?", "BVN for Nigerians living abroad."],
  ];
  for (const [route, line, title, body] of cases) {
    await page.evaluate((r) => (window as any).__ngn.getState().chooseRoute(r), route);
    await expect(page.locator("#panelBody .step-sub")).toHaveText(line);
    await expect(page.locator("#ngnIdHelp")).toHaveCount(0);
    await page.locator("#ngnIdWhat").click();
    await expect(page.locator("#ngnIdHelp [role=dialog]")).toBeVisible();
    await expect(page.locator("#ngnIdHelpTitle")).toHaveText(title);
    await expect(page.locator("#ngnIdHelpBody")).toHaveText(body);
    await page.locator(route === "nin" ? "#ngnIdHelpClose" : "#ngnIdHelpDone").click();
    await expect(page.locator("#ngnIdHelp")).toHaveCount(0);
  }
});

test("Convert's button carries the amount; the hint says what to do", async ({ page }) => {
  await wallet(page);
  await page.evaluate(() => (window as any).__holdings.getState().set({ cash: { USD: 1560, EUR: 0, GBP: 0, GHS: 0 } }));
  await page.getByLabel("Tier").selectOption("1");
  await page.locator("#actConvert").click();
  await expect(page.locator("#cvToAmt")).toHaveText("0.00");
  for (const d of "1000000") await page.locator(`[data-cvkey="${d}"]`).click();
  await page.locator("#cvReview").click();
  await expect(page.locator("#cvConfirm")).toHaveText("Convert ₦10,000.00");
});

test("a send's done screen: We’ve emailed you a receipt", async ({ page }) => {
  await wallet(page);
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  await page.locator("#youSend").click();
  for (const d of "500000") await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await expect(page.locator("#confirmPayout")).toHaveText("Send ₦5,000.00");
  await page.locator("#confirmPayout").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#panelBody .fine-print")).toHaveText("We’ve emailed you a receipt.");
});

test("Checkout: while the naira partner is down, bank transfer says what to do instead", async ({ page }) => {
  await page.goto("/demo/ile-living");
  await page.getByLabel("Order currency").selectOption("NGN");
  await page.getByLabel("Naira partner").selectOption("down");
  await page.getByLabel("Customer", { exact: true }).selectOption("returning");
  await page.locator("#payWithPoket").click();
  const widget = page.getByTestId("checkout-widget");
  await widget.locator(".add").click();
  const bank = widget.locator('[data-addpm="ngn-bank"]');
  await expect(bank.locator("#ngnBankPaused")).toHaveText("Paused");
  await expect(bank.locator("small")).toHaveText("Paused for now. Pay by card instead.");
});
