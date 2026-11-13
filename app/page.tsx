import Link from "next/link";

/** The demos: ported ones link to their page and list their main flows in one line. */
const DEMOS: { href: string; title: string; host: string; ported: boolean; flows?: string }[] = [
  { href: "/demo/ile-living", title: "Checkout", host: "Ilé Living (store)", ported: true,
    flows: "Card, naira card and bank transfer, sign-up, ID check, Poket account with refunds and disputes" },
  { href: "/demo/wallet", title: "Wallet", host: "Poket wallet with naira", ported: true,
    flows: "Deposit, Send, Convert, NGN account, activity and receipts, statements, settings" },
  { href: "#", title: "Payout: Get paid", host: "Gigsy", ported: false },
  { href: "#", title: "Wallets widget on a merchant page", host: "Esusu Circle", ported: false },
  { href: "#", title: "Conversion widget", host: "NairaBridge", ported: false },
];

/** Index of demo merchant sites (dev only). */
export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px", fontFamily: "var(--sans)" }}>
      <h1 style={{ fontSize: 32, letterSpacing: "-.03em", margin: 0 }}>Poket design</h1>
      <p style={{ color: "var(--txt2)", marginTop: 8 }}>Each widget runs on a demo merchant site. The original prototypes are in /reference.</p>
      <ul style={{ listStyle: "none", padding: 0, marginTop: 28, display: "grid", gap: 10 }}>
        {DEMOS.map((d) => (
          <li key={d.title} data-demo={d.title}>
            <Link href={d.href} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", border: "1px solid var(--bdr)", borderRadius: 14, background: "#fff", color: "inherit", textDecoration: "none", opacity: d.ported ? 1 : 0.55, pointerEvents: d.ported ? "auto" : "none" }}>
              <span><b style={{ display: "block" }}>{d.title}</b><span style={{ fontSize: 13.5, color: "var(--txt3)" }}>{d.host}</span>
                {d.flows && <span data-flows="" style={{ display: "block", fontSize: 13, color: "var(--txt2)", marginTop: 4 }}>{d.flows}</span>}</span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: d.ported ? "var(--brand-50)" : "var(--n-100)", color: d.ported ? "var(--brand)" : "var(--txt3)" }}>{d.ported ? "Ported" : "To port"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
