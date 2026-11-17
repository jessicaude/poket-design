import { test, expect, type Page } from "./fixtures";

/**
 * The wallet's one amount field (features/wallet/AmountField.tsx), wherever money is entered: Send's You send,
 * Convert's From, the instant transfer daily limit, the card top-up and "Add naira". Each is the same box: the label,
 * the currency chip with its flag, the amount in the wallet's amount style; tapping the amount opens the keypad under
 * it, with Done. Open, the keypad docks at the bottom of the panel above the tab bar, the screen's button directly
 * above it; closed, the button is back under the fee or quote card.
 */

type Field = { name: string; open: (page: Page) => Promise<void>; box: string; amount: string; keypad: string; done: string; cur: string; action: string };
const FIELDS: Field[] = [
  { name: "Send: You send", box: "youSendBox", amount: "youSend", keypad: "sendKeypad", done: "keypadDone", cur: "NGN", action: "payoutReview",
    open: async (page) => { await page.goto("/demo/wallet"); await page.locator("#actSend").click(); await page.locator('[data-sendrecipient="bank:lb2"]').click(); } },
  { name: "Convert: From", box: "cvFromBox", amount: "cvFromAmt", keypad: "cvKeypad", done: "cvKeypadDone", cur: "USD", action: "cvReview",
    open: async (page) => { await page.goto("/demo/wallet?convert=form"); } },
  { name: "Instant transfers: Daily limit", box: "instantLimitBox", amount: "instantLimitAmt", keypad: "limitKeypad", done: "limitKeypadDone", cur: "NGN", action: "instantLimitSave",
    open: async (page) => { await page.goto("/demo/wallet"); await page.locator("#openSettingsHeader").click(); await page.locator("#openInstantTransfers").click(); await page.locator("#instantChange").click(); } },
  { name: "Deposit: card top-up", box: "cardFundBox", amount: "cardFundAmt", keypad: "cardFundKeypad", done: "cardFundKeypadDone", cur: "USD", action: "cardFundAmtContinue",
    open: async (page) => { await page.goto("/demo/wallet"); await page.getByLabel("Tier").selectOption("3"); await page.locator("#actDeposit").click(); await page.locator('[data-depositcash="USD"]').click(); await page.locator("#dmCard").click(); } },
  { name: "NGN: Add naira", box: "ngnAmtBox", amount: "ngnAmt", keypad: "ngnKeypad", done: "ngnKeypadDone", cur: "NGN", action: "ngnTempGo",
    open: async (page) => { await page.goto("/demo/wallet?ngn=tempAmount"); } },
];

/** The amount's style, to compare across screens. */
const style = (page: Page, id: string) => page.locator(`#${id}`).evaluate((el) => { const s = getComputedStyle(el); return [s.fontSize, s.fontWeight, s.fontFamily].join(" "); });

for (const f of FIELDS) {
  test(`${f.name}: the shared amount field (chip with flag, the amount, the keypad on tap with Done)`, async ({ page }) => {
    await f.open(page);
    const box = page.locator(`#${f.box}`);
    await expect(box).toHaveClass(/\bcv-box\b/);
    await expect(box.locator(".cv-box-top > span").first()).not.toBeEmpty();
    await expect(box.locator(".cv-box-row .cv-pick svg").first()).toBeVisible();
    await expect(box.locator(".cv-box-row .cv-pick-name")).toContainText(f.cur);
    await expect(page.locator(`#${f.amount}`)).toHaveClass(/\bcv-amt\b/);
    await expect(page.locator(`#${f.amount}`)).toHaveAttribute("role", "button");
    // The keypad: hidden until the amount is tapped; Done hides it again
    await expect(page.locator(`#${f.keypad}`)).toHaveCount(0);
    await expect(page.locator(`#${f.amount}`)).toHaveAttribute("aria-expanded", "false");
    await page.locator(`#${f.amount}`).click();
    await expect(page.locator(`#${f.keypad} .keypad-key`)).toHaveCount(12);
    await expect(page.locator(`#${f.amount}`)).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator(`#${f.done}`)).toHaveText("Done");
    // Docked: the button and the keypad at the bottom of the panel, just above the tab bar, the button directly
    // above the keypad; nothing needs scrolling to reach them, and the amount stays in view above
    const dock = page.locator("#panelDock");
    await expect(dock.locator(`#${f.keypad}`)).toBeVisible();
    await expect(dock.locator(`#${f.action}`)).toBeVisible();
    await expect(page.locator(`#panelBody #${f.action}`)).toHaveCount(0);
    const d = (await dock.boundingBox())!, tab = (await page.locator("#tabbar").boundingBox())!;
    expect(Math.abs(d.y + d.height - tab.y)).toBeLessThanOrEqual(1);
    const btn = (await page.locator(`#${f.action}`).boundingBox())!, pad = (await page.locator(`#${f.keypad}`).boundingBox())!;
    expect(btn.y + btn.height).toBeLessThanOrEqual(pad.y);
    expect(pad.y - (btn.y + btn.height)).toBeLessThanOrEqual(40); // only the keypad's Done row between them
    await expect(page.locator(`#${f.action}`)).toBeInViewport();
    await expect(page.locator(`#${f.keypad} .keypad-key`).last()).toBeInViewport();
    const body = (await page.locator("#panelBody").boundingBox())!, amt = (await page.locator(`#${f.amount}`).boundingBox())!;
    expect(amt.y).toBeGreaterThanOrEqual(body.y - 1);
    expect(amt.y + amt.height).toBeLessThanOrEqual(body.y + body.height + 1);
    // A key press keeps it open (the dock counts as inside the field)
    await page.locator(`#${f.keypad} .keypad-key`).first().click();
    await expect(page.locator(`#${f.keypad}`)).toBeVisible();
    // Done: the dock empties and the button is back under the fee card
    await page.locator(`#${f.done}`).click();
    await expect(page.locator(`#${f.keypad}`)).toHaveCount(0);
    await expect(dock).toBeHidden();
    await expect(page.locator(`#panelBody #${f.action}`)).toBeVisible();
  });
}

test("every amount field has the same amount style", async ({ page }) => {
  const styles: string[] = [];
  for (const f of FIELDS) { await f.open(page); await expect(page.locator(`#${f.amount}`)).toBeVisible(); styles.push(await style(page, f.amount)); }
  expect(new Set(styles).size).toBe(1);
});
