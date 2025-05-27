import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:375,height:900} });
await ctx.addInitScript(()=>localStorage.setItem('datadna-2025-05-tour-seen','1'));
const p = await ctx.newPage();
await p.goto('http://localhost:4173/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>document.querySelector('[data-metric="revenue"]')?.textContent?.includes('$'),{timeout:30000});
const bad = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.right > document.documentElement.clientWidth + 0.5 && r.width > 0) {
      out.push({ tag: el.tagName, cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0,40),
                 right: Math.round(r.right), width: Math.round(r.width) });
    }
  });
  return out.slice(0, 15);
});
console.log(JSON.stringify(bad, null, 1));
await b.close();
