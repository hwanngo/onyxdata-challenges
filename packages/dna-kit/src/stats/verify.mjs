/**
 * Checks for the promoted statistical helpers.  `just test-kit`
 *
 * These assert PROPERTIES, not just values, because the two properties bootstrapSpread was
 * promoted for - determinism under a label, and independence from group ORDER - are exactly
 * the ones that silently broke in one month and produced three different published figures for
 * one quantity.
 *
 * A note on the fixture: the first version set num = den * 0.28 exactly, so every group's
 * ratio was identical, every spread was 0, and three checks "passed" while measuring nothing.
 * Row-level ratios must vary or the seed is untestable. That mistake is left recorded here
 * because it is the same shape as every fail-by-passing entry in .workbench/docs/LEARNINGS.md.
 */
import { wilson, mde, stdev, etaSquared, bootstrapSpread } from './index.ts';
let fail = 0;
const ok = (n, c, extra='') => { if(!c) fail++; console.log(`${c?'PASS':'FAIL'}  ${n}${extra?'  '+extra:''}`); };

// wilson: known value - 50/100 at z=1.96 is about 40.4% to 59.6%
const [lo, hi] = wilson(50, 100);
ok('wilson(50,100) brackets 50%', lo > 40.0 && lo < 40.8 && hi > 59.2 && hi < 60.0, `[${lo.toFixed(2)}, ${hi.toFixed(2)}]`);
ok('wilson(0,0) is NaN, not a crash', Number.isNaN(wilson(0,0)[0]));
// a tiny n must give a wide interval - the whole point
const [tl, th] = wilson(1, 3);
ok('wilson(1,3) is too wide to rank', th - tl > 50, `width ${(th-tl).toFixed(1)}pp`);

// stdev / mde
ok('stdev([2,4,4,4,5,5,7,9]) = 2', Math.abs(stdev([2,4,4,4,5,5,7,9]) - 2) < 1e-12);
const m = mde(4.873, 7431, 54708);
ok('mde matches the reference integrity.py (0.1687)', Math.abs(m - 0.1687) < 0.0005, m.toFixed(4));

// etaSquared: identical groups explain nothing; disjoint groups explain everything
ok('etaSquared of identical groups = 0', Math.abs(etaSquared([[1,2,3],[1,2,3]])) < 1e-12);
ok('etaSquared of tight disjoint groups ~ 1', etaSquared([[0,0,0],[10,10,10]]) > 0.999);

// bootstrapSpread: the two properties that were paid for
const n = 4000;
const num = new Float64Array(n), den = new Float64Array(n);
// Row-level ratios must VARY, or every resample returns exactly the same rate and the
// spread is identically zero - which makes the seed untestable. The earlier fixture set
// num = den*0.28 exactly and "passed" three checks by measuring nothing.
for (let i=0;i<n;i++){ den[i] = 100 + (i%37); num[i] = den[i]*(0.20 + ((i*7919)%1000)/1000*0.16); }
const sizes = [16, 500, 500, 526, 800, 1200];
const a = bootstrapSpread(num, den, sizes, 'Pharmacy', 400);
const b = bootstrapSpread(num, den, [...sizes].reverse(), 'Pharmacy', 400);
const c = bootstrapSpread(num, den, sizes, 'Pharmacy', 400);
const d = bootstrapSpread(num, den, sizes, 'Country', 400);
ok('bootstrapSpread is deterministic for one label', a === c, a.toFixed(6));
ok('bootstrapSpread is ORDER-INDEPENDENT', a === b, `${a.toFixed(6)} vs ${b.toFixed(6)}`);
ok('a different label gives an independent stream', a !== d, `${a.toFixed(6)} vs ${d.toFixed(6)}`);
console.log(fail ? `\n${fail} FAILED` : '\nAll stats helper checks passed.');
process.exit(fail ? 1 : 0);
