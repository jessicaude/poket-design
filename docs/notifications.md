# Notifications

Every notification the wallet and Checkout send. The wallet shows them under the header bell; Checkout sends none
(it tells the merchant through events instead).

Titles and bodies follow docs/copy.md: the title says what happened in 2 to 4 words, past tense; the body is one
sentence with the amount and who. Placeholders:

- {amount}: the amount without the currency code ("₦5,000.00", "$23.40").
- {sender}, {merchant}, {recipient}: who it came from or went to.
- {method}: the card that paid ("Visa ••• 4242"). {destination}: where a reversal goes (the card, or "the bank
  account that paid").
- {currency}: the balance the money returned to ("NGN", "USD").

The code sends them only through features/wallet/notificationCatalogue.ts, and e2e/notifications.spec.ts checks that
this table and the catalogue match.

## Wallet

| Key | Trigger | Title | Body |
|---|---|---|---|
| `topUpReceived` | A temporary-account top-up arrives (Deposit, bank transfer) | Transfer received | {amount} added to your NGN balance. |
| `transferReceived` | A bank transfer to the NGN account details, or naira from a Poket user, arrives | Transfer received | {amount} from {sender} added to your NGN balance. |
| `delayedTransferReceived` | The naira partner is back: each transfer that arrived while it was down is credited | Transfer received | {amount} from {sender} added to your NGN balance, after a delay. |
| `refundReceived` | A merchant refunds a naira bank-transfer payment into the NGN balance (not from a dispute) | Refund received | {amount} from {merchant} added to your NGN balance. |
| `disputeRefundedToBalance` | A dispute is resolved by refund, into the NGN balance (a naira bank transfer) | Dispute resolved | {amount} from {merchant} added to your NGN balance. |
| `disputeRefundedToCard` | A dispute is resolved by refund, back to the card that paid | Dispute resolved | {amount} from {merchant} is on its way back to {method}. |
| `paymentReversed` | A dispute is resolved by reversal: back the way it was paid | Payment reversed | {amount} from {merchant} is on its way back to {destination}. |
| `disputeClosed` | A dispute is resolved by release: the merchant keeps the payment | Dispute closed | {merchant} keeps your {amount} payment. |
| `transferFailed` | A send fails: the money goes back to the balance that paid it | Transfer failed | {amount} to {recipient} came back to your {currency} balance. |
| `transferReversed` | A paid send is returned by the bank (also shown as a notice) | Transfer reversed | {amount} to {recipient} came back to your {currency} balance. |
| `transferRecovered` | A recall on a send to a Nigerian bank is recovered | Transfer recovered | {amount} from {recipient} is back in your NGN balance. |
| `recallClosed` | A recall on a send to a Nigerian bank is not recovered | Recall closed | We couldn’t recover your {amount} transfer to {recipient}. |

## Checkout

None.
