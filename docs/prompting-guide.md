# Prompting guide for Cursor

How to get good results from Cursor's agent in this repo. The rules in `.cursor/rules/` load automatically, so you don't need to repeat them.

## The basics

- **Use Agent mode** (Cmd/Ctrl + I, then choose *Agent*) for changes. Use *Ask* when you only want an explanation.
- **Point at files with `@`.** Type `@` and pick a file, e.g. `@reference/poket-widgets.html` or `@features/checkout/screens/PayScreen.tsx`. The agent works much better with the right files attached.
- **One thing at a time.** One screen, one fix, one change per prompt. Big prompts produce big, hard-to-review changes.
- **Say what "done" looks like.** e.g. "the build passes and the new test passes".
- **Review before accepting.** Cursor shows each change as a diff. Read it, try it in the browser, then accept.
- **Commit after each working step** (Source Control → message → Commit). If the next step goes wrong, you can go back.

## A good prompt has four parts

1. **What** you want.
2. **Where:** the files, with `@`.
3. **Source:** the prototype screen to copy from, if porting.
4. **Done when:** how to check it.

---

## Ready-to-use prompts

Copy these and adjust the names.

### Port a screen
```
Port the screen SCREENS['gp-review'] from @reference/poket-widgets.html into a new
features/payout/screens/ReviewScreen.tsx. Convert its render HTML to JSX keeping every
class name, use icons from @lib/icons.ts, and copy the text and validation exactly.
Navigation goes in features/payout/usePayout.ts.
Done when: it looks the same as the prototype's gp-review screen and the build passes.
```

### Port a whole widget, step by step
Start with the skeleton, then one screen per prompt:
```
Create the Payout widget skeleton, following the same structure as @features/checkout:
features/payout/usePayout.ts (flow store with a Screen type), features/payout/PayoutWidget.tsx
(dialog shell with header and stepper "Account / Get paid"), and a demo page
app/demo/gigsy/page.tsx based on the Gigsy host in @reference/poket-widgets.html
(search for renderGigsy). No screens yet: show a placeholder. Done when: the page loads at /demo/gigsy.
```
Then port each screen with the "Port a screen" prompt: `gp-claim`, `gp-review`, `gp-keyed`, `gp-liveness`, `gp-done`.

### Change a design detail
```
In @features/checkout/screens/PayScreen.tsx, make the title "Pay $23.40 to Ilé Living"
1px smaller and reduce the space above the Pay button by 4px. Put any CSS change in
@styles/overrides.css and keep the prototype's class names.
```

### Fix something that looks wrong
Attach a screenshot (drag it into the chat), then:
```
This is the Pay screen on /demo/ile-living. Compared with the same screen in
@reference/poket-widgets.html, the spacing under the payment methods is larger.
Find the cause and make it match the prototype.
```

### Fix an error
Copy the error from the terminal or browser, then:
```
npm run build fails with this error: [paste]. Explain the cause in one sentence, then fix it.
```

### Add a test
```
Add a Playwright test to @e2e/checkout.spec.ts: a new user enters a 5-digit code
and the Continue button stays disabled.
```

### Understand code (Ask mode)
```
Explain how @features/checkout/useCheckout.ts decides which screen comes after the code screen.
```

### Check against the decisions
```
Check @features/payout against @docs/decisions.md and list anything that doesn't match.
Don't change code yet.
```

---

## Suggested porting order

1. **Checkout: identity verification** (`details`, `id-*` screens) to replace the placeholder.
2. **Payout (Get paid)** on a Gigsy demo page, including the KYC thresholds.
3. **Your Poket account:** home, activity, receipts, merchant profile, payment methods.
4. **Conversion** on a NairaBridge demo page.
5. **Wallets:** the largest; plan it as its own milestone.

## When things go wrong

- **The agent changed too much:** reject the change and ask again with a narrower prompt.
- **It keeps breaking the same thing:** start a new chat. Long chats lose track.
- **Something worked before and doesn't now:** Source Control → discard changes, or go back to your last commit.
- **You're not sure a change is right:** ask "What did you change and why?" before accepting.
