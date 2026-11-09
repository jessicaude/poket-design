"use client";
import { Raw } from "@/components/ui/Raw";
import { WICON } from "@/lib/icons";
import { useNgn } from "../useNgn";

/** The account flow's back row (`back` in tVa / tVaNgn): <button class="back-row" id="vaBack">. */
export function VaBack() {
  const back = useNgn((s) => s.back);
  return <button className="back-row" id="vaBack" onClick={back}><Raw html={WICON.back} /> Back</button>;
}
