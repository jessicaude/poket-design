import { expect, type Page } from "@playwright/test";

/** The selfie check before a send (over ₦[step-up], or flagged as unusual): Checkout's vendor handoff in the wallet. */
export async function expectSelfie(page: Page) {
  await expect(page.locator("#panelBody .vendor .vt")).toHaveText("Let's confirm it's you");
}
/** Through the selfie check with the demo bar's outcome (passes by default): Open on phone, Finish on phone. */
export async function passSelfie(page: Page) {
  await expectSelfie(page);
  await page.locator("#demoSelfieOpen").click();
  await page.locator("#demoSelfieFinish").click();
}
