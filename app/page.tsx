import Link from "next/link";

const DEMOS = [
  { href: "/demo/ile-living", title: "Checkout", host: "Ilé Living (store)", ported: true },
  { href: "#", title: "Payout: Get paid", host: "Gigsy (freelance marketplace)", ported: false },
  { href: "#", title: "Wallets", host: "Esusu Circle", ported: false },
  { href: "#", title: "Conversion", host: "NairaBridge", ported: false },
];

/** Index of demo merchant sites (dev only). */
export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px", fontFamily: "var(--sans)" }}>
      <h1 style={{ fontSize: 32, letterSpacing: "-.03em", margin: 0 }}>Poket design</h1>
      <p style={{ color: "var(--txt2)", marginTop: 8 }}>Each widget runs on a demo merchant site. The original prototypes are in /reference.</p>
      <ul style={{ listStyle: "none", padding: 0, marginTop: 28, display: "grid", gap: 10 }}>
        {DEMOS.map((d) => (
          <li key={d.title}>
            <Link href={d.href} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", border: "1px solid var(--bdr)", borderRadius: 14, background: "#fff", color: "inherit", textDecoration: "none", opacity: d.ported ? 1 : 0.55, pointerEvents: d.ported ? "auto" : "none" }}>
              <span><b style={{ display: "block" }}>{d.title}</b><span style={{ fontSize: 13.5, color: "var(--txt3)" }}>{d.host}</span></span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: d.ported ? "var(--brand-50)" : "var(--n-100)", color: d.ported ? "var(--brand)" : "var(--txt3)" }}>{d.ported ? "Ported" : "To port"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
