import { Raw } from "@/components/ui/Raw";

/** The reference's .select-row (va-ic, meta t1/t2, va-chev). The chevron is its fallback text: icons.chevR doesn't exist there. */
export function SelectRow({ id, icon, t1, t2, onClick, ...rest }: {
  id?: string; icon: string; t1: string; t2: string; onClick?: () => void; "data-ngnroute"?: string;
}) {
  return (
    <div className="select-row" id={id} onClick={onClick} {...rest}>
      <div className="va-ic"><Raw html={icon} /></div>
      <div className="meta"><div className="t1">{t1}</div><div className="t2">{t2}</div></div>
      <span className="va-chev">{"›"}</span>
    </div>
  );
}
