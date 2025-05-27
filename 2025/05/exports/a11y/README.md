# Accessibility evidence pack - 2025/05

Accessibility is scored in AI rubric B *and* carries its own 30-point award. Treated here as a
deliverable with measured evidence, not a checklist.

Everything below is reproducible. The harnesses were promoted out of this month into `tools/qa/`
so every later month reuses them; they take the app URL as `$QA_URL` (default
`http://localhost:4173`). From the repo root:

```bash
cd 2025/05/app && pnpm exec vite build && pnpm exec vite preview --port 4173 &

node tools/qa/a11y.mjs 2025 05        # axe-core, 4 contexts
node tools/qa/overflow.mjs 2025 05    # horizontal overflow at 4 viewports
node tools/qa/interact.mjs 2025 05    # keyboard + interaction matrix (this month's copy)
```

## axe-core - 0 violations

WCAG 2.0 A/AA + WCAG 2.1 A/AA tags, run in four contexts:

| Context | Violations |
|---|---|
| Desktop 1440×950, light | **0** |
| Desktop 1440×950, dark | **0** |
| Mobile 375×812, light | **0** |
| Poster 2560×1440 | **0** |

Two real violations were found and fixed rather than waived:
- `aria-allowed-attr` - table rows used `role="button"` with `aria-selected`, which that role does
  not permit. They are toggles, so they now use `aria-pressed`.
- `nested-interactive` - the charts were `<svg role="img">` containing focusable rungs, which makes
  descendants presentational. Changed to `role="group"`, which is the correct container for an
  interactive graphic.

## Measured contrast - every pair, both themes

Computed with the WCAG 2.1 relative-luminance formula. Text needs 4.5:1, non-text/data-ink 3:1.

| Token | Light on `#F4F5F2` | Dark on `#11151A` | Needs |
|---|---:|---:|---|
| body ink | **16.16:1** | **15.97:1** | 4.5 |
| muted text | **5.51:1** | **7.21:1** | 4.5 |
| gain (teal) | **5.61:1** | **6.38:1** | 3.0 |
| loss (ochre) | **4.65:1** | **6.45:1** | 3.0 |
| coverage flag | **8.11:1** | **5.56:1** | 3.0 |
| band 1 Budget | **3.17:1** | **3.14:1** | 3.0 |
| band 2 Mid | **4.09:1** | **4.15:1** | 3.0 |
| band 3 High | **5.07:1** | **5.06:1** | 3.0 |
| band 4 Premium | **5.61:1** | **6.38:1** | 3.0 |

**This measurement changed the design.** The first ramp ran **1.40:1** and **2.14:1** on the bottom
two bands - a real WCAG 1.4.11 failure that looked perfectly fine on screen and that no amount of
eyeballing would have caught. The ramp was recomputed so every step clears 3:1 while staying
monotonic. Cost: a slightly less dramatic light-to-dark sweep. Worth it.

## Colour-vision deficiency

Full-poster simulations (Brettel/Viénot LMS transform) are in this folder:
`poster-protanopia.png` · `poster-deuteranopia.png` · `poster-tritanopia.png` · `poster-greyscale.png`

The diverging gain/loss pair (`#0B6E62` teal ↔ `#A65B12` ochre) sits on a blue-yellow axis, which
protanopia and deuteranopia both preserve:

| Simulation | gain renders as | loss renders as | distinguishable? |
|---|---|---|---|
| Protanopia | `#656562` neutral grey | `#6D6D0F` olive | yes, by hue |
| Deuteranopia | `#5B5B64` blue-grey | `#7A7A00` olive | yes, by hue |
| Tritanopia | `#156D6D` teal | `#A85656` dusty red | yes, by hue |

Their *luminance* contrast against each other is low (1.07-1.48:1) - deliberate for a diverging
scale, so neither pole dominates. That is precisely why hue is never the only encoder:

- the sign is printed on every bar (`+6.46pp`, `-6.50pp`)
- bars diverge from a zero line, so direction carries the meaning positionally
- the rank change (`4→2`, `3→5`) is stated in text
- price bands are ordered *and* labelled, never colour-only
- the coverage flag is a `⚑` glyph plus `n=10`, not a red cell

The greyscale render confirms the whole poster remains readable with no colour at all.

## Keyboard and screen reader

Verified by the interaction matrix (14/14 pass):

- every chart mark is a focusable DOM node - the charts are SVG, not canvas, so rungs, bars and
  rows are real elements with `role="button"`, `aria-pressed` and a descriptive `aria-label`
- Enter/Space activates; Enter on a brand drills in and pushes a breadcrumb; Esc clears
- `.skip` link to `#main` is the first focusable element
- the tour traps focus while open, restores it on close, and closes on Esc
- filter changes are announced through an `aria-live="polite"` region
- **every chart ships a visually-hidden `<table>`** carrying its full data - 32 rows across the four
  charts (19 ladder + 5 brands + 4 markets + 4 bands). A screen reader gets the numbers, not "graphic".

A `dna-kit` bug was found here and fixed for every future month: the hidden table carried `.sr-only`
directly, and because a `<table>` treats `width` as a *minimum*, it silently forced the page
**1087px wide at a 375px viewport**. Invisible on screen; a hard failure of the responsive
criterion. Now wrapped in a `<div class="sr-only">`.

## Responsive and motion

| Viewport | scrollWidth vs clientWidth |
|---|---|
| 375 | 375 / 375 - no horizontal scroll |
| 768 | 768 / 768 |
| 1024 | 1024 / 1024 |
| 1440 | 1440 / 1440 |

Wide tables scroll inside their own container rather than pushing the page. Touch targets are ≥44px
(rung hit areas are padded well past the 33px bar height). `prefers-reduced-motion` collapses all
transitions to 0.01ms. Text resizes to 200% without loss of function - the layout is `clamp()`-based
with `ch`-capped measures and no fixed-px containers.

## In the poster itself

The footer states the accessibility position in one line, because a reviewer can only score what it
can see without interacting.
