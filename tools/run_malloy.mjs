/**
 * Compile and execute the month's Malloy model, printing each view's result.
 *
 * A semantic layer that has never been run is not evidence, it is a text file.
 * This is what makes model.malloy verifiable - and what verify_metrics.py checks
 * the UI against.
 *
 *   node tools/run_malloy.mjs 2025 05 [viewName]
 */
import { SingleConnectionRuntime } from '@malloydata/malloy';
import { DuckDBConnection } from '@malloydata/db-duckdb';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [year, month, only] = process.argv.slice(2);
if (!year || !month) {
  console.error('usage: node tools/run_malloy.mjs <year> <month> [viewName]');
  process.exit(2);
}

const root = resolve(new URL('..', import.meta.url).pathname);
const modelPath = resolve(root, year, month, 'model/model.malloy');
const modelDir = dirname(modelPath);

// Malloy resolves table paths relative to the process cwd, and the model uses
// '../data/curated/*.parquet' relative to itself.
process.chdir(modelDir);

const connection = new DuckDBConnection('duckdb');
const runtime = new SingleConnectionRuntime({ connection });
const src = readFileSync(modelPath, 'utf8');

// Views are parsed out of the model rather than hardcoded, so this tool works for any
// month without editing. Order follows the file, which is the narrative order.
//
// A view is run against THE SOURCE THAT DECLARES IT, not against a single guessed fact.
// Originally this took the last `source:` in the file and ran everything through it,
// which worked only while a month had exactly one source carrying views. September has
// two - a loan fact and a `dim_column` provenance table that has views of its own - and
// the old heuristic failed three of sixteen with a confusing "not found" error.
//
// Each source's extend block is located by brace-matching from its opening `{`, and every
// `view:` inside that span is attributed to it.
function ownerOf(text) {
  const owners = new Map(); // viewName -> sourceName
  const srcRe = /^source:\s*([A-Za-z_][A-Za-z0-9_]*)\s+is\s+[^\n]*?extend\s*\{/gm;
  for (const m of text.matchAll(srcRe)) {
    const name = m[1];
    let i = text.indexOf('{', m.index + m[0].length - 1);
    let depth = 0;
    let end = i;
    for (; end < text.length; end++) {
      if (text[end] === '{') depth++;
      else if (text[end] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = text.slice(i, end);
    for (const v of body.matchAll(/^\s*view:\s*([A-Za-z_][A-Za-z0-9_]*)\s+is\s*\{/gm)) {
      owners.set(v[1], name);
    }
  }
  return owners;
}

const OWNERS = ownerOf(src);
const ALL_VIEWS = [...src.matchAll(/^\s*view:\s*([A-Za-z_][A-Za-z0-9_]*)\s+is\s*\{/gm)]
  .map((m) => m[1]);
const VIEWS = only ? [only] : ALL_VIEWS;

// Fallback for a view whose owner could not be resolved (e.g. a top-level declaration):
// the last duckdb-backed source, which is the old behaviour.
const SOURCES = [...src.matchAll(/^source:\s*([A-Za-z_][A-Za-z0-9_]*)\s+is\s+duckdb\.table/gm)]
  .map((m) => m[1]);
const FALLBACK = process.env.MALLOY_SOURCE || SOURCES[SOURCES.length - 1];

if (!VIEWS.length) {
  console.error(`No 'view:' declarations found in ${modelPath}`);
  process.exit(2);
}
const bySource = [...new Set(VIEWS.map((v) => OWNERS.get(v) || FALLBACK))];
console.log(`sources: ${bySource.join(', ')}   views: ${VIEWS.length}`);

let failed = 0;
for (const view of VIEWS) {
  const owner = OWNERS.get(view) || FALLBACK;
  const query = `${src}\nrun: ${owner} -> ${view}\n`;
  try {
    const result = await runtime.loadQuery(query).run();
    const rows = result.data.toObject();
    console.log(`\n${'='.repeat(78)}\nrun: ${owner} -> ${view}   (${rows.length} rows)\n${'='.repeat(78)}`);
    // DuckDB returns BIGINT sums as JS BigInt, which JSON.stringify refuses to serialize.
    const safe = (_k, v) => (typeof v === 'bigint' ? Number(v) : v);
    console.log(JSON.stringify(rows, safe, 1).slice(0, 4000));
  } catch (e) {
    failed++;
    console.error(`\n!! ${view} FAILED\n${e.message}\n`);
  }
}

await connection.close();
console.log(`\n${VIEWS.length - failed}/${VIEWS.length} views ran clean.`);
process.exit(failed ? 1 : 0);
