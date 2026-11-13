import { press } from "./keypad";
import { expectSelfie } from "./selfie";
import { test, expect, type Page } from "@playwright/test";

/**
 * NGN withdrawal statuses (status screen, activity rows, chips), "₦X on hold", the demo bar's status actions, and
 * the reservation in each case. Balance starts at ₦50,000.00. "Naira account" (lb2) has been paid before, so a
 * payout to it starts Sending; "Ngozi Eze" (r6) hasn't, so it starts Scheduled.
 */

const title = (page: Page) => page.locator("#panelBody .step-title").first();
const ngn = (page: Page) => page.evaluate(() => {
  const s = (window as any).__ngn.getState(); // eslint-disable-line @typescript-eslint/no-explicit-any
  return { balance: s.ngnBalance as number, reserved: s.ngnReserved as number };
});
const chip = (page: Page) => page.locator("#withdrawalStatus .va-status");
const msg = (page: Page) => page.locator("#withdrawalStatusMsg");
const action = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** Pay `naira` to a recipient with the demo PIN, then open the status screen from "View transaction". */
async function payAndOpen(page: Page, recipient: string, digits: string) {
  await page.goto("/demo/wallet");
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.locator("#actSend").click();
  await page.locator(`[data-sendrecipient="bank:${recipient.split(":")[1]}"]`).click(); // straight to the amount
  for (const d of digits) await press(page, d);
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await expect(page.locator("#viewPayoutTx")).toBeVisible();
  await page.locator("#viewPayoutTx").click();
  await expect(page.locator("#withdrawalStatus")).toBeVisible();
}

test("Scheduled: 'Sends after [hold]'; ₦X on hold on home and the balance screen; the list of held withdrawals", async ({ page }) => {
  await payAndOpen(page, "other:r6", "500000");
  await expect(title(page)).toHaveText("₦5,000.00 NGN");
  await expect(page.locator("#panelBody .step-sub").first()).toHaveText("To Ngozi Eze");
  await expect(chip(page)).toHaveText("Scheduled");
  await expect(chip(page)).toHaveClass(/\bmuted\b/);
  await expect(msg(page)).toHaveText("Sends after [hold]");
  await expect(page.locator("#panelBody .info-row")).toContainText(["Status", "Date", "ToGTBank · •••• 6789", "Fee₦[fee]", "Reference"]);
  expect(await ngn(page)).toEqual({ balance: 4500000, reserved: 500000 });

  // Home: the NGN row's subtitle
  await page.locator("#backFromTxDetail").click();
  await page.locator('[data-wallettab="cash"]').click(); // NGN is under the Cash tab
  const row = page.locator('#panelBody [data-holdcur="NGN"][data-holdbucket="open"]');
  await expect(row.locator(".tx-amt")).toHaveText("₦45,000.00 NGN");
  await expect(row.locator(".tx-sub")).toHaveText("₦45,000.00 NGN · ₦5,000.00 NGN on hold");
  await page.locator("#homeOnHold").click();
  await expect(title(page)).toHaveText("₦5,000.00 NGN on hold");
  await expect(page.locator("#panelBody .step-sub")).toHaveText("This money isn't in your available balance.");
  await expect(page.locator("#panelBody .tx-row .tx-title")).toHaveText(["To Ngozi Eze"]);
  await expect(page.locator("#panelBody .tx-row .va-status")).toHaveText(["Scheduled"]);
  await page.locator("#backFromOnHold").click();

  // NGN balance screen: the line under the balance, and the activity row
  await row.locator(".tx-title").click(); // the row's centre is the "on hold" link
  await expect(page.locator("#ngnBalanceAmount")).toHaveText("₦45,000.00 NGN");
  await expect(page.locator("#ngnOnHold")).toHaveText("₦5,000.00 NGN on hold ›");
  const activity = page.locator("#panelBody .section-card .tx-row");
  await expect(activity.locator(".tx-title")).toHaveText(["To Ngozi Eze"]);
  await expect(activity.locator(".tx-sub .va-status")).toHaveText(["Scheduled"]);
  await expect(activity.locator(".tx-sub")).toHaveText(["GTBank · •••• 6789 · Scheduled"]); // the account, then the chip while unfinished
  await expect(activity.locator(".tx-amt")).toHaveText(["-₦5,000.00 NGN"]);
  await page.locator("#ngnOnHold").click();
  await expect(title(page)).toHaveText("₦5,000.00 NGN on hold");
  await page.locator("#panelBody .tx-row").click();
  await expect(chip(page)).toHaveText("Scheduled");
});

test("Release first-payment hold: Scheduled → Sending → Paid; paid clears the reservation", async ({ page }) => {
  await payAndOpen(page, "other:r6", "500000");
  await expect(action(page, "Mark paid")).toBeEnabled();
  await expect(action(page, "Reverse")).toBeDisabled();
  await action(page, "Release first-payment hold").click();
  await expect(chip(page)).toHaveText("Sending");
  await expect(msg(page)).toHaveText("Usually within seconds");
  expect(await ngn(page)).toEqual({ balance: 4500000, reserved: 500000 });
  await expect(chip(page)).toHaveText("Paid");
  await expect(chip(page)).not.toHaveClass(/\b(muted|warn|err)\b/);
  await expect(msg(page)).toHaveCount(0);
  expect(await ngn(page)).toEqual({ balance: 4500000, reserved: 0 });
  await expect(action(page, "Release first-payment hold")).toBeDisabled();
  await page.locator("#backFromTxDetail").click();
  await expect(page.locator("#homeOnHold")).toHaveCount(0); // nothing on hold
});

test("Sending (account paid before) → Mark paid", async ({ page }) => {
  await payAndOpen(page, "self:lb2", "1000000");
  await expect(chip(page)).toHaveText("Sending");
  await expect(msg(page)).toHaveText("Usually within seconds");
  await expect(action(page, "Release first-payment hold")).toBeDisabled();
  expect(await ngn(page)).toEqual({ balance: 4000000, reserved: 1000000 });
  await action(page, "Mark paid").click();
  await expect(chip(page)).toHaveText("Paid");
  expect(await ngn(page)).toEqual({ balance: 4000000, reserved: 0 });
});

test("Held for review keeps the reservation; then Fail releases it to the balance", async ({ page }) => {
  await payAndOpen(page, "self:lb2", "1000000");
  await action(page, "Hold for review").click();
  await expect(chip(page)).toHaveText("Held for review");
  await expect(chip(page)).toHaveClass(/\bwarn\b/);
  await expect(msg(page)).toHaveText("We're checking this payment. We'll let you know.");
  await expect(action(page, "Hold for review")).toBeDisabled();
  expect(await ngn(page)).toEqual({ balance: 4000000, reserved: 1000000 });
  await action(page, "Fail").click();
  await expect(chip(page)).toHaveText("Failed");
  await expect(chip(page)).toHaveClass(/\berr\b/);
  await expect(msg(page)).toHaveText("Funds returned to your balance");
  await expect.poll(() => ngn(page)).toEqual({ balance: 5000000, reserved: 0 });
  for (const a of ["Release first-payment hold", "Hold for review", "Mark paid", "Fail", "Reverse"]) await expect(action(page, a)).toBeDisabled();
});

test("Failed from Scheduled: funds returned", async ({ page }) => {
  await payAndOpen(page, "other:r6", "250000");
  await action(page, "Fail").click();
  await expect(chip(page)).toHaveText("Failed");
  await expect.poll(() => ngn(page)).toEqual({ balance: 5000000, reserved: 0 });
});

test("Reversed after Paid: funds returned, with a notification", async ({ page }) => {
  await payAndOpen(page, "self:lb2", "1000000");
  await action(page, "Mark paid").click();
  await expect(chip(page)).toHaveText("Paid");
  await expect(page.locator("#openNotifHeader")).toBeHidden();
  await action(page, "Reverse").click();
  await expect(chip(page)).toHaveText("Reversed");
  await expect(chip(page)).toHaveClass(/\berr\b/);
  await expect(msg(page)).toHaveText("Funds returned to your balance");
  await expect.poll(() => ngn(page)).toEqual({ balance: 5000000, reserved: 0 });
  await expect(page.locator("#toastEl .notice-title")).toHaveText("Transfer reversed");
  await expect(page.locator("#toastEl .notice-body")).toHaveText("₦10,000.00 NGN to Naira account. Funds returned to your balance.");

  // The bell appears with a dot; the notification is listed; opening it marks it read
  await expect(page.locator("#openNotifHeader")).toBeVisible();
  await expect(page.locator("#notifDot")).toBeVisible();
  await page.locator("#openNotifHeader").click();
  await expect(title(page)).toHaveText("Notifications");
  await expect(page.locator("#panelBody .settings-row-title span").first()).toHaveText("Transfer reversed");
  await expect(page.locator("#panelBody .settings-row-sub")).toHaveText("₦10,000.00 NGN to Naira account. Funds returned to your balance.");
  await page.locator("#extBackHome").click();
  await expect(page.locator("#notifDot")).toBeHidden();
  await expect(chip(page)).toHaveText("Reversed"); // back to where the bell was opened
});

test("over ₦[step-up]: the selfie check before the PIN (Checkout's vendor screens); nothing reserved", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  for (const d of "2000001") await press(page, d); // ₦20,000.01, over the demo limit
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();

  await expectSelfie(page);
  const body = page.locator("#panelBody");
  await expect(body.locator(".vendor .vlogo img")).toHaveAttribute("alt", "Plaid");
  await expect(body.locator(".vendor .prep")).toHaveText("Take a quick selfieWe'll match it to the details you entered.");
  await expect(body).not.toContainText("Additional verification needed"); // the placeholder is gone for sends
  expect(await ngn(page)).toEqual({ balance: 5000000, reserved: 0 });
  await page.locator("#selfieCancel").click();
  await expect(page.locator("#confirmPayout")).toBeVisible();
  await page.locator("#confirmPayout").click();
  await page.locator("#demoSelfieOpen").click();
  await expect(body.locator(".vendor .vt")).toHaveText("Continue on your phone");
  await page.locator("#demoSelfieFinish").click();
  await expect(title(page)).toHaveText("Checking your ID");
  await expect(title(page)).toHaveText("Enter your PIN");
});

test("at ₦[step-up] or under: straight to the PIN", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  for (const d of "2000000") await press(page, d); // ₦20,000.00
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await expect(title(page)).toHaveText("Enter your PIN");
});
