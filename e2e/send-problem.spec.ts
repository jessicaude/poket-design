import { test, expect, type Page } from "@playwright/test";

/**
 * "Report a problem" on a Paid send to a Nigerian bank (send-report in reference/poket-widgets.html). "I sent it to
 * the wrong account" opens a recall request: "Bank transfers can't always be recovered." up front, then Submitted,
 * In progress, and Recovered (back in the NGN balance, with a notification) or Not recovered (a "Recall closed" notification). Demo actions move the
 * recall on.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const ngn = (page: Page) => page.evaluate(() => (window as any).__ngn.getState().ngnBalance as number);

/** A ₦5,000.00 send to a bank account (the Naira account, paid before: Sending at once), on its status screen. */
async function sent(page: Page, recipient = "bank:lb2", digits = "500000") {
  await page.goto("/demo/wallet");
  await expect(page.locator("#actSend")).toBeVisible();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.locator("#actSend").click();
  await page.locator(`[data-sendrecipient="${recipient}"]`).click();
  await page.locator("#youSend").click();
  for (const d of digits) await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toBeVisible();
}
async function paid(page: Page) {
  await page.getByRole("button", { name: "Mark paid" }).click();
  await expect(page.locator("#withdrawalStatus")).toHaveText("Paid");
}
async function recall(page: Page) {
  await page.locator("#reportProblem").click();
  await page.locator('[data-reportreason="I sent it to the wrong account"]').click();
  await page.locator("#reportGo").click();
  await page.locator("#requestRecall").click();
  await page.locator("#reportDoneBtn").click();
}

test("only a Paid send to a Nigerian bank offers Report a problem", async ({ page }) => {
  test.setTimeout(60000);
  await sent(page);
  await expect(page.locator("#withdrawalStatus")).toHaveText("Sending");
  await expect(page.locator("#reportProblem")).toHaveCount(0);
  await paid(page);
  await expect(page.locator("#reportProblem")).toHaveText("Report a problem");
  await expect(page.locator("#panelBody")).toContainText("Payments to people can’t be disputed.");

  // A US bank ($5.00): no
  await sent(page, "bank:lb1", "500");
  await paid(page);
  await expect(page.locator("#reportProblem")).toHaveCount(0);
});

test("another reason: Send report; then 'You reported a problem'", async ({ page }) => {
  await sent(page);
  await paid(page);
  await page.locator("#reportProblem").click();
  const body = page.locator("#panelBody");
  await expect(body.locator(".step-title")).toHaveText("Report a problem");
  await expect(body.locator(".step-sub").first()).toHaveText("With your ₦5,000.00 NGN payment to Naira account.");
  await expect(body.locator("[data-reportreason] .t1")).toHaveText(["I sent it to the wrong account", "It didn’t arrive", "Wrong amount", "Scam or fraud", "Something else"]);
  const go = page.locator("#reportGo");
  await expect(go).toBeDisabled();
  await page.locator('[data-reportreason="Scam or fraud"]').click();
  await expect(body.locator(".alert.info")).toContainText("If you were tricked into sending this, tell us now.");
  await page.locator('[data-reportreason="It didn’t arrive"]').click();
  await expect(go).toHaveText("Send report");
  await page.locator("#reportDetails").fill("Nothing in my account.");
  await go.click();
  await expect(page.locator("#reportDone .step-title")).toHaveText("We’re looking into it");
  await page.locator("#reportDoneBtn").click();
  await expect(page.locator("#problemReported")).toHaveText("You reported a problem. We’re looking into it and will email you.");
  await expect(page.locator("#reportProblem")).toHaveCount(0);
  await expect(page.locator("#recall")).toHaveCount(0);
});

test("wrong account: a recall request, said up front it may not work; Submitted, In progress, Recovered (NGN balance, notification)", async ({ page }) => {
  await sent(page);
  await paid(page);
  const before = await ngn(page);
  await page.locator("#reportProblem").click();
  await page.locator('[data-reportreason="I sent it to the wrong account"]').click();
  await expect(page.locator("#reportGo")).toHaveText("Continue");
  await page.locator("#reportGo").click();
  const body = page.locator("#panelBody");
  await expect(body.locator(".step-title")).toHaveText("Request a recall");
  // The warning comes first, before the explanation and the button
  await expect(body.locator(".alert.warn")).toHaveText("Bank transfers can’t always be recovered.");
  expect(await body.evaluate((el) => {
    const warn = el.querySelector("#recallWarning")!, sub = el.querySelector(".step-sub")!;
    return !!(warn.compareDocumentPosition(sub) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await expect(body.locator(".step-sub")).toHaveText("We’ll ask the receiving bank to return your ₦5,000.00 NGN from Naira account’s account. If they do, it goes back to your NGN balance.");
  // Back keeps the reason
  await page.locator("#reportBack").click();
  await expect(page.locator('[data-reportreason="I sent it to the wrong account"]')).toHaveAttribute("aria-checked", "true");
  await page.locator("#reportGo").click();
  await page.locator("#requestRecall").click();
  await expect(page.locator("#reportDone .step-title")).toHaveText("Recall requested");
  await page.locator("#reportDoneBtn").click();

  await expect(page.locator("#recallStatus")).toHaveText("Submitted");
  await expect(page.locator("#recallMsg")).toHaveText("We’ve asked the receiving bank to return it. Bank transfers can’t always be recovered.");
  await expect(page.locator("#reportProblem")).toHaveCount(0);
  await page.locator("#demoRecallProgress").click();
  await expect(page.locator("#recallStatus")).toHaveText("In progress");
  await expect(page.locator("#demoRecallProgress")).toBeDisabled();
  await page.locator("#demoRecallRecovered").click();
  await expect(page.locator("#recallStatus")).toHaveText("Recovered");
  await expect(page.locator("#recallMsg")).toHaveText("₦5,000.00 NGN is back in your NGN balance.");
  await expect.poll(() => ngn(page)).toBe(before + 500000);
  for (const id of ["#demoRecallProgress", "#demoRecallRecovered", "#demoRecallNot"]) await expect(page.locator(id)).toBeDisabled();
  await page.locator("#openNotifHeader").click();
  await expect(page.locator("#panelBody [data-notif]").first()).toContainText("Transfer recovered");
  await expect(page.locator("#panelBody [data-notif]").first()).toContainText("₦5,000.00 NGN is back in your NGN balance.");
});

test("wrong account: Not recovered: the receiving bank didn't return it; the balance is unchanged; Recall closed notification", async ({ page }) => {
  await sent(page);
  await paid(page);
  const before = await ngn(page);
  await recall(page);
  await page.locator("#demoRecallNot").click();
  await expect(page.locator("#recallStatus")).toHaveText("Not recovered");
  await expect(page.locator("#recallMsg")).toHaveText("We couldn’t recover this transfer. The receiving bank didn’t return it.");
  await page.waitForTimeout(300);
  expect(await ngn(page)).toBe(before);
  await expect(page.locator("#demoRecallRecovered")).toBeDisabled();
  await page.locator("#openNotifHeader").click();
  const n = page.locator("#panelBody [data-notif]").first();
  await expect(n).toContainText("Recall closed");
  await expect(n).toContainText("We couldn’t recover your transfer to Naira account.");
  await expect(page.locator("#panelBody [data-notif]").filter({ hasText: "Transfer recovered" })).toHaveCount(0);
});

test("mock: a recall needs a Paid send to a Nigerian bank, once; its moves", async () => {
  const api = await import("@/lib/mock-api");
  expect(api.RECALL_TRANSITIONS.submitted).toEqual(["in_progress", "recovered", "not_recovered"]);
  expect(api.RECALL_TRANSITIONS.in_progress).toEqual(["recovered", "not_recovered"]);
  expect(api.RECALL_TRANSITIONS.recovered).toEqual([]);
  expect(api.RECALL_TRANSITIONS.not_recovered).toEqual([]);
  await expect(api.setRecallStatus("nope", "recovered")).rejects.toThrow();
});
