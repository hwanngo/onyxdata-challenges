/**
 * G6/G7 interaction matrix for 2026/10 Sunrise Coffee ("Same cup, different rent").
 *
 * Every expected value is derived from the JSON bundle the page itself loads (or is a structural
 * count fixed by the archive: 60 stores, 12 regions, 24 months, 24 contract rows), never a number
 * copied from a previous month. Run against `vite preview` (QA_URL, default :4173) or the dev server.
 */
import { chromium } from "playwright";

const URL0 = (process.env.QA_URL || "http://localhost:4173").replace(/\/$/, "");
const TOUR_KEY = "sunrise-2026-10-tour-seen";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
await ctx.addInitScript((k) => localStorage.setItem(k, "1"), TOUR_KEY);
const p = await ctx.newPage();
const pageErrors = [];
p.on("pageerror", (e) => pageErrors.push(String(e)));

let failed = 0;
const ok = (name, cond) => {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
};
const val = async (id) => {
  const raw = await p.getAttribute(`[data-metric="${id}"]`, "data-value", { timeout: 3000 }).catch(() => null);
  return raw === null ? NaN : Number(raw);
};
const ready = () =>
  p.waitForFunction(() => document.querySelector('[data-metric="kpi.revenue"]')?.getAttribute("data-value"), null, { timeout: 30_000 });
const close = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));

await p.goto(`${URL0}/`, { waitUntil: "networkidle" });
await ready();

// ---------------------------------------------------------------- expectations from the bundle
const bundle = await p.evaluate(async () => {
  const get = (n) => fetch(`/data/${n}.json`).then((r) => r.json());
  const [stores, months, contract] = await Promise.all([get("stores"), get("store_months"), get("contract")]);
  return { stores, months, contract };
});
const fixedOf = new Map();
for (const m of bundle.months) {
  const a = fixedOf.get(m.s) ?? { f: 0, n: 0 };
  a.f += m.rent + m.staff;
  a.n += 1;
  fixedOf.set(m.s, a);
}
const fixedPm = [...fixedOf.entries()].map(([s, a]) => [s, a.f / a.n]).sort((x, y) => x[1] - y[1]);
const med = (fixedPm[29][1] + fixedPm[30][1]) / 2;
const upper = new Set(fixedPm.filter(([, f]) => f > med).map(([s]) => s));
const london = new Set(bundle.stores.filter((s) => s.region === "London").map((s) => s.id));
const sumRev = (ids, year) =>
  bundle.months.filter((m) => ids.has(m.s) && (!year || m.m.startsWith(String(year)))).reduce((t, m) => t + m.rev, 0);
const allIds = new Set(bundle.stores.map((s) => s.id));

// ---------------------------------------------------------------- baseline
ok("baseline: whole estate selected (60 stores)", (await val("selected.stores")) === bundle.stores.length);
ok("baseline: KPI revenue equals the bundle sum", close(await val("kpi.revenue"), sumRev(allIds)));
const cups = p.locator('svg[aria-label^="Sixty"] .mark');
ok("signature renders one cup per store", (await cups.count()) === bundle.stores.length);
ok("region map renders 12 regions", (await p.locator('svg[aria-label="Region cost map"] .mark').count()) === 12);
ok("exactly one cup overflows (loss fill present once)", (await p.locator('rect[fill="var(--loss)"]').count()) === 1);

// ---------------------------------------------------------------- cost-half filter
let t0 = Date.now();
await p.getByRole("button", { name: "Higher-cost half", exact: true }).click();
await p.waitForFunction((n) => document.querySelector('[data-metric="selected.stores"]')?.getAttribute("data-value") === String(n), upper.size, { timeout: 5000 });
const ms = Date.now() - t0;
ok(`cost-half filter applies in ${ms}ms (budget 200ms)`, ms < 200);
ok("cost-half: selected revenue = bundle sum over the 30 higher-cost stores", close(await val("selected.revenue"), sumRev(upper)));
ok("cost-half: URL encodes the filter", p.url().includes("half=Higher-cost"));
ok("cost-half: the signature keeps all 60 cups and dims the other 30", (await cups.count()) === 60 && (await p.locator('svg[aria-label^="Sixty"] .mark.is-dim').count()) === 30);
ok("cost-half: week panel switches to the selected.* namespace", !Number.isNaN(await val("selected.week.gap")) && Number.isNaN(await val("week.gap")));
ok("cost-half: an active-filter chip appears", (await p.locator(".cuts .cut").count()) === 1);

// ---------------------------------------------------------------- add region (intersection)
await p.selectOption('select[aria-label="Add a region filter"]', "London");
const londonUpper = new Set([...london].filter((s) => upper.has(s)));
await p.waitForFunction((n) => document.querySelector('[data-metric="selected.stores"]')?.getAttribute("data-value") === String(n), londonUpper.size, { timeout: 5000 });
ok(`region + cost-half intersect (${londonUpper.size} stores)`, close(await val("selected.revenue"), sumRev(londonUpper)));

// ---------------------------------------------------------------- year filter re-computes the charts
await p.getByRole("button", { name: "2024", exact: true }).click();
await p.waitForTimeout(150);
ok("year: selection revenue restricted to 2024", close(await val("selected.revenue"), sumRev(londonUpper, 2024)));
ok("year: cups re-tagged selected.* (300 layers)", (await p.locator('[data-metric^="selected.cups."]').count()) === 300);
ok("year: region map re-tagged selected.* (48 marks)", (await p.locator('[data-metric^="selected.region."]').count()) === 48);

// ---------------------------------------------------------------- back button restores the previous state
await p.goBack();
await p.waitForTimeout(200);
ok("browser Back removes the year filter", !p.url().includes("year=") && (await p.locator('[data-metric^="selected.cups."]').count()) === 0);

// ---------------------------------------------------------------- clear all
await p.getByRole("button", { name: "Clear all" }).click();
await p.waitForTimeout(150);
ok("clear all restores 60 stores and a clean URL", (await val("selected.stores")) === 60 && !p.url().includes("?"));
ok("clear all restores release ids", !Number.isNaN(await val("week.gap")));

// ---------------------------------------------------------------- keyboard: roving focus + drill
await cups.first().focus();
await p.keyboard.press("ArrowRight");
ok("arrow keys move focus along the cups", await p.evaluate(() => document.activeElement === document.querySelectorAll('svg[aria-label^="Sixty"] .mark')[1]));
await p.keyboard.press("End");
ok("End jumps to the last cup", await p.evaluate(() => { const m = document.querySelectorAll('svg[aria-label^="Sixty"] .mark'); return document.activeElement === m[m.length - 1]; }));
await p.keyboard.press("Enter");
await p.waitForSelector('[role="dialog"]', { timeout: 3000 });
ok("Enter on a cup opens the store drawer", p.url().includes("store="));
ok("drawer lists all 24 months", (await p.locator('[role="dialog"] [data-metric$=".rev"][data-metric^="drill."]').count()) === 24);
ok("focus moves into the drawer", await p.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));
await p.keyboard.press("Escape");
await p.waitForTimeout(150);
ok("Escape closes the drawer and returns focus to the cup", (await p.locator('[role="dialog"]').count()) === 0 && await p.evaluate(() => document.activeElement?.classList.contains("mark")));

// ---------------------------------------------------------------- deep link to the loss store
const lossId = [...new Set(bundle.months.map((m) => m.s))].find((s) => bundle.months.filter((m) => m.s === s).reduce((t, m) => t + m.np, 0) < 0);
await p.goto(`${URL0}/?store=${lossId}`, { waitUntil: "networkidle" });
await ready();
ok("deep link opens the loss store, ranked last on margin", (await val("drill.margin_rank")) === bundle.stores.length);
await p.keyboard.press("Escape");

// ---------------------------------------------------------------- source audit + theme + empty state
await p.getByRole("button", { name: "Source audit" }).click();
ok("source audit lists every contract row", (await p.locator('[aria-labelledby="audit-h"] tbody tr').count()) === bundle.contract.length);
await p.getByRole("button", { name: "Close source audit" }).click();
await p.getByRole("button", { name: /Colour theme/ }).click();
ok("theme toggle applies dark explicitly", (await p.locator("html").getAttribute("data-theme")) === "dark");

const regions = new Set(bundle.stores.map((s) => s.region));
const locs = new Set(bundle.stores.map((s) => s.loc));
let empty = null;
for (const r of regions) for (const l of locs) if (!empty && !bundle.stores.some((s) => s.region === r && s.loc === l)) empty = [r, l];
await p.goto(`${URL0}/?region=${empty[0]}&loc=${empty[1]}`, { waitUntil: "networkidle" });
await ready();
ok("zero-row filter shows a recovery message, not NaN", (await p.getByText("No store matches these filters").count()) === 1 && !(await p.locator("body").innerText()).includes("NaN"));

ok("no uncaught page errors", pageErrors.length === 0);
await browser.close();
console.log(failed ? `\n${failed} FAILED` : "\nAll interaction checks pass.");
process.exit(failed ? 1 : 0);
