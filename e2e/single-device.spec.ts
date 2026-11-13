import { test, expect, type Page } from "@playwright/test";

/**
 * Demo bar "Single active device: Off / On" (to confirm: not in the PRD). On: binding a new device signs out the other
 * one, so Security lists only this device. The signed-out device (demo "Sign in on another device") is asked to sign
 * in again on its next tap; signed in again, it's a new device until it confirms itself.
 */

const title = (page: Page) => page.locator("#panelBody .step-title").first();
async function start(page: Page, device: "known" | "new", single: "on" | "off") {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.getByLabel("This device").selectOption(device);
  await page.getByLabel("Single active device").selectOption(single);
}
/** A ₦5,000.00 bank send, as far as review's Send. */
async function toSend(page: Page) {
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  await page.locator("#youSend").click();
  for (const d of "500000") await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
}
async function bindAndPay(page: Page) {
  await expect(title(page)).toHaveText("Confirm this device");
  await page.locator("#deviceOtp input").first().click();
  await page.keyboard.type("123456");
  await expect(title(page)).toHaveText("Enter your PIN");
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
  await page.locator("#payoutDone").click();
}
async function devices(page: Page) {
  await page.locator("#openSettingsHeader").click();
  await page.locator("#openSecurity").click();
  return page.locator("#panelBody [data-device] .settings-row-title");
}

test("off: binding a new device keeps the other one signed in", async ({ page }) => {
  await start(page, "new", "off");
  await toSend(page);
  await bindAndPay(page);
  await expect(await devices(page)).toHaveText(["This device", "Chrome · MacBook Air"]);
});

test("on: binding a new device signs out the other one; Security shows only this device", async ({ page }) => {
  await start(page, "new", "on");
  await expect(await devices(page)).toHaveText(["Chrome · MacBook Air"]); // signed in until this one is bound
  await page.locator("#extBackSettings").click();
  await page.locator("#backFromSettings").click();
  await toSend(page);
  await bindAndPay(page);
  await expect(await devices(page)).toHaveText(["This device"]);
  await expect(page.locator("#panelBody [data-signout]")).toHaveCount(0);
});

test("on, a known device: switching it on alone signs no one out", async ({ page }) => {
  await start(page, "known", "on");
  await expect(await devices(page)).toHaveText(["This device", "Chrome · MacBook Air"]);
});

test("the other device's side: its next tap asks it to sign in again, and nothing else happens", async ({ page }) => {
  await start(page, "known", "off");
  await expect(page.locator("#demoOtherDeviceBinds")).toHaveCount(0); // only with a single active device
  await page.getByLabel("Single active device").selectOption("on");
  await page.locator("#demoOtherDeviceBinds").click();
  await expect(page.locator("#demoOtherDeviceBinds")).toHaveCount(0);

  // The screen as it was, until the next tap: that tap doesn't open Send
  await expect(page.locator("#actSend")).toBeVisible();
  await page.locator("#actSend").click();
  await expect(page.locator("#signedOut .step-title")).toHaveText("You’ve been signed out");
  await expect(page.locator("#signedOut .step-sub")).toHaveText("Your account was signed in on another device. Sign in again to use Poket here.");
  // Header and tab taps ask too
  await page.locator("#openSettingsHeader").click();
  await page.locator("#tabActivity").click();
  await expect(page.locator("#signedOut")).toBeVisible();

  // Signed in again: the wallet home, as a new device that confirms itself when money moves (signing the other out)
  await page.locator("#signInAgain").click();
  await expect(page.locator("#actSend")).toBeVisible();
  await expect(page.getByLabel("This device")).toHaveValue("new");
  await expect(await devices(page)).toHaveText(["Chrome · MacBook Air"]);
  await expect(page.locator('[data-device="d2"] .settings-row-sub')).toHaveText("Last active just now");
  await page.locator("#extBackSettings").click();
  await page.locator("#backFromSettings").click();
  await toSend(page);
  await bindAndPay(page);
  await expect(await devices(page)).toHaveText(["This device"]);
});

test("signed out mid-send: the next tap asks to sign in; signing in closes the send", async ({ page }) => {
  await start(page, "known", "on");
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  await page.locator("#demoOtherDeviceBinds").click();
  await page.locator("#youSend").click();
  await expect(page.locator("#signedOut")).toBeVisible();
  await expect(page.locator("#sendKeypad")).toHaveCount(0);
  await page.locator("#signInAgain").click();
  await expect(page.locator("#actSend")).toBeVisible();
  await expect(page.locator("#youSend")).toHaveCount(0);
});
