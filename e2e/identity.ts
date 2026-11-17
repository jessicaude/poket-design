import { expect, type Page } from "@playwright/test";

/**
 * The wallet's step-up at Tier 0: Continue runs identity verification (the shared "Verify your identity", the ID
 * check's handoff through the demo bar, "Identity verified"), then carries on where the step-up was. Not the US, so
 * no SSN.
 */
export async function verifyIdentity(page: Page) {
  await page.locator("#stepupIntroContinue").click();
  await expect(page.locator("#panelBody h2.title")).toHaveText("Verify your identity");
  await page.locator("#dD").fill("12");
  await page.locator("#dM").selectOption("3");
  await page.locator("#dY").fill("1990");
  await page.locator("#dGo").click();
  await page.locator("#demoIdOpen").click();
  await page.locator("#demoIdFinish").click();
  await page.locator("#continueVerified").click();
}
