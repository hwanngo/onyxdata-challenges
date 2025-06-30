import { chromium } from 'playwright';
// QA_URL so this runs against whatever port the preview is on; 4174 is the vite default.
const URL=process.env.QA_URL||'http://localhost:4174', KEY=process.env.QA_TOUR_KEY||'datadna-2025-06-tour-seen';
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:950}});
await ctx.addInitScript(k=>localStorage.setItem(k,'1'),KEY);
const p=await ctx.newPage(); const ok=(n,c)=>console.log(`${c?'PASS':'FAIL'}  ${n}`);
await p.goto(URL+'/',{waitUntil:'networkidle'});
await p.waitForFunction(()=>document.querySelector('[data-metric="prov.views"]')?.getAttribute('data-value'),{timeout:30000});
const views=()=>p.getAttribute('[data-metric="prov.views"]','data-value');
const base=await views(); ok('baseline views = 4,806,275,234', Math.round(+base)===4806275234);
const t0=Date.now();
await p.click('[data-metric="post_type.Video.med_views"]');
await p.waitForFunction(v=>document.querySelector('[data-metric="prov.views"]')?.getAttribute('data-value')!==v,base,{timeout:5000});
const ms=Date.now()-t0;
ok(`format cross-filter applies (${ms}ms)`, ms<200);
ok('chip bar shows active filter',(await p.locator('.chip').count())>=1);
ok('URL encodes filter state',(await p.url()).includes('f='));
ok('platform panel recomputed under filter',(await p.locator('[data-metric^="platform."]').count())===6);
const provDerived=await p.locator('.pv-derived').count();
ok('provenance marks stay DERIVED under filter', provDerived===4);
await p.locator('.chip--clear').click(); await p.waitForTimeout(200);
ok('clear-all restores dataset', Math.round(+(await views()))===4806275234);
// the mirage toggle - the month's signature interaction
const beforeRows=await p.locator('#mirage [role="button"]').count();
await p.locator('button:has-text("Group by content category")').click(); await p.waitForTimeout(250);
ok('mirage toggle regroups by category', /spread/i.test(await p.locator('#mirage').innerText()));
await p.locator('button:has-text("Rank hashtags")').click(); await p.waitForTimeout(200);
ok('mirage toggle returns to ranking',(await p.locator('#mirage [role="button"]').count())===beforeRows);
// keyboard
const kb=await p.evaluate(()=>{const g=document.querySelector('g[role="button"]');g.focus();return document.activeElement===g;});
ok('chart marks keyboard focusable',kb);
const sr=await p.locator('.chartfig .sr-only table tbody tr').count();
ok(`accessible data tables present (${sr} rows)`, sr>20);
await p.click('button[aria-label="Open guided tour"]'); await p.waitForTimeout(200);
ok('tour re-opens',(await p.locator('[role="dialog"]').count())===1);
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok('Esc closes tour',(await p.locator('[role="dialog"]').count())===0);
// empty state
const p2=await ctx.newPage();
await p2.goto(URL+'/?f='+encodeURIComponent(JSON.stringify([{field:'platform',values:['Facebook']},{field:'post_type',values:['PDF']}])),{waitUntil:'networkidle'});
await p2.waitForTimeout(1500);
ok('impossible filter renders without error',(await p2.locator('[data-metric="prov.views"]').count())===1);
await b.close();
