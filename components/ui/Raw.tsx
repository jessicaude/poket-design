/** Renders an SVG/HTML snippet from lib/icons.ts without adding a box (display: contents), so layouts match the prototype. */
export function Raw({ html }: { html: string }) {
  return <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />;
}
