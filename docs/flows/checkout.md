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
| `id-needed` | `screens/StatusScreens.tsx` | **Placeholder** for identity verification ($500 or more; for an NGN order, the USD value of the naira total). |

Flow logic: `features/checkout/useCheckout.ts`; conversion quote and which methods can pay: `features/checkout/quote.ts`.
Mock backend: `lib/mock-api.ts` (`createCheckoutVirtualAccount`, `getMerchantPoolAccount`, `simulateCheckoutTransfer`).

Naira: running text (titles, buttons, notes, the merchant page) shows "₦36,270.00" without the code; amount rows and
cards keep the grey code. Rate: ₦1,550 per $1. Full NGN rules: `.cursor/rules/ngn.mdc` (Checkout).

Demo controls (the bar wraps onto a second row when needed):
- Customer (new / Ada), Card (approved / declined), Details (shared / not), Theme (Poket / CentryOS).
- Order currency (USD / NGN), Merchant accepts (NGN card, NGN bank transfer, Conversion), Bank transfer account
  (Dynamic / Merchant pool). The widget reads the merchant settings when it opens.
- On the bank transfer screen while waiting: one-time account: Transfer arrives, Less arrives, More arrives, Let it
  expire; pool: Exact amount arrives, Less arrives, More arrives.

Events to the merchant (events panel): `widget.opened`, `user.account_created`, `payment.succeeded` (NGN adds `rail`,
`account_type` for bank transfers, and `charged_amount`, `charged_currency`, `fx_rate` when converted),
`payment.amount_mismatch` (`order_reference`, `expected_amount`, `received_amount`, `rail`, `account_type`),
`payment.failed`, `widget.closed`.

Tests: `e2e/checkout.spec.ts` (USD checkout), `e2e/ngn-checkout.spec.ts` (NGN checkout).

## Not ported yet (from reference/poket-widgets.html)
- Identity verification: `details`, `vendor`, `verifying`, `id-done`
- Pay by Bank: `add-bank`, `bank-verify`, `bank-pick`, `bank-login`, `bank-accounts`
- Apple Pay, Google Pay, Cash App Pay: `connect-wallet`
- Phone sign-up ("Use phone")
- Your Poket account: `acct-home`, `activity`, `pay-detail` (View receipt), `merchant`, `methods`, `notifications`, `settings` and more
- Subscriptions and disputes
