import type { Page } from "@playwright/test";

/**
 * Send’s amount keypad is hidden until You send’s amount is tapped: press a key (a digit or "back"), opening the
 * keypad first when it’s hidden.
 */
export async function press(page: Page, key: string) {
  if (!(await page.locator("#sendKeypad").isVisible())) await page.locator("#youSend").click();
  await page.locator(`#sendKeypad [data-payoutkey="${key}"]`).click();
}

/** Convert’s keypad works the same way: hidden until the amount to convert is tapped. */
export async function cvPress(page: Page, key: string) {
  if (!(await page.locator("#cvKeypad").isVisible())) await page.locator("#cvFromAmt").click();
  await page.locator(`#cvKeypad [data-cvkey="${key}"]`).click();
}

/** The wallet's amount field (features/wallet/AmountField.tsx): its amount, its keypad and its keys' data attribute. */
export type AmountFieldIds = { amount: string; keypad: string; key: string };
export const NGN_TOPUP: AmountFieldIds = { amount: "ngnAmt", keypad: "ngnKeypad", key: "ngnkey" };
export const CARD_TOPUP: AmountFieldIds = { amount: "cardFundAmt", keypad: "cardFundKeypad", key: "fundkey" };

/**
 * Type an amount in minor units on an amount field ("2500000" is 25,000.00), opening its keypad first when hidden.
 * With `clear`, delete what's there first.
 */
export async function typeAmount(page: Page, f: AmountFieldIds, digits: string, clear = false) {
  if (!(await page.locator(`#${f.keypad}`).isVisible())) await page.locator(`#${f.amount}`).click();
  if (clear) for (let i = 0; i < 14 && (await page.locator(`#${f.amount}`).innerText()).trim() !== "0.00"; i++) await page.locator(`#${f.keypad} [data-${f.key}="back"]`).click();
  for (const d of digits) await page.locator(`#${f.keypad} [data-${f.key}="${d}"]`).click();
}
