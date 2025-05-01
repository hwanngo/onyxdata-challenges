#!/usr/bin/env node
/**
 * Fail on a published statistic that nothing recomputes  (gate G7, alongside verify_metrics.py).
 *
 * WHY THIS EXISTS. verify_metrics.py recomputes every number carrying a `data-metric`
 * attribute and asserts the DOM matches. It does that job perfectly and it is blind to
 * everything else. The dangerous defect lives in exactly that blind spot - a statistic typed
 * into prose, never tagged, therefore never recomputed, free to drift out of agreement with
 * the chart beside it. Shapes to expect:
 *
 *   a month  Explore.tsx  "ASP is flat across all three channels ($771-$792)"
 *                         - the table directly beneath printed $743-$806.
 *   a month  Explore.tsx  "Median views span 6.4% across eight countries"
 *                         - the true spread is 14.3%, and the ledger had ALREADY recorded
 *                           the correction. Only the UI kept the wrong number.
 *   a month  tour.ts      "981 of them are the 982 longest-standing members"
 *                         - the KPI tile behind it rendered 982 / 100.0%.
 *   a month  Dashboard    "93.8% live against 75.4%" - same page, same quantity, tagged as
 *                           95.07% / 77.30% forty lines lower.
 *
 * A screen contradicting itself is caught by no test, build or reviewer, because a hardcoded
 * string cannot disagree with itself - it can only disagree with the data, and nothing is
 * comparing them.
 *
 * WHAT IT FLAGS. Only statistic-SHAPED numbers: currency, percentages, pp/×/bp, decimals
 * with two or more places, thousands separators, and p / η² / r / V assignments. Layout
 * numbers (px, rem, viewBox, opacity, indices) are not statistics and are not flagged.
 *
 * HOW TO SATISFY IT. Preferred: wrap the figure in an element carrying `data-metric` and add
 * the SQL to model/metric_checks.yml, which makes it verified rather than merely correct.
 * Where that is genuinely impossible - a statistic with no single DOM home, such as a test
 * result quoted in a caption - add a suppression naming the ledger entry that owns it:
 *
 *     // prose-number-ok: C7 - permutation p, analysis/insights.md
 *
 * The suppression is greppable on purpose. "No query, no claim" applies to prose too.
 *
 * Usage:
 *   node tools/lint_prose_numbers.mjs 2025 06
 *   node tools/lint_prose_numbers.mjs --all
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(join(ROOT, "package.json"))("typescript");

const SUPPRESS = /prose-number-ok/;

/** A suppression names the ledger entry that owns the figure. That reference must RESOLVE.
 *
 *  A suppression citing a ledger entry that does not exist lets the lint pass on a reference
 *  to nothing, which is worse than no lint at all,
 *  because the file now claims an accountability it does not have. A suppression is a trade:
 *  you may leave the figure untagged IF a ledger entry carries its query. Both halves count. */
const ENTRY_TOKEN = /\b([A-Z]{1,3}-?\d+[a-z]?)\b/g;

function ledgerText(monthDir) {
  const dir = join(monthDir, "analysis");
  if (!existsSync(dir)) return "";
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}

/** Entry ids cited by a suppression comment that appear nowhere in the month's analysis/*.md. */
function danglingRefs(comment, ledger) {
  const body = comment.split(/prose-number-ok:?/)[1] || "";
  // Only the part before the separating dash is the reference; the rest is free-text.
  // Split on a SPACED dash only: ledger ids contain hyphens themselves (I-1, IR-5, A-2),
  // so an unspaced "-" would truncate every hyphenated id and silently disable this check.
  const ref = body.split(/\s+-+\s+/)[0];
  const ids = [...ref.matchAll(ENTRY_TOKEN)].map((m) => m[1]);
  return ids.filter((id) => !ledger.includes(id));
}

/** A number worth verifying. Deliberately narrow: these are the shapes a FINDING takes. */
const STAT_PATTERNS = [
  { re: /\$\s?\d[\d,]*(?:\.\d+)?/g, kind: "currency" },
  { re: /\d[\d,]*(?:\.\d+)?\s*%/g, kind: "percentage" },
  { re: /\d+(?:\.\d+)?\s*(?:pp|bp|×)\b/g, kind: "effect size" },
  { re: /\b\d{1,3}(?:,\d{3})+\b/g, kind: "count" },
  { re: /\b\d+\.\d{2,}\b/g, kind: "decimal" },
  { re: /\b(?:p|r|R²|η²|V|d|H|χ²)\s*[=<>]\s*-?\d*\.?\d+(?:e-?\d+)?/gi, kind: "test statistic" },
];

/** Layout, not data. A number immediately followed by one of these is never a finding. */
const CSS_UNIT = /^\s*(?:px|rem|em|vw|vh|vmin|vmax|ms|s|deg|fr|ch|pt)\b/;

/** A confidence LEVEL names the method, it is not a result of it. "95% interval" is a label;
 *  the interval's bounds are the statistic, and those are computed. Same for "5% / 1% level". */
const CONFIDENCE_LEVEL = /^\s*(?:interval|CI\b|confidence|level|significance|alpha)/i;

/** JSX attributes and object keys whose values are geometry or styling, never prose. */
const NON_PROSE_ATTRS = new Set([
  "style", "viewBox", "d", "transform", "points", "class", "className", "classList",
  "id", "href", "src", "key", "width", "height", "x", "y", "x1", "x2", "y1", "y2",
  "cx", "cy", "r", "rx", "ry", "dx", "dy", "offset", "stopColor", "stop-color",
  "fill", "stroke", "strokeWidth", "stroke-width", "opacity", "fillOpacity",
  "tabindex", "tabIndex", "colSpan", "rowSpan", "maxLength", "type", "role",
]);

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkFiles(p, out);
    else if (/\.(tsx|ts)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Statistic-shaped matches in a string, minus anything that is really a CSS length. */
function findStats(text) {
  const hits = [];
  for (const { re, kind } of STAT_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const after = text.slice(m.index + m[0].length);
      if (CSS_UNIT.test(after)) continue;
      if (kind === "percentage" && CONFIDENCE_LEVEL.test(after)) continue;
      hits.push({ text: m[0].trim(), kind });
    }
  }
  // one report per distinct literal
  return [...new Map(hits.map((h) => [h.text, h])).values()];
}

function hasTaggedAncestor(node) {
  for (let n = node; n; n = n.parent) {
    const opening = ts.isJsxElement(n)
      ? n.openingElement
      : ts.isJsxSelfClosingElement(n)
        ? n
        : null;
    if (!opening) continue;
    for (const attr of opening.attributes.properties) {
      if (ts.isJsxAttribute(attr) && attr.name.getText() === "data-metric") return true;
    }
  }
  return false;
}

/** True when this node sits inside a geometry/styling attribute or a `style` object. */
function inNonProseSlot(node) {
  for (let n = node; n; n = n.parent) {
    if (ts.isJsxAttribute(n) && NON_PROSE_ATTRS.has(n.name.getText())) return true;
    if (ts.isPropertyAssignment(n)) {
      const key = n.name.getText().replace(/['"]/g, "");
      if (NON_PROSE_ATTRS.has(key) || /^--/.test(key)) return true;
    }
  }
  return false;
}

/** A suppression attached as a leading comment to the literal or to any enclosing node -
 *  the property, the JSX attribute, the statement. Uses the parser's own comment ranges so a
 *  multi-line justification works wherever the token sits within it. */
function hasSuppressingComment(node, src) {
  for (let n = node, depth = 0; n && depth < 6; n = n.parent, depth++) {
    const ranges = ts.getLeadingCommentRanges(src, n.getFullStart()) || [];
    for (const r of ranges) {
      const text = src.slice(r.pos, r.end);
      if (SUPPRESS.test(text)) return text;
    }
  }
  return null;
}

function lintFile(file, ledger = "") {
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines = src.split("\n");
  const findings = [];

  const report = (node, text) => {
    if (inNonProseSlot(node) || hasTaggedAncestor(node)) return;
    const stats = findStats(text);
    if (!stats.length) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    const own = lines[line] || "";
    const comment = SUPPRESS.test(own) ? own : hasSuppressingComment(node, src);
    if (comment) {
      // A suppression is only worth as much as the ledger entry it names.
      const dangling = danglingRefs(comment, ledger);
      if (dangling.length) {
        findings.push({
          line: line + 1,
          stats: [{ text: dangling.join(", "), kind: "suppressed against a ledger entry that does not exist" }],
          snippet: own.trim().slice(0, 110),
        });
      }
      return;
    }
    findings.push({ line: line + 1, stats, snippet: own.trim().slice(0, 110) });
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) report(node, node.text);
    else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!ts.isImportDeclaration(node.parent)) report(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      const raw = node.head.text + node.templateSpans.map((s) => s.literal.text).join(" ");
      report(node, raw);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

function lintMonth(year, month) {
  const dir = join(ROOT, year, month, "app", "src");
  if (!existsSync(dir)) return null;
  const ledger = ledgerText(join(ROOT, year, month));
  const rows = [];
  for (const f of walkFiles(dir)) {
    for (const fd of lintFile(f, ledger)) rows.push({ file: relative(ROOT, f), ...fd });
  }
  return rows;
}

function main() {
  const args = process.argv.slice(2);
  let targets = [];
  if (args[0] === "--all") {
    for (const y of readdirSync(ROOT).filter((d) => /^\d{4}$/.test(d)).sort())
      for (const m of readdirSync(join(ROOT, y)).filter((d) => /^\d{2}$/.test(d)).sort())
        targets.push([y, m]);
  } else if (args.length >= 2) {
    targets = [[args[0], args[1]]];
  } else {
    console.error("usage: lint_prose_numbers.mjs <YEAR> <MONTH> | --all");
    return 2;
  }

  let total = 0;
  for (const [y, m] of targets) {
    const rows = lintMonth(y, m);
    if (rows === null) continue;
    if (!rows.length) {
      console.log(`${y}/${m}  ok - every published statistic is tagged or declared`);
      continue;
    }
    total += rows.length;
    console.log(`\n${y}/${m}  ${rows.length} untagged statistic${rows.length > 1 ? "s" : ""}`);
    for (const r of rows) {
      const what = r.stats.map((s) => `${s.text} (${s.kind})`).join(", ");
      console.log(`  ${r.file}:${r.line}`);
      console.log(`      ${what}`);
      console.log(`      ${r.snippet}`);
    }
  }

  if (total) {
    console.log(
      `\n${total} statistic(s) rendered with nothing recomputing them.\n` +
        "Tag the figure with data-metric and specify it in model/metric_checks.yml, or add\n" +
        "  // prose-number-ok: <ledger entry> - <why it has no single DOM home>\n",
    );
    return 1;
  }
  return 0;
}

process.exit(main());
