import { chromium } from "playwright";

const SCAFFOLD_REWRITTEN = true;
if (!SCAFFOLD_REWRITTEN) process.exit(1);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
await context.addInitScript(() => localStorage.setItem("dna-2026-08-tour", "1"));
const page = await context.newPage();
let failed = 0;
const ok = (name, condition) => {
  if (!condition) failed += 1;
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}`);
};
const url = process.env.QA_URL || "http://localhost:4173";
await page.goto(`${url}/`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-metric="transactions"][data-value]');

const transactionValue = async (target = page) =>
  Number(await target.getAttribute('[data-metric="transactions"]', "data-value"));

const baseline = await transactionValue();
ok("baseline transaction count is 50,000", baseline === 50_000);
ok(
  "signature renders positive control plus four broken lanes",
  (await page.locator('#signature g[role="button"]').count()) === 5,
);

const controlsLane = page.locator("#signature .circuit-lane").first();
const start = Date.now();
await controlsLane.click();
await page.waitForSelector(".chip");
const interactionMs = Date.now() - start;
ok(`topic cross-filter paints in ${interactionMs}ms`, interactionMs < 200);
ok("chip bar exposes the active controls filter", (await page.locator(".chip").count()) >= 1);
ok("URL encodes shared filter state", (await page.url()).includes("f="));
ok("selected circuit lane remains visible", (await page.locator("#signature .circuit-lane.is-active").count()) === 1);
ok("unrelated evidence panels consume the filter by dimming", (await page.locator(".support-grid .is-dimmed").count()) > 0);
ok("filter never empties the signature", (await page.locator("#signature .circuit-lane").count()) === 4);
ok("first drill level renders a breadcrumb", (await page.locator('nav[aria-label="Drill path"]').count()) === 1);
await controlsLane.click();
await page.waitForTimeout(100);
ok("clicking the active lane clears its filter and breadcrumb", (await page.locator(".chip").count()) === 0 && (await page.locator('nav[aria-label="Drill path"]').count()) === 0);
await controlsLane.click();
await page.waitForSelector(".chip");

await page.getByRole("button", { name: "Drill to decision" }).click();
await page.waitForTimeout(100);
ok("decision drill adds a second breadcrumb level", (await page.locator('nav[aria-label="Drill path"] button').count()) >= 3);

await page.locator(".chip--clear").first().click();
await page.waitForTimeout(100);
ok("clear-all restores the unfiltered baseline", (await transactionValue()) === baseline);
ok("clear-all removes breadcrumbs", (await page.locator('nav[aria-label="Drill path"]').count()) === 0);

await controlsLane.focus();
ok("circuit lanes are keyboard focusable", await controlsLane.evaluate((node) => document.activeElement === node));
await page.keyboard.press("Enter");
await page.waitForTimeout(100);
ok("Enter activates the same topic filter", (await page.locator(".chip").count()) >= 1);
await page.locator(".chip--clear").first().click();

const srRows = await page.locator(".chartfig .sr-only table tbody tr").count();
ok(`screen-reader tables mirror every chart (${srRows} rows)`, srRows === 350);

await page.getByRole("button", { name: "Open guided tour" }).click();
await page.waitForTimeout(100);
ok("tour reopens", (await page.locator('[role="dialog"]').count()) === 1);
ok("tour starts at one of six", (await page.locator(".tour-steps").textContent())?.trim() === "1 / 6");
await page.keyboard.press("Escape");
await page.waitForTimeout(100);
ok("Escape closes the tour", (await page.locator('[role="dialog"]').count()) === 0);

const deep = await context.newPage();
const financeFilters = encodeURIComponent(JSON.stringify([{ field: "topic", values: ["finance"] }]));
await deep.goto(`${url}/?f=${financeFilters}`, { waitUntil: "networkidle" });
await deep.waitForSelector('[data-metric="transactions"][data-value]');
ok("deep link restores the finance chip", (await deep.locator(".chip").count()) >= 1);
ok("deep link focuses the finance circuit lane", (await deep.locator("#signature .circuit-lane.is-active").count()) === 1);
ok("deep link keeps the headline metric valid", (await transactionValue(deep)) === 50_000);

const unknown = await context.newPage();
const unknownFilters = encodeURIComponent(JSON.stringify([{ field: "topic", values: ["unknown"] }]));
await unknown.goto(`${url}/?f=${unknownFilters}`, { waitUntil: "networkidle" });
await unknown.waitForSelector('[data-metric="transactions"][data-value]');
ok("unknown deep link leaves the full circuit visible", (await unknown.locator("#signature .circuit-lane.is-dimmed").count()) === 0);
ok("unknown deep link renders the drawer empty-state", (await unknown.locator(".drawer-empty").count()) === 1);

await browser.close();
if (failed) {
  console.error(`\n${failed} interaction check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll August interaction checks passed.");
