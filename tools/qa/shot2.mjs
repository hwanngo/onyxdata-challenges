import { tourKeyFor } from './tourkey.mjs';
// The month's own key, not the literal 'tour-seen' (which matches no month). See tourkey.mjs.
const TOUR_KEY = tourKeyFor(process.argv[2], process.argv[3]);
import { chromium } from 'playwright';
const [url, out, w, h, skipTour] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
if (skipTour) await ctx.addInitScript((k) => localStorage.setItem(k,'1'), TOUR_KEY);
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForFunction(() => { const e = document.querySelector('[data-metric]'); return !!(e && e.getAttribute('data-value')); }, { timeout: 30000 });
await p.waitForTimeout(600);
await p.screenshot({ path: out, fullPage: true });
console.log('shot ' + out + (errs.length ? '\nERRORS: '+errs.slice(0,8).join('\n') : ' - clean'));
await b.close();
