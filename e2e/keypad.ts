import type { Page } from "@playwright/test";

/**
 * Send's amount keypad is hidden until You send's amount is tapped: press a key (a digit or "back"), opening the
 * keypad first when it's hidden.
 */
export async function press(page: Page, key: string) {
  if (!(await page.locator("#sendKeypad").isVisible())) await page.locator("#youSend").click();
  await page.locator(`#sendKeypad [data-payoutkey="${key}"]`).click();
}
