import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * docs/copy.md: no user-facing string has an em dash or a straight apostrophe, or uses the words NUBAN, NIP or
 * "name enquiry". Checks every string the product code can show: JSX text, string literals and template text in
 * features/, lib/, store/ and components/ (comments, imports and object keys aren't copy; demo-only controls in
 * components/demo/ and the merchant demo pages aren't the product; icon and logo markup is data).
 */
const ROOT = process.cwd();
const SKIP = [/components\/demo\//, /lib\/icons\.ts$/, /lib\/vendor-logos\.ts$/];
const RULES: [string, RegExp][] = [
  ["em dash", /—/],
  ["straight apostrophe", /[A-Za-z]'[A-Za-z]|&apos;/],
  ["NUBAN", /\bNUBAN\b/i],
  ["NIP", /\bNIP\b/],
  ["name enquiry", /name enquiry/i],
];
/** Strings that are code, not copy: CSS selectors and HTML or SVG markup. */
const isCode = (s: string) => /^\s*</.test(s) || /^[[#.]/.test(s) || /\[[\w-]+=['"]/.test(s);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) && !/\.d\.ts$/.test(f) ? [p] : [];
  });
}

/** Every string a file could show, with its line. */
function strings(file: string): { line: number; text: string }[] {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { line: number; text: string }[] = [];
  const add = (node: ts.Node, text: string) => { if (text.trim()) out.push({ line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, text }); };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    // An object's keys aren't shown (e.g. the PDF's character table)
    if (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node) return;
    if (ts.isJsxText(node)) add(node, node.getText());
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node, node.text);
    else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) add(node, node.text);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

test("mock: no user-facing string has an em dash, a straight apostrophe, NUBAN, NIP or name enquiry", () => {
  const all = ["features", "lib", "store", "components"].flatMap((d) => files(path.join(ROOT, d))).filter((f) => !SKIP.some((r) => r.test(f)));
  expect(all.length).toBeGreaterThan(50);
  const found: string[] = [];
  let checked = 0;
  for (const f of all) {
    for (const s of strings(f)) {
      if (isCode(s.text)) continue;
      checked++;
      for (const [rule, re] of RULES) if (re.test(s.text)) found.push(`${path.relative(ROOT, f)}:${s.line} ${rule}: ${s.text.trim().slice(0, 90)}`);
    }
  }
  expect(checked).toBeGreaterThan(1000);
  expect(found).toEqual([]);
});

test("mock: the lint catches each rule", () => {
  const hit = (s: string) => RULES.filter(([, re]) => re.test(s)).map(([r]) => r);
  expect(hit("Fees — none")).toEqual(["em dash"]);
  expect(hit("We can't")).toEqual(["straight apostrophe"]);
  expect(hit("We can&apos;t")).toEqual(["straight apostrophe"]);
  expect(hit("Your NUBAN")).toEqual(["NUBAN"]);
  expect(hit("Send by NIP")).toEqual(["NIP"]);
  expect(hit("Name enquiry failed")).toEqual(["name enquiry"]);
  expect(hit("We can’t send by bank transfer. We check the name on the account.")).toEqual([]);
});
