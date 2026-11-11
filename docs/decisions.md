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
- Sending to external wallets needs Tier 2.
- Send replaces the wallet's Transfer and Payout actions (not the Payout (Get paid) widget). Sending is recipient-first: pick a saved recipient or add one (bank account, debit card, Poket user, stablecoin wallet), then the amount (you send, they get). Withdrawing to your own bank is sending to yourself.
- Send to a debit card: Visa or Mastercard debit only (credit cards can't receive payouts), paid only from USD, arrives instantly. Fee not decided ($[fee]).
- A US bank send's speed (Standard, Instant, Wire) is chosen per send on the amount screen, not saved with the recipient. Naira keeps one speed.
- Naira to Poket users (WGT-07): if the recipient can hold naira, they get naira. If they can't (no BVN or NIN, or not eligible), the naira converts to **USD on receipt**, and the sender sees it before sending ("{First name} can't hold naira. They'll get USD.", what they get and the quote, held 30 seconds). Existing rules still apply: card-funded money can't become stablecoins, merchant-held naira keeps its MERCHANT-HELD tag at the recipient, and the naira-to-stablecoins block applies (the conversion is only ever to USD).

## Merchants
- A merchant without a logo shows its **initials** on a colour derived from its name, in the same rounded square as a logo.
