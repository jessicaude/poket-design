import { type Page } from "@playwright/test";

/**
 * A first payment of $500 or more (USD value leaving the balance) to a new recipient is held for [hold]. For naira to a
 * Nigerian bank that's ₦775,000 or more, so: Tier 1, ₦1,000,000.00 in the NGN balance and a ₦1,000,000.00 daily
 * limit. Send ₦800,000.00 (HELD_NGN_DIGITS): with the ₦25.00 fee, ₦800,025.00 (about $516) leaves the balance.
 */
export const HELD_NGN_DIGITS = "80000000";
export const HELD_NGN_BALANCE = 100000000;
export async function roomForHeldNaira(page: Page) {
  await page.getByLabel("Tier").selectOption("1");
  await page.evaluate((b) => {
    const w = window as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    w.__ngn.setState({ ngnBalance: b });
    w.__settings.setState({ instantLimit: b });
  }, HELD_NGN_BALANCE);
}
