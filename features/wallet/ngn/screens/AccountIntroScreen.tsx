"use client";
import { useState } from "react";
import { depositFeeShort } from "@/lib/fees";
import { WICON } from "@/lib/icons";
import { AccountIntro } from "../../deposit/AccountIntro";
import { NGN_VA, holderName, useNgn } from "../useNgn";
import { VaBack } from "./VaBack";

/**
 * tVa stage 'intro' for NGN (after a matched ID): the same intro as the other currencies (deposit/AccountIntro.tsx),
 * with naira's bank transfer and the partner's terms (the partner is still "[Partner bank]"). NGN skips the
 * reference's tax ID.
 */
export function AccountIntroScreen() {
  const createDedicated = useNgn((s) => s.createDedicated);
  const [agree, setAgree] = useState(false);
  // "bank transfer" (docs/copy.md: never "NIP"), as a row label
  const rail = NGN_VA.rails[0].toUpperCase() + NGN_VA.rails.slice(1);
  return (
    <>
      <VaBack />
      <AccountIntro cur="NGN" flag={WICON.ngFlag} bank={NGN_VA.bank} agree={agree} onAgree={setAgree} onCreate={createDedicated}
        rows={[["Name on account", holderName()], [rail, NGN_VA.arrives.split(" · ")[0]], ["Fee", depositFeeShort("NGN")]]} />
    </>
  );
}
