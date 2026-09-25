import { chromium } from "playwright";

const baseUrl = process.env.QA_URL || "http://localhost:4173";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
await context.addInitScript(() => {
  localStorage.setItem("dnakit-2026-09-tour-seen", "1");
});
const page = await context.newPage();
let failed = 0;
const ok = (name, condition) => {
  if (!condition) failed += 1;
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}`);
};

await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
await page.waitForFunction(
  () => document.querySelector('[data-metric="selected.order_rows"]')?.getAttribute("data-value") === "5000",
  { timeout: 30_000 },
);

const baseline = Number(await page.getAttribute('[data-metric="selected.order_rows"]', "data-value"));
ok("baseline allocation rows = 5,000", baseline === 5_000);
ok("allocation matrix renders all 80 corridors", (await page.locator(".matrix-cell").count()) === 80);
ok("dial bank renders nine quarantined measures", (await page.locator(".measure-dial").count()) === 9);
ok("process ruler renders eight expected links", (await page.locator(".process-mark").count()) === 8);
ok("claim scorecard renders five supplied claims", (await page.locator(".claim-row").count()) === 5);
ok(
  "reader-facing claim labels say contradicted rather than rejected",
  (await page.locator(".rail-key").textContent())?.includes("contradicted") &&
    (await page.locator(".claim-summary").textContent())?.includes("contradicted"),
);
ok("contract matrix renders 54 constraint contacts", (await page.locator(".contract-cell").count()) === 54);
ok("contract matrix renders seven relationship jumpers", (await page.locator(".relationship-jump").count()) === 7);

await page.getByRole("button", { name: "dark", exact: true }).click();
ok("dark theme applies explicitly", (await page.locator("html").getAttribute("data-theme")) === "dark");
await page.getByRole("button", { name: "system", exact: true }).click();
ok("system theme removes explicit override", (await page.locator("html").getAttribute("data-theme")) === null);

const firstMatrixCell = page.locator(".matrix-cell").first();
await firstMatrixCell.focus();
await page.keyboard.press("ArrowRight");
ok(
  "matrix arrow keys move focus between cells",
  await page.evaluate(() => document.activeElement === document.querySelectorAll(".matrix-cell")[1]),
);

const allocations = await page.evaluate(async () => {
  const response = await fetch("/data/allocations.json");
  return response.json();
});
const kitchenId = allocations[0].kitchen_id;
const expectedKitchenRows = allocations.filter((row) => row.kitchen_id === kitchenId).length;
const beforeFilter = await page.getAttribute('[data-metric="selected.order_rows"]', "data-value");
const started = Date.now();
await page.selectOption("#kitchen-filter", kitchenId);
await page.waitForFunction(
  ([previous, expected]) =>
    document.querySelector('[data-metric="selected.order_rows"]')?.getAttribute("data-value") !== previous &&
    Number(document.querySelector('[data-metric="selected.order_rows"]')?.getAttribute("data-value")) === expected,
  [beforeFilter, expectedKitchenRows],
  { timeout: 5_000 },
);
ok("kitchen filter recomputes allocation rows", Date.now() - started < 200);
ok("filter chip is visible", (await page.locator(".chip").count()) >= 1);
ok("URL encodes filter state", (await page.url()).includes("f="));
ok("filter preserves the complete 80-cell matrix", (await page.locator(".matrix-cell").count()) === 80);
ok(
  "release-level evidence is labelled as unrefiltered",
  (await page.locator(".release-level-badge").count()) >= 1,
);
await page.locator(".matrix-cell").first().click();
await page.waitForTimeout(50);
await page.goBack();
await page.waitForFunction(() => document.querySelector(".evidence-drawer") === null);
ok(
  "browser back restores allocation filter and clears newer evidence focus",
  Number(await page.getAttribute('[data-metric="selected.order_rows"]', "data-value")) === expectedKitchenRows,
);

await page.click(".chip--clear");
await page.waitForFunction(
  () => document.querySelector('[data-metric="selected.order_rows"]')?.getAttribute("data-value") === "5000",
);
ok("clear all restores full allocation", true);

const dimensionCases = [
  ["zone", "#zone-filter", allocations[0].zone_id, (row) => row.zone_id === allocations[0].zone_id],
  ["rider", "#rider-filter", allocations[0].rider_id, (row) => row.rider_id === allocations[0].rider_id],
  [
    "month",
    "#month-filter",
    allocations[0].order_date.slice(0, 7),
    (row) => row.order_date.startsWith(allocations[0].order_date.slice(0, 7)),
  ],
];
for (const [label, selector, value, predicate] of dimensionCases) {
  const expected = allocations.filter(predicate).length;
  await page.selectOption(selector, value);
  await page.waitForFunction(
    (count) => Number(document.querySelector('[data-metric="selected.order_rows"]')?.getAttribute("data-value")) === count,
    expected,
  );
  ok(`${label} filter recomputes allocation rows`, true);
  await page.click(".chip--clear");
  await page.waitForFunction(
    () => document.querySelector('[data-metric="selected.order_rows"]')?.getAttribute("data-value") === "5000",
  );
}

const existingTriples = new Set(
  allocations.map((row) => `${row.kitchen_id}|${row.zone_id}|${row.rider_id}`),
);
let emptyCombination;
for (const candidateKitchen of [...new Set(allocations.map((row) => row.kitchen_id))]) {
  for (const candidateZone of [...new Set(allocations.map((row) => row.zone_id))]) {
    for (const candidateRider of [...new Set(allocations.map((row) => row.rider_id))]) {
      if (!existingTriples.has(`${candidateKitchen}|${candidateZone}|${candidateRider}`)) {
        emptyCombination = [candidateKitchen, candidateZone, candidateRider];
        break;
      }
    }
    if (emptyCombination) break;
  }
  if (emptyCombination) break;
}
await page.selectOption("#kitchen-filter", emptyCombination[0]);
await page.selectOption("#zone-filter", emptyCombination[1]);
await page.selectOption("#rider-filter", emptyCombination[2]);
await page.waitForFunction(
  () => document.querySelector('[data-metric="selected.order_rows"]')?.getAttribute("data-value") === "0",
);
ok("zero-row allocation state is explicit", (await page.locator('.matrix-cell[data-value="0"]').count()) === 80);
ok("release-level evidence remains visible in zero-row state", (await page.locator(".process-mark").count()) === 8);
await page.click(".chip--clear");
await page.waitForFunction(
  () => document.querySelector('[data-metric="selected.order_rows"]')?.getAttribute("data-value") === "5000",
);

await page.locator(".matrix-cell").first().click();
await page.waitForTimeout(100);
ok("corridor click opens evidence drawer", (await page.locator(".evidence-drawer").count()) === 1);
ok("drill breadcrumb appears", (await page.locator('nav[aria-label="Drill path"]').count()) === 1);
await page.keyboard.press("Escape");

await page.locator(".measure-dial").first().click();
ok("measure dial opens its contract evidence", (await page.locator(".evidence-drawer").count()) === 1);
await page.keyboard.press("Escape");

const processMark = page.locator(".process-mark").first();
await processMark.focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(100);
ok("keyboard opens process-link evidence", (await page.locator(".evidence-drawer").count()) === 1);
await page.keyboard.press("Escape");

await page.locator(".claim-row").first().click();
ok("claim row opens formula and population evidence", (await page.locator(".evidence-drawer").count()) === 1);
ok(
  "claim drawer uses the reader-facing contradicted verdict",
  (await page.locator(".evidence-drawer .eyebrow").textContent())?.includes("CONTRADICTED"),
);
await page.keyboard.press("Escape");

await page.locator(".contract-cell").first().click();
ok("contract cell opens table-column evidence", (await page.locator(".evidence-drawer").count()) === 1);
await page.keyboard.press("Escape");

await page.locator(".decision-column").first().click();
ok("decision ledger opens its decision boundary", (await page.locator(".evidence-drawer").count()) === 1);
await page.keyboard.press("Escape");

const accessibleRows = await page.locator(".chartfig .sr-table tbody tr").count();
ok("screen-reader tables mirror chart data", accessibleRows >= 102);

const tourTrigger = page.locator('button[aria-label="Open guided tour"]');
await tourTrigger.focus();
await tourTrigger.click();
await page.waitForTimeout(100);
ok("guided tour reopens", (await page.locator('[role="dialog"]').count()) === 1);
await page.keyboard.press("Shift+Tab");
ok(
  "guided tour traps keyboard focus",
  await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement)),
);
await page.keyboard.press("ArrowRight");
ok("tour arrow keys move to the next step", (await page.locator(".tour-count").textContent())?.trim() === "2 / 5");
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowRight");
ok(
  "tour summarizes three contradicted and two unsupported claims",
  (await page.locator(".tour-card").textContent())?.includes("Three findings conflict with the delivered fields; two are unsupported as specified."),
);
await page.keyboard.press("Escape");
ok("Escape closes guided tour", (await page.locator('[role="dialog"]').count()) === 0);
ok(
  "guided tour returns focus to its trigger",
  await tourTrigger.evaluate((element) => document.activeElement === element),
);

const deepLink = new URL(baseUrl);
deepLink.searchParams.set("f", JSON.stringify([{ field: "kitchen_id", values: [kitchenId] }]));
const deepPage = await context.newPage();
await deepPage.goto(deepLink.toString(), { waitUntil: "networkidle" });
await deepPage.waitForFunction(
  (expected) =>
    Number(document.querySelector('[data-metric="selected.order_rows"]')?.getAttribute("data-value")) === expected,
  expectedKitchenRows,
  { timeout: 30_000 },
);
ok("deep link restores allocation filter", true);
await deepPage.close();

const poster = await context.newPage();
await poster.setViewportSize({ width: 2560, height: 1440 });
await poster.goto(`${baseUrl}/poster`, { waitUntil: "networkidle" });
await poster.waitForFunction(
  () => document.querySelector('[data-metric="selected.order_rows"]')?.getAttribute("data-value") === "5000",
  { timeout: 30_000 },
);
ok("poster renders the complete matrix", (await poster.locator(".matrix-cell").count()) === 80);
ok("poster hides live controls", (await poster.locator(".poster .live-only:visible").count()) === 0);
ok("poster has no visible enabled buttons", (await poster.locator(".poster button:enabled:visible").count()) === 0);
ok("poster has no visible chart tab stops", (await poster.locator('.poster [tabindex="0"]:visible').count()) === 0);
ok(
  "poster gives the forensic evidence row at least 350px",
  (await poster.locator(".support-grid").evaluate((element) => element.getBoundingClientRect().height)) >= 350,
);
ok(
  "poster evidence labels remain at least 10px",
  await poster.evaluate(() =>
    [".plot-label", ".claim-copy b", ".contract-cell"].every((selector) =>
      Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize) >= 10,
    ),
  ),
);
ok(
  "poster is fixed to submission dimensions",
  await poster.evaluate(() => {
    const root = document.querySelector(".poster");
    return root?.getBoundingClientRect().width === 2560 && root?.getBoundingClientRect().height === 1440;
  }),
);
await poster.close();

const mobile = await context.newPage();
await mobile.setViewportSize({ width: 375, height: 812 });
await mobile.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
await mobile.waitForFunction(
  () => document.querySelector('[data-metric="selected.order_rows"]')?.getAttribute("data-value") === "5000",
  { timeout: 30_000 },
);
ok("mobile replaces matrix with four kitchen strips", (await mobile.locator(".kitchen-strip:visible").count()) === 4);
ok(
  "mobile page has no body-level horizontal overflow",
  await mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
);
await mobile.close();

await browser.close();
if (failed) {
  console.error(`\n${failed} interaction check(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll September interaction checks passed.");
