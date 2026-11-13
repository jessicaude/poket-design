/**
 * A one-page PDF that is a JPEG (the receipt as drawn for "Download image"), so the PDF and the image match and the
 * naira sign needs no font. The receipt's text goes in the document's Subject (UTF-16, so ₦ survives) and its
 * reference in the Title, so the file is searchable. No library: PDF 1.4, five objects and an xref table.
 */
const enc = new TextEncoder();

/** A PDF text string: ASCII as a literal, anything else as UTF-16BE hex with a BOM. */
export function pdfString(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return `(${s.replace(/[\\()]/g, (c) => "\\" + c)})`;
  let hex = "FEFF";
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

/** The PDF's bytes. `px`: the JPEG's size in pixels; `pt`: the page's size in points. */
export function jpegToPdf(jpeg: Uint8Array, px: { w: number; h: number }, pt: { w: number; h: number }, info: { title: string; subject: string }): Uint8Array {
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === "string" ? enc.encode(b) : b; parts.push(u); length += u.length; };
  const obj = (n: number, body: string | (() => void)) => {
    offsets[n] = length;
    if (typeof body === "string") push(`${n} 0 obj\n${body}\nendobj\n`);
    else { push(`${n} 0 obj\n`); body(); push("\nendobj\n"); }
  };
  const W = pt.w.toFixed(2), H = pt.h.toFixed(2);
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  push("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, () => {
    push(`<< /Type /XObject /Subtype /Image /Width ${px.w} /Height ${px.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push("\nendstream");
  });
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(6, `<< /Title ${pdfString(info.title)} /Subject ${pdfString(info.subject)} /Producer (Poket) >>`);
  const xref = length;
  push(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}`);
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
