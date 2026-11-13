# Checkout flow

Status: **ported**, matching `reference/poket-widgets.html`. Demo: `/demo/ile-living`.

| Screen | File | What happens |
| --- | --- | --- |
| `signup` | `screens/SignupScreen.tsx` | Email, legal name, terms (prefilled when the store shares details). Then the 6-digit code appears in place and verifies itself. An existing email switches to "Continue to log in". `000000` is a wrong code. |
| `add-method` | `screens/AddMethodScreen.tsx` | USD order: Card, Pay by Bank, Apple Pay, Google Pay, Cash App Pay. NGN order: the naira rails the merchant accepts ("Card", "Bank transfer"), then, with Conversion on, the USD rails marked "Paid in USD, converted". None accepted: "{merchant} can’t take payment for this order right now." Ported: Card (both), Bank transfer. |
| `add-card` | `screens/AddCardScreen.tsx` | Number with brand mark (Verve supported), expiry MM / YYYY, CVC, ZIP; "Save this card for next time". A naira card has no ZIP. |
| `bank-transfer` | `screens/BankTransferScreen.tsx` | NGN order: the account card (amount to send exactly, account number, [Partner bank], "{merchant} via Poket", Copy). One-time ("Dynamic"): countdown from 30:00 [time] and "Use it once…" note; Merchant pool: no countdown. States: getting the account, waiting ("We’ll confirm as soon as it arrives"), paid (goes to `done`), underpaid / overpaid ("We received ₦X. [handling]" with Close), expired (one-time only: "This account expired", "Get a new account"). |
| `pay` | `screens/PayScreen.tsx` | Saved methods, add a method, order summary, bank mandate. Returning users see "Signed in as". NGN order paid with a USD method (Conversion on): the quote card (rate with countdown ring, "Fee Covered by {merchant}", "You pay $X USD for ₦Y NGN", "Rate held for 0:30"; then "Refresh rate"), and a bank's debit line names the dollars. Conversion off: USD methods disabled with "{merchant} only accepts naira for this order." |
| `processing` | `screens/StatusScreens.tsx` | Paying the merchant: the order amount, or the dollars charged when converted. |
| `declined` | `screens/StatusScreens.tsx` | Card declined; "Choose another way to pay". |
| `done` | `screens/StatusScreens.tsx` | Paid with, order, reference, total; converted adds "You paid $X USD" and the rate. Protection note. |
| `details` | `screens/IdentityScreens.tsx` | Orders of $500 or more (an NGN order: the USD value of the naira total), before Tier 1: "Verify your identity". Country (a new account starts in Nigeria, the location check), prefilled legal name, date of birth; United States adds an SSN (masked, Show / Hide) and "I don't have an SSN". Under 18 is blocked. "Finish later" closes. |
| `vendor` | `screens/IdentityScreens.tsx` | The ID handoff: Veriff (ID and selfie), or Plaid (selfie) for a US SSN. QR code, then "Continue on your phone". DEMO pill: Open on phone, Finish on phone. |
| `verifying` | `screens/IdentityScreens.tsx` | "Checking your ID", then the demo bar's ID check outcome. |
| `id-review` | `screens/IdentityScreens.tsx` | Manual review (copy from the reference's wallet engine, tVfSlow): "Your ID needs a closer look", Finish later. DEMO pill: Approve review. |
| `id-retry` | `screens/IdentityScreens.tsx` | Needs retry (tVfRetry): the reason and tries left out of Veriff's 3, Try again. |
| `id-done` | `screens/IdentityScreens.tsx` | "You're verified" (Tier 1); Continue goes back to paying (Pay, or add a method first). |
| `blocked` | `screens/IdentityScreens.tsx` | Under 18, ID declined (including the 3rd failed check), or a sanctions match (copy from tSanctionsDeclined). "You haven’t been charged." Back to the merchant. |
| `locked` | `screens/LockedScreen.tsx` | Too many wrong sign-up or log-in codes (counted with the wallet's device codes): "Account locked", "Too many incorrect codes. Try again in 2 hours.", a live countdown, Back to the merchant. Opening the widget during the lock shows it. Sends `account.locked`. DEMO pill: Skip lock time. |

Flow logic: `features/checkout/useCheckout.ts`; conversion quote and which methods can pay: `features/checkout/quote.ts`.
Mock backend: `lib/mock-api.ts` (`registerAccount`, `saveAccount`, `createCheckoutVirtualAccount`, `getMerchantPoolAccount`,
`simulateCheckoutTransfer`).

Identity verification (Tier 1), for orders of $500 or more:
- Stepper: Account, Identity, Payment (under $500: Account, Payment).
- Accounts are remembered: a sign-up is registered, and the account's changes are kept (`saveAccount`). Checking out
  again with the same email logs in ("This email already has a Poket account.").
- A verified (Tier 1) user is never asked again: later checkouts of $500 or more go straight to Pay.
- Veriff's limit of 3 attempts is shared across failed checks and checkouts: each "needs retry" adds one to the
  account's `idFailures`, and the tries left carry over to the next checkout. The 3rd failure is a decline.
- A block (under 18, declined or out of attempts, sanctions) stays on the account (`idBlocked`), and a blocked account
  can't pay at any amount: Pay with Poket shows its blocked screen straight after sign-in, before Pay, even under $500,
  with the same copy whatever the demo outcome. The store refuses payments and bank transfers from it too.
- In the product, the wallet's naira ID matches and Checkout's ID checks share **one** Veriff attempt count (3) per
  person. The demo has separate users (the wallet demo's user isn't a Checkout account), so here each keeps its own
  count: `useNgn.attempts` in the wallet, the account's `idFailures` in Checkout.
- Events: `user.verified` (`tier: 1`), `user.blocked` (`reason`: `age`, `id_declined`, `sanctions`).

Naira: running text (titles, buttons, notes, the merchant page) shows "₦36,270.00" without the code; amount rows and
cards keep the grey code. Rate: ₦1,550 per $1. Full NGN rules: `.cursor/rules/ngn.mdc` (Checkout).

Demo controls (the bar wraps onto a second row when needed):
- Customer (new / Ada), ID check (passes, manual review, needs retry, declined, under 18 at date of birth, sanctions
  match), Card (approved / declined), Order (under $500 / over $500: adds the $598.00 rug, $621.40 or ₦963,170.00),
  Details (shared / not), Theme (Poket / CentryOS).
- Screen actions show in the prototype's DEMO pill: Open on phone, Finish on phone (vendor), Approve review.
- Order currency (USD / NGN), Merchant accepts (NGN card, NGN bank transfer, Conversion), Bank transfer account
  (Dynamic / Merchant pool). The widget reads the merchant settings when it opens.
- On the bank transfer screen while waiting: one-time account: Transfer arrives, Less arrives, More arrives, Let it
  expire; pool: Exact amount arrives, Less arrives, More arrives.

Events to the merchant (events panel): `widget.opened`, `user.account_created`, `payment.succeeded` (NGN adds `rail`,
`account_type` for bank transfers, and `charged_amount`, `charged_currency`, `fx_rate` when converted),
`payment.amount_mismatch` (`order_reference`, `expected_amount`, `received_amount`, `rail`, `account_type`),
`payment.failed`, `user.verified`, `user.blocked`, `widget.closed`.

Tests: `e2e/checkout.spec.ts` (USD checkout), `e2e/ngn-checkout.spec.ts` (NGN checkout), `e2e/checkout-id.spec.ts`
(identity verification: every outcome, the shared attempt limit, verified and blocked accounts in later checkouts, and
naira orders of $500 or more).

## Not ported yet (from reference/poket-widgets.html)
- The prototype's picker sheet for selects (the details screen uses native selects)
- Pay by Bank: `add-bank`, `bank-verify`, `bank-pick`, `bank-login`, `bank-accounts`
- Apple Pay, Google Pay, Cash App Pay: `connect-wallet`
- Phone sign-up ("Use phone")
- Your Poket account: `acct-home`, `activity`, `pay-detail` (View receipt), `merchant`, `methods`, `notifications`, `settings` and more
- Subscriptions and disputes
