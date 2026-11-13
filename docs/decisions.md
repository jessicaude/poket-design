# Product decisions

Agreed rules. Follow them when building; change them only when the team agrees, then update this file.

## Widgets
- **Three independent flows:** Checkout, Payout and Wallet don't move money between each other.
- **One shared Poket account** across all widgets: sign-in, identity, tier and payment methods are shared.
- **Display:** widgets open as a pop-up over the merchant's page; the Wallet can also be embedded in the page.
- **Branding:** Poket by default; CentryOS theme (blue); white-label with the merchant's name and colours, keeping "Payments by Poket".

## Checkout
- Every payment **under $500** skips the ID check (Tier 1 limits apply). $500 or more needs identity verification.
  For a naira (NGN) order the limit uses the **USD value of the naira total**: under $500 needs no ID check, at Tier 0 too; $500 or more goes to identity verification.
- New users give their **legal first and last name** at sign-up; it prefills identity verification later.
- Terms: https://onepoket.com/terms-and-conditions · Privacy: https://onepoket.com/privacy-policy

## Refunds and disputes (WGT-12)
- The demo user's Checkout payments (naira and dollar, card and bank transfer) are kept on the shared Poket account. They show in **Checkout's Poket account** (Activity, a payment's detail) and in the **wallet's Activity** (the reference's activity row and transaction detail).
- A payment to a store can be disputed **up to 60 days** after it was made ("Raise a dispute" on its detail: "You can raise a dispute for N more days."; after that, contact the merchant or Poket support). Deposits, top-ups, refunds, sends and conversions can't be disputed.
- The dispute flow is the reference's: what happens and what to have ready, then one form where only the reason is required (contact date, evidence and details are optional). A dispute raised in one widget shows open in both, and the merchant is told (payment.dispute_opened, with the reason).
- Two disputes restrict the account from raising more ("You can't raise a dispute right now").
- **Refunds:** a merchant can refund a payment in full or in part. The payment then reads "Refunded" or "Partly refunded", and each refund is its own "Refund · {merchant}" record with a receipt. Card payments go back to the card ("Back to Visa ••• 4242 in [refund time]"); naira bank-transfer payments go to the NGN balance (*to confirm: not in the PRD*). The merchant is told (payment.refunded). A fully refunded payment can't be disputed.
- Ada's demo account is seeded with three Checkout payments, as the reference does: a recent naira card payment, a naira bank transfer from 10 days ago, and a dollar card payment from 76 days ago (outside the dispute window).
- In the demo, Checkout's account has its Activity tab only; Home, Methods and messaging the merchant aren't ported. Resolving a dispute isn't built yet.

## Payout (Get paid)
- No identity step up front. Sanctions screening and a payout account name match run on every payout, in the background.
- **Lifetime payouts ≥ $2,000:** keyed-in ID check (ID number + date of birth; no document, no selfie).
- **Lifetime payouts ≥ $10,000:** liveness check (selfie).
- Checks apply on the payout **after** the one that crosses a threshold, and come **after** the payee enters the amount and taps Get paid.
- Rejected or returned payouts don't count toward the lifetime total.
- Destinations: bank (free, 1 to 3 business days) or debit card (instant, 1.5%). Credit cards can't receive payouts.

## Payment methods
- One list shared across widgets. Each method has "Use to pay" and "Use to receive payouts" toggles and a default.
- A method used by an active subscription can't be switched off or removed.

## Wallet
- Deposits and top-ups can't be disputed.
- Card-funded money is tagged **FIAT-ONLY**: it can be spent or withdrawn, but can't become stablecoin.
- **One naira balance:** a user has one NGN balance, an NGN e-wallet. There's no merchant-held naira (no second NGN balance, no MERCHANT-HELD tag). Every NGN e-wallet can send naira to Nigerian banks within its tier limits.
- Instant transfers (WGT-09): a user can switch instant naira transfers to banks on or off and set a daily limit, up to their tier's maximum (not decided: ₦[tier max]). Raising the tier raises the maximum. New users start with them on or off by default (a product setting, shown as a demo control). Turning them on needs the PIN; turning them off only a confirmation, and it's immediate. Changing the daily limit needs the PIN: a lower limit applies at once; a higher one starts after a cooling-off period (not decided: [cooling-off]) and can be cancelled until then. Sends to Nigerian banks count toward the daily limit (all of today's, whatever paid them, except failed or reversed ones); one that would go over it can't be sent, and the amount screen says how much is left today. While off, sends to Nigerian banks don't go (the amount screen says so, with Turn on); Poket users, conversions and checkout aren't affected.
- Account lock (WGT-10): too many wrong verification codes (sign-up, log-in and device codes, counted together; the number isn't decided) lock the account for 2 hours. While locked, no money moves anywhere in the wallet, and Checkout can't sign in. The merchant is told (account.locked, with the reason).
- Selfie check before sends (WGT-10): a send over the step-up amount (₦[step-up], judged on what leaves the balance), or one flagged as unusual, asks for a selfie check before the PIN. Failed selfie checks count toward the same 3 attempts as other ID checks; after the 3rd, the send is held for review and the account is blocked (no money moves; contact support).
- Device binding (WGT-10): the first time money moves on a new device (a send, or turning on instant transfers), the user confirms the device with a 6-digit code sent to their email. The device is then bound (listed as "This device" under Security) and isn't asked again; known devices never are.
- Single active device (WGT-10), *to confirm (not in the PRD)*: binding a new device would sign out every other device, so only one is ever signed in; a signed-out device is asked to sign in again on its next action. Off by default in the demo.
- Partner downtime (WGT-13): while the naira partner is down, naira bank transfers are paused. A banner says so on the wallet home, the NGN balance and the affected naira screens. Deposits by bank transfer and new NGN account details are paused (convert from USD instead; no accounts are created); existing account details stay, marked Paused ("Transfers may arrive late."); sends to Nigerian banks can't be made (name enquiry unavailable), and ones already Sending stay Sending until it's back. Checkout marks naira bank transfer Paused; cards still work. Poket users, Convert and balances are unaffected. When it's back: transfers that arrived while down are credited, each with a notification ("₦X added to your NGN balance. This transfer was delayed."), and sends that were Sending move on to Paid.
- Where virtual accounts are supported, the NGN balance shows "Get NGN account details" until the user has a dedicated account (BVN or NIN, then terms), then the account's details. At Tier 0 it asks the user to verify their identity first (it doesn't offer a top-up; top-ups stay under Deposit). A rejected account shows "Not approved" with Try again.
- Sending to external wallets needs Tier 2.
- Send replaces the wallet's Transfer and Payout actions (not the Payout (Get paid) widget). Sending is recipient-first: pick a saved recipient or add one (bank account, debit card, Poket user, stablecoin wallet), then the amount (you send, they get). Withdrawing to your own bank is sending to yourself.
- Send to a debit card: Visa or Mastercard debit only (credit cards can't receive payouts), paid only from USD, arrives instantly. Fee not decided ($[fee]).
- US bank sends have one speed: 1 to 3 business days, fee not decided ($[fee]). No Instant or Wire choice (and no wire address). Naira keeps its one speed.
- Naira to Poket users (WGT-07): if the recipient can hold naira, they get naira. If they can't (no BVN or NIN, or not eligible), the naira converts to **USD on receipt**, and the sender sees it before sending ("{First name} can't hold naira. They'll get USD.", what they get and the quote, held 30 seconds). Existing rules still apply: card-funded money can't become stablecoins, and the naira-to-stablecoins block applies (the conversion is only ever to USD).

## Merchants
- A merchant without a logo shows its **initials** on a colour derived from its name, in the same rounded square as a logo.
