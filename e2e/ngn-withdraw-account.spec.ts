import { test, expect, type Page } from "@playwright/test";

/**
 * Adding a Nigerian bank account (from Send: + New recipient → Bank account → NGN): searchable bank, 10-digit account
 * number, automatic name enquiry; and merchant-held balances, which can't be sent to a bank. Mock: ending 0000 not found, 1111 someone else, otherwise the user (Ada Osun).
 */

const title = (page: Page) => page.locator("#panelBody .step-title").first();

async function openAccountStep(page: Page) {
  await page.goto("/demo/wallet");
  await page.locator("#actSend").click();
  await page.locator("#newRecipient").click();
  await page.locator('[data-newkind="bank"]').click();
  await page.locator('[data-sendcur="NGN"]').click();
  await expect(title(page)).toHaveText("Add a bank account");
  await expect(page.locator("#panelBody .step-sub")).toHaveCount(0); // no subtitle
}
async function pickBank(page: Page, search: string, name: string) {
  await page.locator("#ngnBankRow").click();
  await expect(title(page)).toHaveText("Choose your bank");
  await page.locator("#ngnBankSearch").fill(search);
  await page.locator("[data-ngnbank]", { hasText: name }).click();
  await expect(page.locator("#ngnBankRow .t1")).toHaveText(name);
}

test("bank picker: 12 banks, searchable; Back returns to the account step", async ({ page }) => {
  await openAccountStep(page);
  await expect(page.locator("#ngnBankRow .t1")).toHaveText("Choose your bank");
  await page.locator("#ngnBankRow").click();
  const rows = page.locator("#panelBody [data-ngnbank]");
  await expect(rows).toHaveCount(12);
  await expect(rows.first().locator(".t1")).toHaveText("Access Bank");
  await page.locator("#ngnBankSearch").fill("bank of");
  await expect(rows.locator(".t1")).toHaveText(["First Bank of Nigeria"]);
  await page.locator("#ngnBankSearch").fill("xyz");
  await expect(page.locator("#panelBody")).toContainText("No matches for “xyz”.");
  await page.locator("#backToNgnAccount").click();
  await expect(title(page)).toHaveText("Add a bank account");
});

test("matched: the name is the user's, so it's saved as their own account", async ({ page }) => {
  await openAccountStep(page);
  await pickBank(page, "zen", "Zenith Bank");
  const save = page.locator("#ngnAcctSave");
  await expect(save).toBeDisabled();
  await page.locator("#ngnAcctInput").fill("01a2-3");
  await expect(page.locator("#ngnAcctInput")).toHaveValue("0123"); // digits only
  await page.locator("#ngnAcctInput").fill("012345678999");
  await expect(page.locator("#ngnAcctInput")).toHaveValue("0123456789"); // 10 at most
  await expect(page.getByRole("status", { name: "Checking the account name" })).toBeVisible();
  await expect(page.locator("#ngnAcctName")).toHaveText("Ada Osun");
  await expect(page.getByRole("status", { name: "Checking the account name" })).toHaveCount(0);
  await expect(save).toHaveText("Add account");
  await save.click();

  // Straight on to the amount; back in Send it's listed under Your accounts
  await expect(page.locator("#panelBody")).toContainText("To: Ada Osun");
  await page.locator("#backToPayoutRecipient2").click();
  const mine = page.locator("#panelBody .field-label", { hasText: "Your accounts" });
  await expect(mine).toBeVisible();
  const row = page.locator("#panelBody [data-sendrecipient]").filter({ hasText: "Zenith Bank · •••• 6789" });
  await expect(row.locator(".t1")).toHaveText("Ada Osun");
  // Own accounts come before the "Saved" label
  const labels = await page.locator("#panelBody .field-label, #panelBody [data-sendrecipient] .t2").allTextContents();
  expect(labels.indexOf("Zenith Bank · •••• 6789")).toBeLessThan(labels.indexOf("Saved"));
});

test("different name: shown, and it must be confirmed as a third-party payee", async ({ page }) => {
  await openAccountStep(page);
  await pickBank(page, "gt", "GTBank");
  await page.locator("#ngnAcctInput").fill("2045671111");
  const name = page.locator("#ngnAcctName");
  await expect(name).not.toHaveText("");
  const payee = (await name.textContent())!;
  expect(payee).not.toBe("Ada Osun");
  await expect(page.locator("#panelBody .alert.warn")).toHaveText(`This account isn't in your name. Only continue if you mean to pay ${payee}.`);
  const save = page.locator("#ngnAcctSave");
  await expect(save).toHaveText("Add recipient");
  await expect(save).toBeDisabled();
  await page.getByLabel(`I'm paying ${payee}, not my own account`).check();
  await save.click();

  // Straight on to the amount: the fee is the placeholder, not a number
  await expect(page.locator("#panelBody")).toContainText(`To: ${payee}`);
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("NGN"); // You send: the NGN balance
  await expect(page.locator("#panelBody .cv-box-top")).toContainText("Available ₦50,000.00 NGN");
  await page.locator("#backToPayoutRecipient2").click();
  const labels = await page.locator("#panelBody .field-label, #panelBody [data-sendrecipient] .t1").allTextContents();
  expect(labels.indexOf(payee)).toBeGreaterThan(labels.indexOf("Saved")); // a third party: under Saved
});

test("not found: 'Check the bank and account number'; editing the number clears it", async ({ page }) => {
  await openAccountStep(page);
  await pickBank(page, "uba", "UBA");
  await page.locator("#ngnAcctInput").fill("1234500000");
  await expect(page.locator("#panelBody .field-err")).toHaveText("Check the bank and account number");
  await expect(page.locator("#ngnAcctInput")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#ngnAcctSave")).toBeDisabled();
  await page.locator("#ngnAcctInput").press("Backspace");
  await expect(page.locator("#panelBody .field-err")).toHaveCount(0);
  await page.locator("#ngnAcctInput").press("5");
  await expect(page.locator("#ngnAcctName")).toHaveText("Ada Osun");
});

test("number first, then bank: the enquiry runs once both are in; changing bank re-checks", async ({ page }) => {
  await openAccountStep(page);
  await page.locator("#ngnAcctInput").fill("1234500000");
  await expect(page.locator("#panelBody .field-hint")).toHaveText("Choose the bank to check the account name.");
  await pickBank(page, "wema", "Wema Bank");
  await expect(page.locator("#panelBody .field-err")).toHaveText("Check the bank and account number");
  await expect(page.locator("#ngnAcctInput")).toHaveValue("1234500000");
});

test("lookup unavailable: can't add the account; Try again once it's back", async ({ page }) => {
  await openAccountStep(page);
  await page.getByLabel("Name enquiry").selectOption("down");
  await pickBank(page, "access", "Access Bank");
  await page.locator("#ngnAcctInput").fill("0123456789");
  const alert = page.locator("#panelBody .alert.warn");
  await expect(alert).toHaveText("We can't check account names right now. Try again");
  await expect(page.locator("#ngnAcctSave")).toBeDisabled();
  await page.getByLabel("Name enquiry").selectOption("up");
  await page.locator("#ngnEnquiryRetry").click();
  await expect(page.locator("#ngnAcctName")).toHaveText("Ada Osun");
  await expect(alert).toHaveCount(0);
});

test("an account already saved is used, not duplicated", async ({ page }) => {
  await openAccountStep(page);
  await pickBank(page, "gtb", "GTBank");
  await page.locator("#ngnAcctInput").fill("0123456789"); // the seeded "Naira account"
  await expect(page.locator("#ngnAcctName")).toHaveText("Ada Osun");
  await page.locator("#ngnAcctSave").click();
  await expect(page.locator("#panelBody")).toContainText("To: Naira account");
  await page.locator("#backToPayoutRecipient2").click();
  await expect(page.locator("#panelBody [data-sendrecipient]").filter({ hasText: "GTBank · •••• 6789" })).toHaveCount(2); // Naira account and Ngozi Eze, no new row
});

test("merchant-held balance: not available to withdraw, Convert instead", async ({ page }) => {
  await page.goto("/demo/wallet");
  await page.getByLabel("Merchant-held balance").selectOption("yes");
  await page.locator('[data-wallettab="cash"]').click(); // NGN is under the Cash tab
  const held = page.locator('#panelBody [data-holdbucket="merchant"]');
  await expect(held.locator(".tx-sub")).toHaveText("₦12,000.00 NGNMERCHANT-HELD");
  await expect(held.locator(".tx-amt")).toHaveText("₦12,000.00 NGN");
  await held.click(); // its balance screen, then Send with it as the source
  await expect(page.locator("#panelBody .step-sub").first()).toContainText("MERCHANT-HELD");
  await page.locator("#detailSend").click();
  await expect(page.locator("#sendFrom")).toHaveText("From Nigerian NairaMERCHANT-HELD");
  await page.locator('[data-sendrecipient="bank:r6"]').click(); // a bank: not available from merchant-held
  const body = page.locator("#panelBody");
  await expect(body.locator(".step-title")).toHaveText("₦12,000.00 NGN");
  await expect(body.getByRole("alert")).toHaveText("Not available: this balance can't be sent to a bank");
  await expect(page.locator("#withdrawUseConvert")).toHaveText("Convert");
  await expect(page.locator("#payoutRecipientContinue")).toHaveCount(0);
  await page.locator("#backFromWithdraw").click();
  await expect(page.locator("#holdingAmount")).toHaveText("₦12,000.00 NGN"); // back on the merchant-held balance
  await page.locator("#backFromDetail").click();
  // The open balance still sends as normal (its row opens the NGN balance screen)
  await page.locator('#panelBody [data-holdcur="NGN"][data-holdbucket="open"]').click();
  await page.locator("#detailSend").click();
  await expect(title(page)).toHaveText("Send");
  await expect(page.locator("#sendFrom")).toHaveText("From Nigerian Naira");
  await page.locator('[data-sendrecipient="bank:r6"]').click();
  await expect(page.locator(".keypad")).toBeVisible();
});
