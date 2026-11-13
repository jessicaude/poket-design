import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

/**
 * Share receipt on every naira transaction’s detail: a sheet with the receipt (amount, status, date and time, to or
 * from, account, fee as ₦[fee], reference; the wallet’s look and brand, "Payments by Poket"), and Share (native
 * share where available, else the text copied), Download PDF and Download image. A transaction that isn’t done says
 * so on the receipt.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
async function wallet(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
}
/** A ₦5,000.00 send to the Naira account (paid before: Sending at once), on its detail. */
async function sent(page: Page) {
  await wallet(page);
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  await page.locator("#youSend").click();
  for (const d of "500000") await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toBeVisible();
}
const sheet = (page: Page) => page.locator("#receiptSheet");
const rcRow = (page: Page, label: string) => page.locator(`#receiptCard .rc-row[data-label="${label}"] > span:last-child`);
async function openSheet(page: Page) {
  await page.locator("#shareReceipt").click();
  await expect(sheet(page)).toBeVisible();
}
async function reopen(page: Page) {
  await page.locator("#receiptClose").click();
  await expect(sheet(page)).toHaveCount(0);
  await openSheet(page);
}

test("a paid send’s receipt: amount, status, date and time, to, account, fee ₦[fee], reference; Payments by Poket", async ({ page }) => {
  test.setTimeout(60000);
  await sent(page);
  await page.getByRole("button", { name: "Mark paid" }).click();
  const ref = (await page.locator("#copyRefBtn").textContent())!.trim();
  await openSheet(page);
  await expect(sheet(page).locator(".rc-sheet-head b")).toHaveText("Share receipt");
  await expect(page.locator("#receiptBrand")).toHaveAttribute("data-brand", "poket");
  await expect(page.locator("#receiptBrand svg.brand-lockup")).toHaveCount(1);
  await expect(page.locator("#receiptAmount")).toHaveText("₦5,000.00 NGN");
  await expect(page.locator("#receiptTitle")).toHaveText("To Naira account");
  await expect(page.locator("#receiptStatus")).toHaveText("Paid");
  await expect(page.locator("#receiptNotice")).toHaveCount(0);
  // A send to a Nigerian bank: the bank’s Session ID after the Reference
  await expect(page.locator("#receiptCard .rc-row > span:first-child")).toHaveText(["Date and time", "To", "Account", "Fee", "Reference", "Session ID"]);
  await expect(rcRow(page, "Session ID")).toHaveText("[session ID]");
  await expect(rcRow(page, "Date and time")).toHaveText(/^\d{2} [A-Z][a-z]{2}, \d{4}, \d{1,2}:\d{2} [AP]M/);
  await expect(rcRow(page, "To")).toHaveText("Naira account");
  await expect(rcRow(page, "Account")).not.toBeEmpty();
  await expect(rcRow(page, "Fee")).toHaveText("₦[fee]");
  await expect(rcRow(page, "Reference")).toHaveText(ref);
  await expect(page.locator("#receiptFooter")).toHaveText("Payments by Poket");
  await expect(sheet(page).locator("button")).toContainText(["Share", "Download PDF", "Download image"]);
  // Escape closes it
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toHaveCount(0);
});

test("pending, held and failed sends say so on the receipt", async ({ page }) => {
  test.setTimeout(60000);
  await sent(page);
  await openSheet(page);
  await expect(page.locator("#receiptStatus")).toHaveText("Sending");
  await expect(page.locator("#receiptNotice")).toHaveText("Pending: on its way. It hasn’t arrived yet.");
  await expect(page.locator("#receiptNotice")).toHaveClass(/\bwarn\b/);
  await page.getByRole("button", { name: "Hold for review" }).click();
  await reopen(page);
  await expect(page.locator("#receiptStatus")).toHaveText("Held for review");
  await expect(page.locator("#receiptNotice")).toHaveText("Held for review. We’re checking this payment. We’ll let you know.");
  await page.getByRole("button", { name: "Fail" }).click();
  await reopen(page);
  await expect(page.locator("#receiptStatus")).toHaveText("Failed");
  await expect(page.locator("#receiptNotice")).toHaveText("Failed: this payment wasn’t sent. The money was returned to your balance.");
  await expect(page.locator("#receiptNotice")).toHaveClass(/\berr\b/);
  // The notice is in what’s shared too (no native share here: copied)
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  await page.locator("#receiptShare").click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.split("\n").slice(0, 3)).toEqual(["Poket receipt", "Failed", "Failed: this payment wasn’t sent. The money was returned to your balance."]);
});

test("Share: the native share sheet where there is one; else the text summary is copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await wallet(page);
  await page.locator("#demoPoketTransfer").click();
  await page.locator('[data-wallettab="cash"]').click();
  await page.locator('[data-holdcur="NGN"][data-holdbucket="open"] .tx-title').click();
  await page.locator('#ngnHistory [data-credit="poket"]').click();
  const ref = (await page.locator("#copyRefBtn").textContent())!.trim();
  await openSheet(page);
  await expect(page.locator("#receiptTitle")).toHaveText("From Amara Okafor");
  // From a Poket user: not a bank transfer, so no Session ID
  await expect(page.locator("#receiptCard .rc-row > span:first-child")).toHaveText(["Date and time", "From", "Account", "Fee", "Reference"]);
  await expect(rcRow(page, "Account")).toHaveText("Poket");
  await expect(rcRow(page, "Fee")).toHaveText("Free");

  // Native share
  await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: async (d: unknown) => { (window as any).__shared = d; } }));
  await page.locator("#receiptShare").click();
  const shared = await page.evaluate(() => (window as any).__shared);
  expect(shared.title).toBe(`Receipt ${ref}`);
  expect(shared.text.split("\n")).toEqual([
    "Poket receipt", "Completed", "", "₦10,000.00 NGN", "From Amara Okafor", "",
    expect.stringMatching(/^Date and time: \d{2} [A-Z][a-z]{2}, \d{4}/), "From: Amara Okafor", "Account: Poket", "Fee: Free", `Reference: ${ref}`, "", "Payments by Poket",
  ]);
  // No native share: copied
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  await page.locator("#receiptShare").click();
  await expect(page.locator("#toastEl")).toContainText("Receipt copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shared.text);
});

test("Download PDF and Download image: the receipt as a file", async ({ page }) => {
  await wallet(page);
  await page.locator("#tabActivity").click();
  await page.locator('[data-payment="pay_mtk2291"]').click();
  await openSheet(page);
  await expect(page.locator("#receiptAmount")).toHaveText("₦65,100.00 NGN");
  await expect(rcRow(page, "To")).toHaveText("Mama Tee’s Kitchen");
  await expect(rcRow(page, "Account")).toHaveText("Verve ••• 6011");
  await expect(rcRow(page, "Reference")).toHaveText("pay_mtk2291");

  const [pdf] = await Promise.all([page.waitForEvent("download"), page.locator("#receiptPdf").click()]);
  expect(pdf.suggestedFilename()).toBe("receipt-pay_mtk2291.pdf");
  const bytes = readFileSync((await pdf.path())!);
  const s = bytes.toString("latin1");
  expect(s.startsWith("%PDF-1.4")).toBe(true);
  expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
  expect(s).toContain("/Filter /DCTDecode");
  expect(s).toContain("/Title (Receipt pay_mtk2291)");
  // The xref points at each object
  const startxref = Number(/startxref\n(\d+)/.exec(s)![1]);
  expect(s.slice(startxref, startxref + 4)).toBe("xref");
  const offsets = s.slice(startxref).split("\n").slice(3, 9).map((l) => Number(l.slice(0, 10)));
  offsets.forEach((o, i) => expect(s.slice(o, o + 7)).toBe(`${i + 1} 0 obj`));
  // The receipt’s text, as the Subject (UTF-16)
  const hex = /\/Subject <FEFF([0-9A-F]+)>/.exec(s)![1];
  const subject = String.fromCharCode(...hex.match(/.{4}/g)!.map((h) => parseInt(h, 16)));
  expect(subject).toContain("₦65,100.00 NGN");
  expect(subject).toContain("Reference: pay_mtk2291");
  expect(subject).toContain("Payments by Poket");
  expect(subject).not.toContain("Session ID"); // paid by card
  await expect(page.locator("#toastEl")).toHaveText("PDF downloaded");

  const [png] = await Promise.all([page.waitForEvent("download"), page.locator("#receiptImage").click()]);
  expect(png.suggestedFilename()).toBe("receipt-pay_mtk2291.png");
  const img = readFileSync((await png.path())!);
  expect([...img.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(img.readUInt32BE(16)).toBe(720); // 360 wide, at 2x
  expect(img.readUInt32BE(20)).toBeGreaterThan(600);
});

test("white-label: the merchant’s name and colours, still Payments by Poket", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await wallet(page);
  await page.getByLabel("Brand").selectOption("merchant");
  await page.locator("#tabActivity").click();
  await page.locator('[data-payment="pay_ilv10077"]').click();
  await openSheet(page);
  await expect(page.locator("#receiptBrand")).toHaveAttribute("data-brand", "merchant");
  await expect(page.locator("#receiptBrand")).toHaveText("Ilé Living");
  await expect(page.locator("#receiptCard")).toHaveCSS("border-top-color", "rgb(47, 107, 79)");
  await expect(page.locator("#receiptFooter")).toHaveText("Payments by Poket");
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
  await page.locator("#receiptShare").click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.split("\n")[0]).toBe("Ilé Living receipt");
  expect(text.split("\n").at(-1)).toBe("Payments by Poket");
  // A checkout bank transfer: the Session ID after the Reference, on the receipt and in the text
  await expect(page.locator("#receiptCard .rc-row > span:first-child")).toHaveText(["Date and time", "To", "Account", "Fee", "Reference", "Session ID"]);
  const lines = text.split("\n");
  expect(lines[lines.indexOf("Reference: pay_ilv10077") + 1]).toBe("Session ID: [session ID]");
});

test("every naira transaction has Share receipt; dollar ones don’t; a dispute’s hold is on the receipt", async ({ page }) => {
  await wallet(page);
  await page.locator("#tabActivity").click();
  // A dollar payment and the reference’s dollar records: no
  await page.locator('[data-payment="pay_a9d2c7ke"]').click();
  await expect(page.locator("#extRaiseDispute, #disputeClosed").first()).toBeVisible();
  await expect(page.locator("#shareReceipt")).toHaveCount(0);
  await page.locator("#backFromTxDetail").click();
  await page.locator('[data-txid="t1"]').click();
  await expect(page.locator("#txDetail")).toBeVisible();
  await expect(page.locator("#shareReceipt")).toHaveCount(0);
  await page.locator("#backFromTxDetail").click();
  // A naira refund (to the NGN balance)
  await page.locator('[data-payment="pay_ilv10077"]').click();
  await page.locator("#demoRefundFull").click();
  await page.locator("#backFromTxDetail").click();
  await page.locator("[data-refund]").first().click();
  await openSheet(page);
  await expect(page.locator("#receiptTitle")).toHaveText("Refund · Ilé Living");
  await expect(rcRow(page, "From")).toHaveText("Ilé Living");
  await expect(rcRow(page, "Account")).toHaveText("NGN balance");
  await expect(rcRow(page, "Fee")).toHaveText("₦[fee]");
  await page.locator("#receiptClose").click();
  await page.locator("#backFromTxDetail").click();
  // A disputed naira payment: held, said on the receipt
  await page.locator('[data-payment="pay_mtk2291"]').click();
  await page.locator("#extRaiseDispute").click();
  await page.locator("#disputeStart").click();
  await page.getByRole("radio", { name: "Not received" }).click();
  await page.locator("#extDisputeDescription").fill("It never came.");
  await page.locator("#extReviewDispute").click();
  await page.locator("#extSubmitDispute").click();
  await page.locator("#extDisputeDone").click();
  await page.locator('[data-payment="pay_mtk2291"]').click();
  await openSheet(page);
  await expect(page.locator("#receiptStatus")).toHaveText("Dispute open");
  await expect(page.locator("#receiptNotice")).toHaveText("Dispute open: ₦65,100.00 held while we review.");
});

test("a deposit’s receipt has the Session ID after the Reference: in the text, the PDF and the image", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await wallet(page);
  await page.evaluate(() => (window as any).__ngn.getState().set({ dedicated: { status: "ready", num: "0123456789" } }));
  await page.locator("#demoAccountTransfer").click();
  await page.locator("#demoPoketTransfer").click();
  await page.locator('[data-wallettab="cash"]').click();
  await page.locator('[data-holdcur="NGN"][data-holdbucket="open"] .tx-title').click();
  /** A credit’s receipt: its text (copied), its PDF’s Subject and its image’s height. */
  async function files(kind: "account" | "poket") {
    await page.locator(`#ngnHistory [data-credit="${kind}"]:not([data-txid*="seed"])`).click();
    const ref = (await page.locator("#copyRefBtn").textContent())!.trim();
    await openSheet(page);
    const labels = await page.locator("#receiptCard .rc-row > span:first-child").allTextContents();
    await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
    await page.locator("#receiptShare").click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    const [pdf] = await Promise.all([page.waitForEvent("download"), page.locator("#receiptPdf").click()]);
    const s = readFileSync((await pdf.path())!).toString("latin1");
    const hex = /\/Subject <FEFF([0-9A-F]+)>/.exec(s)![1];
    const subject = String.fromCharCode(...hex.match(/.{4}/g)!.map((h) => parseInt(h, 16)));
    const [png] = await Promise.all([page.waitForEvent("download"), page.locator("#receiptImage").click()]);
    const height = readFileSync((await png.path())!).readUInt32BE(20);
    await page.locator("#receiptClose").click();
    await page.locator("#backFromTxDetail").click();
    return { ref, labels, text, subject, height };
  }
  const bank = await files("account"), poket = await files("poket");
  expect(bank.labels).toEqual(["Date and time", "From", "Account", "Fee", "Reference", "Session ID"]);
  for (const t of [bank.text, bank.subject]) {
    const lines = t.split("\n");
    expect(lines[lines.indexOf(`Reference: ${bank.ref}`) + 1]).toBe("Session ID: [session ID]");
  }
  expect(bank.subject).toBe(bank.text);
  // Not a bank transfer: none, anywhere
  expect(poket.labels).not.toContain("Session ID");
  expect(poket.text).not.toContain("Session ID");
  expect(poket.subject).not.toContain("Session ID");
  // The image draws the extra row: one row taller (36px at 2x), the other rows being one line each in both
  expect(bank.height - poket.height).toBe(72);
});
