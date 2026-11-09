import { formatNaira, type Kobo } from "@/lib/money";

/** "₦25,000.00 NGN" with the code grey: what the reference's greyCurrencyCodes() does to amounts in #panelBody. */
export function Naira({ kobo }: { kobo: Kobo }) {
  const s = formatNaira(kobo);
  const i = s.lastIndexOf(" ");
  return <>{s.slice(0, i)} <span className="cur-code">{s.slice(i + 1)}</span></>;
}
