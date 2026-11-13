import { WALLET_LOCKUP } from "@/lib/icons";
import { jpegToPdf } from "@/lib/receiptPdf";
import { brandInfo, POWERED_BY, type WalletBrand } from "../brand";
import { receiptText, type Receipt } from "./receipt";

/**
 * "Download image" and "Download PDF": the receipt drawn on a canvas in the wallet's look (the preview's layout:
 * the brand on top, the notice when it isn't done, the amount, the status chip, the rows, "Payments by Poket").
 * The PDF is that image on an A6-wide page.
 */
const W = 360, SCALE = 2, PAD = 24;
/** The page's Geist faces (next/font names them; app/layout.tsx), then the wallet's fallbacks. */
let SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
let MONO = "ui-monospace,'SF Mono',Menlo,Consolas,'Courier New',monospace";
async function loadFonts() {
  const css = getComputedStyle(document.documentElement);
  const sans = css.getPropertyValue("--font-geist-sans").trim(), mono = css.getPropertyValue("--font-geist-mono").trim();
  if (sans && !SANS.startsWith(sans)) SANS = `${sans},${SANS}`;
  if (mono && !MONO.startsWith(mono)) MONO = `${mono},${MONO}`;
  try { await Promise.all([document.fonts.load(`600 26px ${MONO}`, "₦0"), document.fonts.load(`500 13px ${SANS}`)]); } catch { /* fallbacks */ }
}
const C = { ink: "#101828", txt2: "#475467", txt3: "#98a2b3", line: "#eaecf0", warnBg: "#FEF3C7", warnInk: "#92400E", errBg: "#FEF3F2", errInk: "#B42318", okBg: "#ECFDF3", okInk: "#0D9147", mutedBg: "#F2F4F7" };
const CHIP: Record<string, [string, string]> = { "": [C.okBg, C.okInk], warn: [C.warnBg, C.warnInk], err: [C.errBg, C.errInk], muted: [C.mutedBg, C.txt2] };

function loadSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
/** Lines of `text` that fit `max` wide. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(" "), lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (ctx.measureText(next).width > max && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
}

/** Draw the receipt; the canvas's height fits its content. */
export async function drawReceipt(r: Receipt, brand: WalletBrand): Promise<HTMLCanvasElement> {
  await loadFonts();
  const b = brandInfo(brand);
  const logo = await loadSvg(b.logoSvg ?? WALLET_LOCKUP).catch(() => null);
  // Measure on a scratch context, then draw
  const scratch = document.createElement("canvas").getContext("2d")!;
  scratch.font = `500 12.5px ${SANS}`;
  const noticeLines = r.notice ? wrap(scratch, r.notice.text, W - PAD * 2 - 24) : [];
  scratch.font = `500 13px ${MONO}`;
  const valueLines = r.rows.map(([, v]) => wrap(scratch, v, W - PAD * 2 - 110));
  const height = 6 + 64 + (r.notice ? noticeLines.length * 18 + 22 + 14 : 0) + 112 + valueLines.reduce((s, l) => s + Math.max(1, l.length) * 18 + 18, 0) + 60;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE; canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, height);
  ctx.fillStyle = b.color; ctx.fillRect(0, 0, W, 6);

  // The brand: Poket's lockup, or the merchant's logo and name; "Receipt" on the right
  let y = 6 + 22;
  if (brand.kind === "poket") { if (logo) ctx.drawImage(logo, PAD, y, 88, 26.1); }
  else {
    if (logo) ctx.drawImage(logo, PAD, y - 2, 30, 30);
    ctx.fillStyle = C.ink; ctx.font = `700 15px ${SANS}`; ctx.textBaseline = "middle"; ctx.fillText(b.name, PAD + 40, y + 13);
  }
  ctx.textBaseline = "middle"; ctx.textAlign = "right"; ctx.fillStyle = C.txt2; ctx.font = `600 12px ${SANS}`;
  ctx.fillText("Receipt", W - PAD, y + 13);
  ctx.textAlign = "left";
  y = 6 + 64;

  // Not done: said first, in its colour
  if (r.notice) {
    const [bg, ink] = r.notice.tone === "err" ? [C.errBg, C.errInk] : [C.warnBg, C.warnInk];
    const h = noticeLines.length * 18 + 22;
    roundRect(ctx, PAD, y, W - PAD * 2, h, 10, bg);
    ctx.fillStyle = ink; ctx.font = `600 12.5px ${SANS}`; ctx.textBaseline = "top";
    noticeLines.forEach((l, i) => ctx.fillText(l, PAD + 12, y + 11 + i * 18));
    y += h + 14;
  }

  // The amount, who, the status chip
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillStyle = C.ink; ctx.font = `600 26px ${MONO}`; ctx.fillText(r.amount, W / 2, y + 4);
  ctx.fillStyle = C.txt2; ctx.font = `500 13.5px ${SANS}`; ctx.fillText(r.title, W / 2, y + 42);
  ctx.font = `700 11px ${SANS}`;
  const cw = ctx.measureText(r.status.label).width + 18, [cbg, cink] = CHIP[r.status.tone] ?? CHIP[""];
  roundRect(ctx, W / 2 - cw / 2, y + 68, cw, 22, 11, cbg);
  ctx.fillStyle = cink; ctx.textBaseline = "middle"; ctx.fillText(r.status.label, W / 2, y + 79);
  ctx.textAlign = "left";
  y += 112;

  // The rows: label left, value right (wrapping)
  r.rows.forEach(([k], i) => {
    ctx.fillStyle = C.line; ctx.fillRect(PAD, y, W - PAD * 2, 1);
    ctx.textBaseline = "top";
    ctx.fillStyle = C.txt2; ctx.font = `500 12.5px ${SANS}`; ctx.fillText(k, PAD, y + 10);
    ctx.fillStyle = C.ink; ctx.font = `500 13px ${MONO}`; ctx.textAlign = "right";
    valueLines[i].forEach((l, j) => ctx.fillText(l, W - PAD, y + 10 + j * 18));
    ctx.textAlign = "left";
    y += Math.max(1, valueLines[i].length) * 18 + 18;
  });
  ctx.fillStyle = C.line; ctx.fillRect(PAD, y, W - PAD * 2, 1);

  // Payments by Poket, always
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = C.txt3; ctx.font = `600 11.5px ${SANS}`;
  ctx.fillText(POWERED_BY, W / 2, y + 30);
  return canvas;
}

const blobOf = (canvas: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("no_blob"))), type, q));

export async function receiptPng(r: Receipt, brand: WalletBrand): Promise<Blob> {
  return blobOf(await drawReceipt(r, brand), "image/png");
}
export async function receiptPdf(r: Receipt, brand: WalletBrand): Promise<Blob> {
  const canvas = await drawReceipt(r, brand);
  const jpeg = new Uint8Array(await (await blobOf(canvas, "image/jpeg", 0.92)).arrayBuffer());
  // A6 is 297.6pt wide: the page keeps the receipt's proportions
  const ptW = 297.6, ptH = (canvas.height / canvas.width) * ptW;
  const pdf = jpegToPdf(jpeg, { w: canvas.width, h: canvas.height }, { w: ptW, h: ptH }, { title: `Receipt ${r.reference}`, subject: receiptText(r, brand) });
  return new Blob([pdf as BlobPart], { type: "application/pdf" });
}

/** Save a file (an <a download>). */
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
