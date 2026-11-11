import { test, expect, type Page } from "@playwright/test";

/**
 * Send: the recipients screen and "+ New recipient" (bank account by currency, Poket user, stablecoin wallet), from
 * reference/poket-wallet-explore.html with the wallet's look. Opened with the ?send= preview (no home entry on this branch).
 */

const title = (page: Page) => page.locator("#panelBody .step-title").first();
const rowNames = (page: Page) => page.locator("#panelBody [data-sendrecipient] .t1");

test("recipients: + New recipient first, Your accounts, Saved with marks; search once more than 5 are saved", async ({ page }) => {
  await page.goto("/demo/wallet?send=recipients");
  await expect(title(page)).toHaveText("Send");
  await expect(page.locator("#panelBody .select-row").first()).toHaveAttribute("id", "newRecipient");
  await expect(page.locator("#panelBody .field-label")).toHaveText(["Your accounts", "Saved"]);
  await expect(rowNames(page)).toHaveText(["Personal checking", "Naira account", "Jordan Blake", "Ngozi Eze", "Tobi Bello", "Ngozi Okafor", "Kemi Adeyemi", "Ledger"]);
  await expect(page.locator('[data-sendrecipient="bank:lb2"] .badge svg')).toHaveCount(1); // the NGN flag
  await expect(page.locator('[data-sendrecipient="poket:pu1"] .badge')).toHaveText("TB");
  await expect(page.locator('[data-sendrecipient="wallet:sw1"] .badge-network')).toHaveCount(1);
  await expect(page.locator('[data-sendrecipient="wallet:sw1"] .t2')).toHaveText("0x3Fa9cE…D58e12");

  await page.locator("#sendSearch").fill("ngozi");
  await expect(rowNames(page)).toHaveText(["Ngozi Eze", "Ngozi Okafor"]);
  await page.locator("#sendSearch").fill("zzz");
  await expect(page.locator("#panelBody")).toContainText("No saved recipient matches.");
});

test("a saved Nigerian bank account goes straight to the amount; Back returns to Send", async ({ page }) => {
  await page.goto("/demo/wallet?send=recipients");
  await page.locator('[data-sendrecipient="bank:r6"]').click();
  await expect(page.locator(".keypad")).toBeVisible();
  await expect(page.locator("#panelBody")).toContainText("To: Ngozi Eze");
  await page.locator("#editPayoutRecipient").click(); // "Change"
  await expect(title(page)).toHaveText("Send");
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  await page.locator("#backToPayoutRecipient2").click();
  await expect(title(page)).toHaveText("Send");
  // Poket users have the same amount screen
  await page.locator('[data-sendrecipient="poket:pu1"]').click();
  await expect(page.locator("#panelBody")).toContainText("To: Tobi Bello");
});

test("+ New recipient asks where to send; Bank account asks the currency first", async ({ page }) => {
  await page.goto("/demo/wallet?send=recipients");
  await page.locator("#newRecipient").click();
  await expect(title(page)).toHaveText("New recipient");
  await expect(page.locator("#panelBody [data-newkind] .t1")).toHaveText(["Bank account", "Debit card", "Poket user", "Stablecoin wallet"]);
  await page.locator('[data-newkind="bank"]').click();
  await expect(title(page)).toHaveText("Currency");
  await expect(page.locator("#panelBody [data-sendcur] .t1")).toHaveText(["USD", "NGN", "GBP"]);
  await expect(page.locator("#panelBody [data-sendcur] .t2")).toHaveText(["US Dollar", "Nigerian Naira", "British Pound"]);
  await expect(page.locator("#panelBody [data-sendcur] .badge svg")).toHaveCount(3); // flags
  await page.locator("#backFromBankCurrency").click();
  await expect(title(page)).toHaveText("New recipient");
  await page.locator("#backToSendRecipients").click();
  await expect(title(page)).toHaveText("Send");
});

test("NGN bank account: the existing bank picker and name enquiry, Save recipient, then the amount", async ({ page }) => {
  await page.goto("/demo/wallet?send=bankCurrency");
  await page.locator('[data-sendcur="NGN"]').click();
  await expect(title(page)).toHaveText("Add a bank account");
  await page.locator("#ngnBankRow").click();
  await page.locator("#ngnBankSearch").fill("zen");
  await page.locator("[data-ngnbank]", { hasText: "Zenith Bank" }).click();
  await page.locator("#ngnAcctInput").fill("2045671111");
  await expect(page.locator("#ngnAcctName")).not.toHaveText("");
  await page.locator("#ngnThirdPartyOk").check();
  await expect(page.locator("#saveRecipient")).toBeChecked();
  await page.locator("#ngnAcctSave").click();
  await expect(page.locator(".keypad")).toBeVisible(); // straight on to the amount
  await page.locator("#backToPayoutRecipient2").click();
  await expect(title(page)).toHaveText("Send");
  await expect(page.locator("#panelBody [data-sendrecipient]").filter({ hasText: "Zenith Bank · •••• 1111" })).toHaveCount(1); // saved

  // Unticked: used for this send only
  await page.locator("#newRecipient").click();
  await page.locator('[data-newkind="bank"]').click();
  await page.locator('[data-sendcur="NGN"]').click();
  await page.locator("#ngnBankRow").click();
  await page.locator("[data-ngnbank]", { hasText: "UBA" }).click();
  await page.locator("#ngnAcctInput").fill("3045672222");
  await expect(page.locator("#ngnAcctName")).toHaveText("Ada Osun");
  await page.locator("#saveRecipient").uncheck();
  await page.locator("#ngnAcctSave").click();
  await expect(page.locator(".keypad")).toBeVisible();
  await page.locator("#backToPayoutRecipient2").click();
  await expect(page.locator("#panelBody [data-sendrecipient]").filter({ hasText: "UBA" })).toHaveCount(0);

  // Back from the bank step returns to the currency choice
  await page.locator("#newRecipient").click();
  await page.locator('[data-newkind="bank"]').click();
  await page.locator('[data-sendcur="NGN"]').click();
  await page.locator("#backToPayoutRecipient").click();
  await expect(title(page)).toHaveText("Currency");
});

test("USD bank account: routing number and bank, account, holder, nickname; the speed is chosen per send, on the amount", async ({ page }) => {
  await page.goto("/demo/wallet?send=bankCurrency");
  await page.locator('[data-sendcur="USD"]').click();
  await expect(title(page)).toHaveText("New bank account");
  const go = page.locator("#usBankContinue");
  await page.locator("#usRouting").fill("021000022");
  await expect(page.locator("#panelBody .field-err")).toHaveText("Check the routing number.");
  await page.locator("#usRouting").fill("021000021");
  await expect(page.locator("#usBankName")).toHaveText("JPMorgan Chase Bank, N.A.");
  await expect(page.locator("#panelBody [data-speed]")).toHaveCount(0); // not part of the recipient any more
  await page.locator("#usAcct").fill("12ab3456789");
  await expect(page.locator("#usAcct")).toHaveValue("123456789");
  await expect(go).toBeDisabled();
  await page.locator("#usName").fill("Jordan Blake");
  await page.locator("#usNick").fill("Rent");
  await expect(go).toBeEnabled();
  await go.click();

  // On to the amount, paying from open USD; the speed (and a wire's address) is chosen here
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("USD");
  await expect(page.locator("#panelBody [data-speed] .t1")).toHaveText(["Instant", "Standard", "Wire"]);
  await expect(page.locator("#panelBody [data-speed] .mono")).toHaveText(["$1.50 USD", "Free", "$15.00 USD"]);
  await expect(page.locator('[data-speed="ach"]')).toHaveClass(/\bsel\b/); // the free one by default
  for (const d of "1000") await page.locator(`[data-payoutkey="${d}"]`).click();
  const review = page.locator("#payoutReview");
  await expect(review).toBeEnabled();
  await page.locator('[data-speed="wire"]').click();
  await expect(review).toBeDisabled(); // a wire needs the address
  await page.locator("#usStreet").fill("1 Main St");
  await page.locator("#usCity").fill("Austin");
  await page.locator("#usState").fill("tx");
  await expect(page.locator("#usState")).toHaveValue("TX");
  await page.locator("#usZip").fill("78701");
  await expect(review).toBeEnabled();
  await page.locator("#backToPayoutRecipient2").click();
  await expect(title(page)).toHaveText("Send");
  const saved = page.locator("#panelBody [data-sendrecipient]").filter({ hasText: "Rent" });
  await expect(saved.locator(".t2")).toHaveText("Chase · •••• 6789");
});

test("debit card: brand in the number field; Visa and Mastercard only; credit cards refused; saved", async ({ page }) => {
  await page.goto("/demo/wallet?send=new");
  await page.locator('[data-newkind="card"]').click();
  await expect(title(page)).toHaveText("Debit card");
  const num = page.locator("#cardNum"), err = page.locator("#cardErr"), go = page.locator("#cardContinue");
  await num.fill("6011000000000004");
  await expect(err).toHaveText("Only Visa and Mastercard debit cards.");
  await num.fill("4111111111111111");
  await expect(num).toHaveValue("4111 1111 1111 1111");
  await expect(page.locator("#cardBrand")).toHaveText("Visa");
  await expect(err).toHaveText("This is a credit card. Use a debit card.");
  await page.locator("#cardName").fill("Ada Osun");
  await page.locator("#cardZip").fill("ab");
  await expect(page.locator("#cardZip")).toHaveValue(""); // digits only
  await page.locator("#cardZip").fill("10001");
  await expect(go).toBeDisabled();
  await num.fill("5200828282828210");
  await expect(page.locator("#cardBrand")).toHaveText("Mastercard");
  await expect(err).toHaveCount(0);
  await expect(go).toBeEnabled();
  await go.click();
  await expect(page.locator("#panelBody")).toContainText("To: Ada Osun"); // on to the amount
  await page.locator("#editPayoutRecipient").click();
  const saved = page.locator('#panelBody [data-sendrecipient^="card:"]');
  await expect(saved.locator(".t1")).toHaveText("Ada Osun");
  await expect(saved.locator(".t2")).toHaveText("Mastercard · •••• 8210");
});

test("GBP bank account: sort code with the bank's name, 8-digit account number, holder, nickname; saved", async ({ page }) => {
  await page.goto("/demo/wallet?send=bankCurrency");
  await page.locator('[data-sendcur="GBP"]').click();
  await expect(title(page)).toHaveText("New bank account");
  await expect(page.locator("#sendCurRow .t1")).toHaveText("GBP");
  await expect(page.locator("#panelBody .field-label")).toHaveText(["Sort code", "Account number", "Account holder name", "Nickname (optional)"]);
  await expect(page.locator("#panelBody [data-speed]")).toHaveCount(0); // no speed choice for UK accounts
  const go = page.locator("#ukBankContinue");
  await page.locator("#ukSort").fill("2000");
  await expect(page.locator("#ukSort")).toHaveValue("20-00");
  await expect(page.locator("#ukBankName")).toHaveCount(0);
  await page.locator("#ukSort").fill("200000");
  await expect(page.locator("#ukSort")).toHaveValue("20-00-00");
  await expect(page.locator("#ukBankName")).toHaveText("Barclays");
  await page.locator("#ukSort").fill("04-00-04");
  await expect(page.locator("#ukBankName")).toHaveText("Monzo");
  await page.locator("#ukAcct").fill("1234567");
  await page.locator("#ukName").fill("Amara Okoye");
  await expect(go).toBeDisabled(); // 7 digits
  await page.locator("#ukAcct").fill("12a3");
  await expect(page.locator("#ukAcct")).toHaveValue("123"); // digits only
  await page.locator("#ukAcct").fill("12345678");
  await expect(go).toBeEnabled();
  await go.click();
  await expect(page.locator("#payFromChip .cv-pick-name")).toHaveText("GBP"); // on to the amount, from GBP
  await page.locator("#backToPayoutRecipient2").click();
  const saved = page.locator("#panelBody [data-sendrecipient]").filter({ has: page.locator(".t1", { hasText: /^Amara Okoye$/ }) });
  await expect(saved.locator(".t2")).toHaveText("Monzo · •••• 5678");
  await expect(saved.locator(".badge svg")).toHaveCount(1); // the UK flag

  // Back from the form returns to the currency choice
  await page.locator("#newRecipient").click();
  await page.locator('[data-newkind="bank"]').click();
  await page.locator('[data-sendcur="GBP"]').click();
  await page.locator("#backFromUkBank").click();
  await expect(title(page)).toHaveText("Currency");
});

test("Poket user: @handle, email or phone with a name lookup; recent contacts; not found", async ({ page }) => {
  await page.goto("/demo/wallet?send=new");
  await page.locator('[data-newkind="poket"]').click();
  await expect(title(page)).toHaveText("Poket user");
  await expect(page.locator("#panelBody [data-poketuser] .t1")).toHaveText(["Amara Okafor", "Daniel Cho", "Priya Nair"]);
  await expect(page.locator("#poketContinue")).toBeDisabled();

  await page.locator("#poketQuery").fill("@nobody");
  await expect(page.getByRole("status", { name: "Looking up the name" })).toBeVisible();
  await expect(page.locator("#panelBody .field-err")).toHaveText("No Poket account found.");
  await page.locator("#poketQuery").fill("kemi.a@gmail.com");
  await expect(page.locator("#poketFound .t1")).toHaveText("Kemi Adeyemi");
  await page.locator("#poketQuery").fill("+234 803 123 4567");
  await expect(page.locator("#poketFound .t1")).toHaveText("Ngozi Okafor");

  await page.locator("#poketQuery").fill("");
  await page.locator('[data-poketuser="@dcho"]').click(); // a recent contact
  await expect(page.locator("#poketQuery")).toHaveValue("@dcho");
  await expect(page.locator("#poketFound .t1")).toHaveText("Daniel Cho");
  await page.locator("#poketNick").fill("Dan");
  await page.locator("#poketContinue").click();
  await expect(page.locator("#panelBody")).toContainText("To: Dan"); // on to the amount
  await page.locator("#editPayoutRecipient").click(); // "Change": back to the list, which has the saved user
  const saved = page.locator("#panelBody [data-sendrecipient]").filter({ has: page.locator(".t1", { hasText: /^Dan$/ }) });
  await expect(saved.locator(".badge")).toHaveText("DC");
  await expect(saved.locator(".t2")).toHaveText("@dcho");
});

test("stablecoin wallet: Tier 2 first; coin and network; address validated and highlighted; nickname; saved", async ({ page, context }) => {
  await page.goto("/demo/wallet?send=new");
  await page.locator('[data-newkind="wallet"]').click();
  await expect(title(page)).toHaveText("Unlock sending to external wallets"); // Tier 0
  await expect(page.locator("#tier2Steps .info-row")).toHaveText(["Account✓ Done", "IdentityStep 2", "Address and source of fundsStep 3"]);
  await page.locator("#tier2Go").click();
  await expect(page.locator("#toastEl .notice-body")).toHaveText("Tier 2 verification isn't ported yet.");
  await page.locator("#backFromTier2").click();

  await page.getByLabel("Tier").selectOption("2");
  await page.locator('[data-newkind="wallet"]').click();
  await expect(title(page)).toHaveText("New wallet");
  await expect(page.locator("#pickAsset .t1")).toHaveText("USDC");
  await expect(page.locator("#pickAsset .t2")).toHaveText("Base");
  await page.locator("#pickAsset").click();
  await expect(page.locator("#panelBody [data-cn]")).toHaveCount(8);
  await page.locator('[data-cn="USDT|Solana"]').click();
  await expect(page.locator("#walletAddr")).toHaveAttribute("placeholder", "USDT address");

  const addr = page.locator("#walletAddr"), go = page.locator("#walletContinue");
  await addr.fill("0x3Fa9cE21b7D04a5e9C6b1d82F7e0A4c39bD58e12"); // an EVM address on Solana
  await expect(page.locator("#panelBody .field-err")).toHaveText("That isn’t a Solana address.");
  await expect(go).toBeDisabled();
  await page.locator("#pickAsset").click();
  await page.locator('[data-cn="USDC|Base"]').click();
  await expect(page.locator("#walletAddrFull em")).toHaveText(["0x3Fa9", "8e12"]); // start and end highlighted
  await expect(page.locator("#walletAddrFull")).toHaveText("0x3Fa9cE21b7D04a5e9C6b1d82F7e0A4c39bD58e12");
  await expect(page.locator("#walletNick")).toHaveAttribute("placeholder", "e.g. My Ledger");

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await addr.fill("");
  await page.evaluate(() => navigator.clipboard.writeText("0xAbCdEf0123456789aBcDeF0123456789AbCdEf01"));
  await page.locator("#pasteBtn").click();
  await expect(addr).toHaveValue("0xAbCdEf0123456789aBcDeF0123456789AbCdEf01");
  await page.locator("#walletNick").fill("Cold storage");
  await go.click();
  await expect(page.locator("#panelBody")).toContainText("To: Cold storage"); // on to the amount
  await page.locator("#editPayoutRecipient").click();
  const saved = page.locator("#panelBody [data-sendrecipient]").filter({ hasText: "Cold storage" });
  await expect(saved.locator(".t2")).toHaveText("0xAbCdEf…CdEf01");
});
