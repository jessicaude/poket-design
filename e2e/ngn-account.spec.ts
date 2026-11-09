import { test, expect, type Page } from "@playwright/test";

/** Dedicated NGN account: ngnChoice, ngnRoute, ngnId, ngnChecking, ngnLocked, ngnUnavailable, intro, creating, details. */

const title = (page: Page) => page.locator("#panelBody .step-title");

async function openAtTier1(page: Page) {
  await page.addInitScript(() => { Object.defineProperty(navigator, "share", { value: undefined }); });
  await page.goto("/demo/wallet?ngn=deposit-method");
  await page.getByLabel("Tier").selectOption("1");
  await page.locator("#dmBank").click();
  await expect(title(page)).toHaveText("Bank transfer");
}

async function toIdEntry(page: Page, route = "BVN") {
  await page.locator("#ngnPickDedicated").click();
  await page.locator("[data-ngnroute]", { hasText: route }).first().click();
  await expect(title(page)).toHaveText(`Enter your ${route}`);
}

test("Tier 1: choose, enter an ID, three mismatches lock the step", async ({ page }) => {
  await openAtTier1(page);
  const body = page.locator("#panelBody");
  await expect(body.locator(".select-row .t1")).toHaveText(["Temporary account", "Your own NGN account"]);
  await expect(body.locator("#ngnPickTemp .t2")).toHaveText("For this transfer only, valid 30 minutes [time]");
  await expect(body.locator("#ngnPickDedicated .t2")).toHaveText("Needs your BVN or NIN");

  await page.locator("#ngnPickDedicated").click();
  await expect(title(page)).toHaveText("Get your own NGN account");
  await expect(body.locator("[data-ngnroute] .t1")).toHaveText(["BVN", "NIN"]);
  await page.locator('[data-ngnroute="bvn"]').click();

  await expect(body.locator(".step-sub")).toHaveText("Bank Verification Number, 11 digits.");
  await expect(body.locator(".receipt-row .r-value")).toHaveText(["Ada Osun", "From your verified ID"]);
  const go = page.locator("#ngnIdGo");
  await expect(go).toHaveText("Check BVN");
  await page.locator("#ngnIdNum").fill("12ab345");
  await expect(page.locator("#ngnIdNum")).toHaveValue("12345");
  await expect(go).toBeDisabled();

  for (const left of ["2 attempts left.", "1 attempt left."]) {
    await page.getByRole("button", { name: "Fill a mismatching number" }).click();
    await go.click();
    await expect(title(page)).toHaveText("Checking your BVN");
    await expect(body.getByRole("alert")).toHaveText(`The name or date of birth on this BVN doesn't match your verified ID. ${left}`);
    await expect(page.locator("#ngnIdNum")).toHaveValue("");
  }
  await page.getByRole("button", { name: "Fill a mismatching number" }).click();
  await go.click();
  await expect(title(page)).toHaveText("We couldn't confirm your ID");
  await expect(body.locator(".step-sub")).toHaveText("You've used all 3 attempts. Contact support to continue. You can still add naira with a temporary account.");
  await expect(body.locator("a.vf-support")).toHaveAttribute("href", "https://poketwallet.com/support");
  await page.locator("#ngnUseTemp").click();
  await expect(title(page)).toHaveText("Add naira");
});

test("a match leads to the account terms, then the NGN account details", async ({ page }) => {
  await openAtTier1(page);
  await toIdEntry(page, "NIN");
  await page.getByRole("button", { name: "Fill a matching number" }).click();
  await page.locator("#ngnIdGo").click();

  // intro: account terms
  await expect(title(page)).toHaveText("Get NGN account details");
  const body = page.locator("#panelBody");
  await expect(body.locator(".receipt-row .r-value")).toHaveText(["Ada Osun", "NIP bank transfer", "Usually within seconds", "Free to receive"]);
  await expect(body.locator(".consent-row label")).toHaveText("Accept the account terms of Poket's partner bank, [Partner bank]");
  await expect(page.locator("#vaCreate")).toBeDisabled();
  await page.locator("#vaAgree").check();
  await page.locator("#vaCreate").click();
  await expect(title(page)).toHaveText("Creating your NGN account");

  // details
  await expect(title(page)).toHaveText("NGN account details");
  await expect(body.locator(".step-sub")).toHaveText("Send NGN by NIP bank transfer. Usually within seconds.");
  await expect(body.locator(".va-k")).toHaveText(["Account name", "Account number", "Bank"]);
  await expect(body.locator(".va-v").nth(1)).toHaveText(/^\d{10}$/);
  await expect(body.locator(".va-v").nth(2)).toHaveText("[Partner bank]");
  await expect(body.locator(".va-copy")).toHaveCount(3);
  await body.locator(".va-copy").nth(1).click();
  await expect(body.locator(".va-copy").nth(1)).toHaveText("Copied");
  await expect(body.locator(".va-note")).toHaveText("Transfers from someone else are checked before they’re added to your balance.");
  await expect(body).not.toContainText("stablecoin");

  await page.locator("#vaShare").click();
  await expect(page.locator("#toastEl .notice-title")).toHaveText("Details copied");
  const download = page.waitForEvent("download");
  await page.locator("#vaLetter").click();
  expect((await download).suggestedFilename()).toBe("poket-ngn-account-confirmation.html");
  await expect(page.locator("#toastEl .notice-title")).toHaveText("Confirmation letter downloaded");

  // freeze / unfreeze
  await page.locator("#vaFreeze").click();
  await expect(body.locator(".va-status")).toHaveText("Frozen");
  await expect(body.locator(".step-sub")).toHaveText("Transfers to these details are returned while the account is frozen.");
  await expect(page.locator("#vaFreeze .settings-row-title")).toHaveText("Unfreeze account");
  await page.locator("#vaFreeze").click();
  await expect(body.locator(".va-status")).toHaveCount(0);

  // close: Back cancels the confirmation, then confirm
  await page.locator("#vaClose").click();
  await expect(title(page)).toHaveText("Close NGN account details?");
  await page.locator("#vaBack").click();
  await expect(title(page)).toHaveText("NGN account details");
  await page.locator("#vaClose").click();
  await page.locator("#vaCloseConfirm").click();
  await expect(page.locator("#toastEl .notice-title")).toHaveText("NGN account details closed");
  await expect(title(page)).toHaveText("Deposit NGN");

  // The ID stays matched: the choice now says the account can be reused
  await page.locator("#dmBank").click();
  await expect(page.locator("#ngnPickDedicated .t2")).toHaveText("Reuse it for every transfer");
  await page.locator("#ngnPickDedicated").click();
  await expect(title(page)).toHaveText("Get NGN account details");
});

test("Back steps back within the flow", async ({ page }) => {
  await openAtTier1(page);
  await toIdEntry(page);
  await page.locator("#vaBack").click();
  await expect(title(page)).toHaveText("Get your own NGN account");
  await page.locator("#vaBack").click();
  await expect(title(page)).toHaveText("Bank transfer");
  await page.locator("#vaBack").click();
  await expect(title(page)).toHaveText("Deposit NGN");

  // intro goes back to the choice once the ID is matched
  await page.locator("#dmBank").click();
  await toIdEntry(page);
  await page.getByRole("button", { name: "Fill a matching number" }).click();
  await page.locator("#ngnIdGo").click();
  await expect(title(page)).toHaveText("Get NGN account details");
  await page.locator("#vaBack").click();
  await expect(title(page)).toHaveText("Bank transfer");
});

test("ID options follow what the verified ID shows", async ({ page }) => {
  await openAtTier1(page);
  const routes = page.locator("#panelBody [data-ngnroute] .t1");
  const shows = page.getByLabel("Verified ID shows");

  await shows.selectOption("ng_out");
  await expect(routes).toHaveText(["NRBVN"]);
  await shows.selectOption("for_in");
  await expect(routes).toHaveText(["NIN", "BVN", "Passport and residence permit"]);
  await page.locator('[data-ngnroute="permit"]').click();
  await expect(title(page)).toHaveText("Passport and residence permit");
  await expect(page.locator("#panelBody .step-sub")).toHaveText("Accepted only if Poket's partner allows it. [to confirm]");
  await page.locator("#vaBack").click();

  await shows.selectOption("for_out");
  await expect(title(page)).toHaveText("Your own NGN account isn't available");
  await expect(page.locator("#ngnUseConvert")).toHaveText("Convert from USD or USDC");
  await page.locator("#ngnUseTemp").click();
  await expect(title(page)).toHaveText("Add naira");
});
