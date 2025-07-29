/**
 * Poster fit measurement - does the composition actually fit 2560x1440?
 *
 * Three months running this was the single most reliable time sink: the poster overflows,
 * you tune a font size, it overflows somewhere else. Measuring beats squinting.
 *
 * GENERIC since an early rewrite. It previously hard-coded one month's class names (`.shell`,
 * `.grid-main`, `.col-right`, `#bands`) and crashed with a null getBoundingClientRect the
 * moment a month laid its poster out differently. It now finds the poster root by class
 * and walks its real children, so it works for any month without editing.
 *
 *   QA_URL=http://localhost:5173 node tools/qa/measure.mjs
 */
import { chromium } from 'playwright';

import { tourKeyFor } from './tourkey.mjs';
// The month's own key, not the literal 'tour-seen' (which matches no month). See tourkey.mjs.
const TOUR_KEY = tourKeyFor(process.argv[2], process.argv[3]);
const URL = process.env.QA_URL || 'http://localhost:4173';
const H = 1440;
const W = 2560;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript((k) => localStorage.setItem(k, '1'), TOUR_KEY);
const p = await ctx.newPage();
await p.goto(`${URL}/poster`, { waitUntil: 'networkidle' });
await p.waitForFunction(
  () => {
    const e = document.querySelector('[data-metric]');
    return !!(e && e.getAttribute('data-value'));
  },
  { timeout: 30000 }
);
await p.waitForTimeout(400);

const m = await p.evaluate(() => {
  const root =
    document.querySelector('.poster') ||
    document.querySelector('.poster-root') ||
    document.body;
  const box = (e) => {
    const r = e.getBoundingClientRect();
    return { h: Math.round(r.height), w: Math.round(r.width), bottom: Math.round(r.bottom) };
  };
  const name = (e) =>
    e.tagName.toLowerCase() +
    (e.id ? `#${e.id}` : '') +
    (e.className && typeof e.className === 'string'
      ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '');
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    bodyScrollH: document.body.scrollHeight,
    bodyScrollW: document.body.scrollWidth,
    root: { ...box(root), scrollH: root.scrollHeight, scrollW: root.scrollWidth },
    // `display: contents` wrappers report h=0 and are not what you want to see; walk
    // through them to the panels that actually occupy grid cells.
    children: [...root.children].flatMap((e) =>
      getComputedStyle(e).display === 'contents'
        ? [...e.children].map((c) => ({ el: name(c), ...box(c) }))
        : [{ el: name(e), ...box(e) }]
    ),
    // Anything painting past the bottom edge is what to shrink -- EXCLUDING visually
    // hidden content. A .sr-only wrapper is clipped to 1x1 and paints nothing, but the
    // table inside it still reports its full layout height, which read as a 155px
    // overflow that does not exist. Ignore anything inside a clipped subtree.
    overflowing: [...root.querySelectorAll('*')]
      .filter((e) => !e.closest('.sr-only') && e.getBoundingClientRect().bottom > 1441)
      .slice(0, 12)
      .map((e) => ({ el: name(e), bottom: Math.round(e.getBoundingClientRect().bottom) })),

    // CONTENT CLIPPED INSIDE A CONTAINER THAT ITSELF FITS. The two checks above cannot
    // see this, and it is the failure that actually ships. `.poster` sets
    // `overflow: hidden`, which CLAMPS root.scrollHeight to the visible height - so the
    // vOver arithmetic can never report a poster that is silently cutting its own
    // contents. And a chart clipped inside `.grid-main` has a bottom edge well inside
    // 1440, so the y>1440 scan misses it too.
    //
    // A month shipped a poster with the Live Stream bar's label and half a caption cut
    // off, twice, and this harness said FITS both times. On a fixed 2560x1440 canvas
    // nothing is user-scrollable, so any element whose content exceeds its own clipped
    // box is losing information a reader will never see.
    // MEASURE PAINTED GEOMETRY AGAINST THE CLIP EDGE, not scrollHeight.
    //
    // The first version of this check used `scrollHeight - clientHeight`, which is wrong
    // in both directions. Chrome computes an overflow container's scrollHeight as the
    // scrollable overflow region PLUS padding-bottom, so it fires on any padded container
    // whose content merely encroaches on its own padding - cosmetic, nothing lost - and it
    // would equally miss a real truncation in an unpadded container that rounds down.
    // A month was reported as "losing 13px" when its deepest painted pixel sat 15.5px
    // clear of the edge; the figure tracked `padding-bottom - 15` exactly and revealed
    // nothing as it fell to zero. Silencing that would have meant tightening a poster's
    // bottom margin to satisfy an arithmetic artifact.
    //
    // The clip edge IS the padding box. A child painting past it is losing pixels; a child
    // inside it is not, however much padding it eats.
    clipped: [...root.querySelectorAll('*')]
      .filter((e) => {
        if (e.closest('.sr-only')) return false;
        const cs = getComputedStyle(e);
        return ['hidden', 'clip'].includes(cs.overflowY) || ['hidden', 'clip'].includes(cs.overflowX);
      })
      .map((e) => {
        const edge = e.getBoundingClientRect();
        const kids = [...e.querySelectorAll('*')].filter(
          (c) => !c.closest('.sr-only') && c.getBoundingClientRect().height > 0
        );
        if (!kids.length) return null;
        const boxes = kids.map((c) => c.getBoundingClientRect());
        const lostY = Math.max(0, Math.max(...boxes.map((b) => b.bottom)) - edge.bottom);
        const lostX = Math.max(0, Math.max(...boxes.map((b) => b.right)) - edge.right);
        return lostY > 0.5 || lostX > 0.5
          ? { el: name(e), lostY: Math.round(lostY), lostX: Math.round(lostX) }
          : null;
      })
      .filter(Boolean)
      .slice(0, 12),

    // Non-fatal: content growing into its own padding. True, occasionally worth knowing,
    // never a reason to fail a build.
    padded: [...root.querySelectorAll('*')]
      .filter((e) => {
        if (e.closest('.sr-only')) return false;
        const cs = getComputedStyle(e);
        const hides = ['hidden', 'clip'].includes(cs.overflowY);
        return hides && e.scrollHeight - e.clientHeight > 1;
      })
      .slice(0, 6)
      .map((e) => ({ el: name(e), into: e.scrollHeight - e.clientHeight })),
  };
});

const vOver = m.root.scrollH - H;
const hOver = m.root.scrollW - W;

console.log(`poster root ${m.root.w}x${m.root.h}  (scroll ${m.root.scrollW}x${m.root.scrollH})`);
console.log(`body scroll ${m.bodyScrollW}x${m.bodyScrollH}\n`);
console.log('direct children:');
for (const c of m.children) console.log(`  ${c.el.padEnd(34)} h=${String(c.h).padStart(5)}  bottom=${c.bottom}`);

if (m.overflowing.length) {
  console.log('\nelements past y=1440:');
  for (const o of m.overflowing) console.log(`  ${o.el.padEnd(34)} bottom=${o.bottom}`);
}

if (m.clipped.length) {
  console.log('\nCONTENT CLIPPED INSIDE ITS OWN CONTAINER (silently cut, reader never sees it):');
  for (const c of m.clipped) {
    const lost = [c.lostY ? `${c.lostY}px below` : null, c.lostX ? `${c.lostX}px right` : null]
      .filter(Boolean)
      .join(', ');
    console.log(`  ${c.el.padEnd(34)} paints ${lost} of its clip edge`);
  }
}

if (m.padded.length) {
  console.log('\nnote - content growing into its own padding (not clipped, nothing lost):');
  for (const c of m.padded) console.log(`  ${c.el.padEnd(34)} ${c.into}px into padding`);
}

console.log();
if (vOver > 0) console.log(`VERTICAL OVERFLOW: ${vOver}px past 1440 - shrink the list above.`);
if (hOver > 0) console.log(`HORIZONTAL OVERFLOW: ${hOver}px past 2560.`);
if (m.clipped.length) {
  console.log(
    `CLIPPED: ${m.clipped.length} element(s) are cutting their own contents. ` +
      'The poster "fits" only because overflow:hidden is hiding the evidence.'
  );
}
if (vOver <= 0 && hOver <= 0 && !m.clipped.length) {
  console.log(`FITS. ${-vOver}px of vertical slack, ${-hOver}px horizontal.`);
}

await b.close();
process.exit(vOver > 0 || hOver > 0 || m.clipped.length ? 1 : 0);
