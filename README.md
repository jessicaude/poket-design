# Poket design

The design environment for the Poket widgets: Checkout, Payout, Wallets and Conversion, each running on a demo merchant site.

- **Checkout** is ported and tested (`/demo/ile-living`).
- The other widgets are in `reference/` as HTML prototypes, ready to port. See `docs/prompting-guide.md`.

## First-time setup

You need **Node.js 20 or newer** (check with `node -v` in a terminal; install from nodejs.org if missing).

1. **Open the folder in Cursor:** File → Open Folder → choose `poket-design`.
2. **Open a terminal in Cursor:** View → Terminal (or Ctrl + `).
3. **Install the project's packages** (once):
   ```
   npm install
   ```
4. **Start it:**
   ```
   npm run dev
   ```
5. **Open http://localhost:3000** in your browser. Changes you save appear instantly.

To stop it, click in the terminal and press Ctrl + C.

## Put it on GitHub (once)

1. On github.com, create a new **empty** repository called `poket-design` (no README, no .gitignore).
2. In Cursor's terminal, run these one at a time (replace `YOUR-USERNAME`):
   ```
   git init
   git add .
   git commit -m "Poket design: Checkout ported"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/poket-design.git
   git push -u origin main
   ```
3. Share the repo with the team: on GitHub, Settings → Collaborators → Add people.

After that, save your work with Cursor's **Source Control** panel (the branch icon on the left): write a message, click **Commit**, then **Sync**.

## Good to know

- The look comes from the prototype: `styles/prototype.css` plus the same class names in each screen. Compare with the HTML in `reference/` whenever you change a screen.
- Stop `npm run dev` (Ctrl + C) before running `npm run build`; they share a folder and the dev server breaks if both run.
- In the demo, any 6 digits work as the code; `000000` is a wrong code. Test card: 4242 4242 4242 4242.

## Run the tests

```
npx playwright install chromium   # once
npm run test:e2e
```

## Where things are

| Folder | What's in it |
| --- | --- |
| `app/demo/` | Demo merchant sites (Ilé Living) |
| `features/checkout/` | The Checkout widget: flow logic and one file per screen |
| `components/ui/` | Shared pieces (`Raw` renders icons from `lib/icons.ts`) |
| `components/demo/` | Demo-only controls and the events panel |
| `styles/prototype.css` | The prototype's stylesheet: the source of truth for the look (Poket and CentryOS themes) |
| `lib/` | Icons from the prototype, money, card rules, mock API |
| `e2e/` | Playwright tests |
| `reference/` | The original HTML prototypes |
| `docs/` | Decisions, flows and the prompting guide |
| `.cursor/rules/` | Rules Cursor's agent follows automatically |
