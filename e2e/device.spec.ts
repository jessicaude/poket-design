import { passSelfie } from "./selfie";
import { test, expect, type Page } from "@playwright/test";

/**
 * WGT-10, device binding. Demo bar "This device: Known / New". On a new device, the first time money moves (any send,
 * or turning on instant transfers), "Confirm this device" asks for a 6-digit code sent to the user's email (Checkout's
 * sign-up code entry; 000000 is wrong). A correct code binds the device ("This device" under Security) and the action
 * carries on. Known devices never see it.
 */

const title = (page: Page) => page.locator("#panelBody .step-title").first();
async function start(page: Page, device: "known" | "new") {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.getByLabel("This device").selectOption(device);
}
/** Send → a recipient → an amount → review → Send. */
async function toSend(page: Page, recipient: string, digits: string) {
  await page.locator("#actSend").click();
  await page.locator(`[data-sendrecipient="${recipient}"]`).click();
  await page.locator("#youSend").click();
  for (const d of digits) await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
}
async function code(page: Page, digits: string) {
  await page.locator("#deviceOtp input").first().click();
  await page.keyboard.type(digits);
}
async function pin(page: Page) {
  await expect(title(page)).toHaveText("Enter your PIN");
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
}
async function devices(page: Page) {
  await page.locator("#openSettingsHeader").click();
  await page.locator("#openSecurity").click();
  return page.locator("#panelBody [data-device] .settings-row-title");
}

test("a known device never sees it: the send goes straight to the PIN", async ({ page }) => {
  await start(page, "known");
  await toSend(page, "bank:lb2", "500000");
  await pin(page);
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
  await page.locator("#payoutDone").click();
  await expect(await devices(page)).toHaveText(["This device", "Chrome · MacBook Air"]);
});

test("a new device: Confirm this device on the first send; a wrong code clears; the right one binds it and the send carries on", async ({ page }) => {
  await start(page, "new");
  await expect(await devices(page)).toHaveText(["Chrome · MacBook Air"]); // not bound yet
  await page.locator("#extBackSettings").click();
  await page.locator("#backFromSettings").click();

  await toSend(page, "bank:lb2", "500000");
  await expect(title(page)).toHaveText("Confirm this device");
  await expect(page.locator("#panelBody .step-sub")).toHaveText("It's the first time money moves from this device. We sent a code to your email.");
  await expect(page.locator("#deviceEmail")).toHaveText("a••••a@osun.co");
  await expect(page.locator("#panelBody .lbl")).toHaveText("Enter the 6-digit code we sent you");
  await expect(page.locator("#deviceOtp input")).toHaveCount(6);
  await page.locator("#deviceResend").click();
  await expect(page.locator("#toastEl")).toHaveText("Code sent again");

  await code(page, "000000");
  await expect(page.locator("#deviceStatus")).toHaveText("That code isn’t right. Check it and try again.");
  await expect(page.locator("#deviceOtp input").first()).toHaveValue("");
  await code(page, "123456");
  await pin(page); // where it left off: the PIN for this send
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
  await page.locator("#payoutDone").click();
  await expect(await devices(page)).toHaveText(["This device", "Chrome · MacBook Air"]);
  await expect(page.locator('[data-device="d1"] .settings-row-sub')).toHaveText("Active now");
  await page.locator("#extBackSettings").click();
  await page.locator("#backFromSettings").click();

  // Bound: the next send doesn't ask again
  await toSend(page, "bank:lb2", "100000");
  await pin(page);
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
});

test("a new device: Cancel returns to the review as it was; any send asks (a Poket user too)", async ({ page }) => {
  await start(page, "new");
  await toSend(page, "poket:pu1", "300000");
  await expect(title(page)).toHaveText("Confirm this device");
  await page.locator("#deviceCancel").click();
  await expect(page.locator("#confirmPayout")).toBeVisible();
  await expect(page.locator("#reviewTheyGet")).toHaveText("₦3,000.00 NGN");
  await expect(page.locator("#payoutAckCheck")).toBeChecked();
  await page.locator("#confirmPayout").click();
  await code(page, "123456");
  await pin(page);
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
});

test("a new device: after the code, a send over the step-up limit goes on to the step-up, then the PIN", async ({ page }) => {
  await start(page, "new");
  await toSend(page, "bank:lb2", "2500000"); // ₦25,000.00: over the demo step-up (₦20,000)
  await code(page, "123456");
  await passSelfie(page); // the selfie check, in place of the step-up
  await pin(page);
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
});

test("a new device: turning on instant transfers asks to confirm the device first, then the PIN", async ({ page }) => {
  await start(page, "new");
  await page.getByLabel("Instant transfers default").selectOption("off");
  await page.locator("#openSettingsHeader").click();
  await page.locator("#openInstantTransfers").click();
  await page.locator("#instantSwitch").click();
  await expect(title(page)).toHaveText("Confirm this device");
  // Cancel: back on Instant transfers, still off
  await page.locator("#deviceCancel").click();
  await expect(title(page)).toHaveText("Instant transfers");
  await expect(page.locator("#instantSwitch")).toHaveAttribute("aria-checked", "false");
  await page.locator("#instantSwitch").click();
  await code(page, "123456");
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("Turns on instant transfers.");
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#instantSwitch")).toHaveAttribute("aria-checked", "true");
  // Bound now: turning them off and on again only asks for the PIN
  await page.locator("#instantSwitch").click();
  await page.locator("#instantOffConfirm").click();
  await page.locator("#instantSwitch").click();
  await expect(title(page)).toHaveText("Enter your PIN");
});

test("a new device: Convert doesn't ask (only sends and turning on instant transfers do)", async ({ page }) => {
  await start(page, "new");
  await page.evaluate(() => (window as any).__convert.getState().start({ from: "cash:NGN:open", to: "cash:USD:open" })); // eslint-disable-line @typescript-eslint/no-explicit-any
  for (const d of "500000") await page.locator(`#panelBody [data-cvkey="${d}"]`).click();
  await page.locator("#cvReview").click();
  await page.locator("#cvConfirm").click();
  await expect(page.locator("#panelBody")).not.toContainText("Confirm this device");
});
