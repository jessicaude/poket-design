# Checkout flow

Status: **ported**, matching `reference/poket-widgets.html`. Demo: `/demo/ile-living`.

| Screen | File | What happens |
| --- | --- | --- |
| `signup` | `screens/SignupScreen.tsx` | Email, legal name, terms (prefilled when the store shares details). Then the 6-digit code appears in place and verifies itself. An existing email switches to "Continue to log in". `000000` is a wrong code. |
| `add-method` | `screens/AddMethodScreen.tsx` | Card, Pay by Bank, Apple Pay, Google Pay, Cash App Pay. Only Card is ported. |
| `add-card` | `screens/AddCardScreen.tsx` | Number with brand mark, expiry MM / YYYY, CVC, ZIP; "Save this card for next time". |
| `pay` | `screens/PayScreen.tsx` | Saved methods, add a method, order summary, bank mandate. Returning users see "Signed in as". |
| `processing` | `screens/StatusScreens.tsx` | Paying the merchant. |
| `declined` | `screens/StatusScreens.tsx` | Card declined; "Choose another way to pay". |
| `done` | `screens/StatusScreens.tsx` | Paid with, order, reference, total; protection note. |
| `id-needed` | `screens/StatusScreens.tsx` | **Placeholder** for identity verification ($500 or more). |

Flow logic: `features/checkout/useCheckout.ts`. Demo controls: Customer (new / Ada), Card (approved / declined), Details (shared / not), Theme (Poket / CentryOS).

## Not ported yet (from reference/poket-widgets.html)
- Identity verification: `details`, `vendor`, `verifying`, `id-done`
- Pay by Bank: `add-bank`, `bank-verify`, `bank-pick`, `bank-login`, `bank-accounts`
- Apple Pay, Google Pay, Cash App Pay: `connect-wallet`
- Phone sign-up ("Use phone")
- Your Poket account: `acct-home`, `activity`, `pay-detail` (View receipt), `merchant`, `methods`, `notifications`, `settings` and more
- Subscriptions and disputes
