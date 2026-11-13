import { create } from "zustand";
import { AV_COLORS, MERCHANT_LOGO } from "@/lib/icons";

/**
 * The wallet's brand (docs/decisions.md, Branding): Poket by default, or white-label with the merchant's name and
 * colours, keeping "Payments by Poket". In the demo the white-label merchant is the page hosting the wallet, Ilé
 * Living (a demo control). Used by receipts.
 */
export type WalletBrand = { kind: "poket" } | { kind: "merchant"; name: string };
export const POKET_BRAND: WalletBrand = { kind: "poket" };
export const DEMO_WHITE_LABEL: WalletBrand = { kind: "merchant", name: "Ilé Living" };
export const POWERED_BY = "Payments by Poket";
/** Poket's green (the wallet's --brand-500). */
export const POKET_GREEN = "#0a5c48";

export const useWalletBrand = create<{ brand: WalletBrand; setBrand: (b: WalletBrand) => void }>((set) => ({
  brand: POKET_BRAND,
  setBrand: (brand) => set({ brand }),
}));

const hashOf = (name: string) => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
/** The merchant's initials (storeLogo's rule): up to two, from its name's words. */
export const merchantInitials = (name: string) =>
  name.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

/** The brand's name, colour and logo (a 32×32 SVG): the merchant's logo, else its initials on a colour from its name. */
export function brandInfo(b: WalletBrand): { name: string; color: string; logoSvg: string | null } {
  if (b.kind === "poket") return { name: "Poket", color: POKET_GREEN, logoSvg: null };
  const logo = MERCHANT_LOGO[b.name];
  const color = logo?.match(/fill="(#[0-9a-fA-F]{3,6})"/)?.[1] ?? AV_COLORS[hashOf(b.name) % AV_COLORS.length];
  const svg = logo
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${logo}</svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${color}"/><text x="16" y="21" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="700" fill="#fff">${merchantInitials(b.name)}</text></svg>`;
  return { name: b.name, color, logoSvg: svg };
}
