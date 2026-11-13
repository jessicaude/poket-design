import { test, expect, type Page } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * docs/notifications.md is the catalogue of every notification: trigger, title, body. The wallet sends them only
 * through features/wallet/notificationCatalogue.ts; these tests keep the two equal, and check that what the wallet
 * actually shows matches its catalogue entry.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const ROOT = process.cwd();
type Row = { key: string; trigger: string; title: string; body: string };

/** The Wallet table's rows. */
function docRows(): Row[] {
  const doc = readFileSync(path.join(ROOT, "docs/notifications.md"), "utf8");
  const wallet = doc.slice(doc.indexOf("## Wallet"), doc.indexOf("## Checkout"));
  return wallet.split("\n").filter((l) => /^\| `\w+` \|/.test(l)).map((l) => {
    const [key, trigger, title, body] = l.split("|").slice(1, -1).map((c) => c.trim());
    return { key: key.replace(/`/g, ""), trigger, title, body };
  });
}
/** A catalogue body as a pattern: {amount} is an amount ("₦5,000.00", "$23.40", "10.00 USDC"); other placeholders are text. */
const AMOUNT = "(?:₦|\\$)?[\\d,]+\\.\\d{2}(?: [A-Z]{3,4})?";
const bodyPattern = (body: string) => new RegExp("^" + body.split(/(\{\w+\})/).map((p) =>
  p === "{amount}" ? AMOUNT : /^\{\w+\}$/.test(p) ? ".+?" : p.replace(/[.*+?^$()|[\]\\]/g, "\\$&")).join("") + "$");
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

test("mock: docs/notifications.md and the catalogue list the same notifications, word for word", async () => {
  const { NOTIFICATIONS } = await import("@/features/wallet/notificationCatalogue");
  const rows = docRows();
  expect(rows.map((r) => r.key)).toEqual(Object.keys(NOTIFICATIONS));
  for (const r of rows) {
    const n = NOTIFICATIONS[r.key as keyof typeof NOTIFICATIONS];
    expect({ trigger: r.trigger, title: r.title, body: r.body }, r.key).toEqual({ trigger: n.trigger, title: n.title, body: n.body });
  }
  // Checkout sends none
  expect(readFileSync(path.join(ROOT, "docs/notifications.md"), "utf8")).toMatch(/## Checkout\s+None\./);
});

test("mock: notifications are sent only through the catalogue, and every entry is used", async () => {
  const { NOTIFICATIONS, fillBody } = await import("@/features/wallet/notificationCatalogue");
  const files = [...sourceFiles(path.join(ROOT, "features")), ...sourceFiles(path.join(ROOT, "lib")), ...sourceFiles(path.join(ROOT, "store")), ...sourceFiles(path.join(ROOT, "components"))];
  const used = new Set<string>();
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (f.endsWith("notificationCatalogue.ts")) continue;
    expect(src, path.relative(ROOT, f)).not.toMatch(/useNotifications(\.getState\(\))?\.add\(|\.add\(\{\s*type:\s*"(info|payout)"/);
    for (const m of src.matchAll(/\bnotify(?:Key)?\("(\w+)"/g)) used.add(m[1]);
    for (const m of src.matchAll(/notificationFor\("(\w+)"/g)) used.add(m[1]);
    for (const m of src.matchAll(/"(disputeRefundedTo\w+)"/g)) used.add(m[1]);
  }
  expect([...used].filter((k) => !(k in NOTIFICATIONS))).toEqual([]);
  expect(Object.keys(NOTIFICATIONS).filter((k) => !used.has(k))).toEqual([]);
  // Every placeholder must be given
  expect(() => fillBody("transferReceived", { amount: "₦1.00" })).toThrow(/missing \{sender\}/);
  expect(fillBody("transferReceived", { amount: "₦1.00", sender: "Amara Okafor" })).toBe("₦1.00 from Amara Okafor added to your NGN balance.");
});

async function wallet(page: Page) {
  await page.goto("/demo/wallet");
  await page.waitForFunction(() => !!(window as any).__ngn && !!(window as any).__account?.getState().account);
}

test("what the wallet shows matches the catalogue: top-up, transfers in, delayed, refund, failed send", async ({ page }) => {
  test.setTimeout(60000);
  const rows = docRows();
  await wallet(page);
  await page.evaluate(async () => { const s = (window as any).__ngn.getState(); await s.createTemp(1000000); await s.transferArrives(); (window as any).__ngn.getState().close(); });
  await page.evaluate(() => (window as any).__ngn.getState().set({ dedicated: { status: "ready", num: "0123456789" } }));
  await page.locator("#demoAccountTransfer").click();
  await page.locator("#demoPoketTransfer").click();
  await page.getByLabel("Naira partner").selectOption("down");
  await page.locator("#demoQueuedArrival").click();
  await page.getByLabel("Naira partner").selectOption("up");
  // A merchant refunds a naira bank transfer into the NGN balance
  await page.locator("#tabActivity").click();
  await page.locator('[data-payment="pay_ilv10077"]').click();
  await page.locator("#demoRefundFull").click();
  await page.locator("#backFromTxDetail").click();
  // A send that fails
  await page.locator("#tabHome").click();
  await page.getByLabel("PIN", { exact: true }).selectOption("set");
  await page.locator("#actSend").click();
  await page.locator('[data-sendrecipient="bank:lb2"]').click();
  await page.locator("#youSend").click();
  for (const d of "500000") await page.locator(`#sendKeypad [data-payoutkey="${d}"]`).click();
  await page.locator("#keypadDone").click();
  await page.locator("#payoutReview").click();
  await page.locator("#payoutAckCheck").check();
  await page.locator("#confirmPayout").click();
  await page.locator("#panelBody .otp-box").first().click();
  await page.keyboard.type("1234");
  await page.locator("#viewPayoutTx").click();
  await page.getByRole("button", { name: "Fail" }).click();

  await page.locator("#openNotifHeader").click();
  const shown = await page.locator("#panelBody [data-notif]").evaluateAll((els) => els.map((e) => ({
    title: e.querySelector(".settings-row-title > span:first-child")!.textContent!.trim(), body: e.querySelector(".settings-row-sub")!.textContent!.trim(),
  })));
  expect(shown).toHaveLength(6);
  // Each matches exactly one catalogue entry
  const matches = shown.map((n) => rows.filter((r) => r.title === n.title && bodyPattern(r.body).test(n.body)).map((r) => r.key));
  for (const m of matches) expect(m).toHaveLength(1);
  const matched = matches.map((m) => m[0]);
  expect(matched).toEqual(["transferFailed", "refundReceived", "delayedTransferReceived", "transferReceived", "transferReceived", "topUpReceived"]);
  expect(shown.map((n) => n.body)).toEqual([
    "₦5,000.00 to Naira account came back to your NGN balance.",
    "₦36,270.00 from Ilé Living added to your NGN balance.",
    "₦25,000.00 from Chinedu Eze added to your NGN balance, after a delay.",
    "₦10,000.00 from Amara Okafor added to your NGN balance.",
    "₦25,000.00 from Chinedu Eze added to your NGN balance.",
    "₦10,000.00 added to your NGN balance.",
  ]);
});
