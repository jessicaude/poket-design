# Reference prototypes

The original single-file prototypes. **Read-only**: they are the source of truth for screens not yet ported.
Open any of them in a browser to see the behaviour you're porting.

| File | What's in it |
| --- | --- |
| `poket-widgets.html` | Checkout, Payout (Get paid), Wallets, Conversion widgets, each on a demo merchant site |
| `poket-unified.html` | The full Poket wallet, and checkout that pays from the wallet balance |
| `poket-wallet-explore.html` | Wallet redesign exploration (home, send, receive, convert, card, settings) |
| `poket-gifting.html` | Kudos gifting platform demo using the wallet |

In `poket-widgets.html`, each screen is an entry in the `SCREENS` map, e.g. `SCREENS['gp-review']`, with `render` (the HTML) and `bind` (the behaviour). Search for `SCREENS['` to find them.
