# onyxdata-dnakit task runner
#
# Prerequisites: just, uv, node >=22, pnpm, Python 3.14 (via `uv python install 3.14`)
# Usage: just <recipe> [args]

default:
    @just --list

# --- setup ---

# Install everything. pnpm workspaces means one install covers dna-kit AND every month app.
setup:
    uv python install 3.14
    uv sync --all-extras
    uv run playwright install chromium
    pnpm install
    @echo ""
    @echo "Ready. Pick a month and start the pipeline:"
    @echo "  just profile 2025 05"

# Verify the toolchain before blaming the code
doctor:
    #!/usr/bin/env bash
    set -uo pipefail
    fail=0
    for c in just uv node pnpm; do
      if command -v "$c" >/dev/null 2>&1; then
        printf '  ok    %-6s %s\n' "$c" "$($c --version 2>&1 | head -1)"
      else
        printf '  MISS  %-6s not on PATH\n' "$c"; fail=1
      fi
    done
    uv run python -c "import sys; print('  ok    python', '.'.join(map(str,sys.version_info[:3])))" 2>/dev/null || { echo "  MISS  python  run: just setup"; fail=1; }
    [ $fail -eq 0 ] && echo "" && echo "Toolchain OK." || { echo ""; echo "See README Prerequisites."; exit 1; }

# --- month lifecycle ---

# Scaffold a new month from templates/_month and register it in the pnpm workspace
new YEAR MONTH:
    #!/usr/bin/env bash
    set -euo pipefail
    dest="{{YEAR}}/{{MONTH}}"
    if [ -d "$dest" ]; then echo "$dest already exists"; exit 1; fi
    mkdir -p "$dest"
    cp -r templates/_month/. "$dest/"
    # local working-note templates (untracked); skipped cleanly if .workbench/ isn't present
    if [ -d .workbench/templates/_month ]; then
      mkdir -p ".workbench/$dest"
      cp -r .workbench/templates/_month/. ".workbench/$dest/"
      echo "  working notes scaffolded into .workbench/$dest"
    fi
    # workspace members must have unique package names
    python3 - "$dest" <<'PY'
    import json, sys, pathlib
    dest = pathlib.Path(sys.argv[1])
    p = dest / "app" / "package.json"
    d = json.loads(p.read_text())
    d["name"] = "datadna-" + "-".join(dest.parts)
    p.write_text(json.dumps(d, indent=2) + "\n")
    print("  app package name:", d["name"])
    PY
    pnpm install
    echo "Created $dest"
    echo "Next: just brief {{YEAR}} {{MONTH}} && just fetch {{YEAR}} {{MONTH}}   (Era 2 only - Era 1 is gated)"

# G1 - scrape the challenge page into brief.md (Era 2 only)
brief YEAR MONTH:
    uv run python tools/fetch_challenge.py {{YEAR}} {{MONTH}}

# G2 - download and unzip the dataset
fetch YEAR MONTH *ARGS:
    uv run python tools/fetch_dataset.py {{YEAR}} {{MONTH}} {{ARGS}}

# G2 - automated EDA into analysis/profile.md
profile YEAR MONTH:
    uv run python tools/profile.py {{YEAR}} {{MONTH}}

# G4 - raw -> curated parquet
build-model YEAR MONTH:
    uv run python {{YEAR}}/{{MONTH}}/model/build.py

# G4 - compile model.malloy and run its views (the semantic layer is hand-written, not generated)
malloy YEAR MONTH:
    node tools/run_malloy.mjs {{YEAR}} {{MONTH}}

# Promoted after four months of identical hand-written copies.
#
# Check the shared statistical helpers in packages/dna-kit/src/stats
test-kit:
    npx --yes tsx packages/dna-kit/src/stats/verify.mjs

# G4 - metric assertions
test-model YEAR MONTH:
    uv run pytest {{YEAR}}/{{MONTH}}/model -v

# G6 - local dashboard at :5173
dev YEAR MONTH:
    pnpm --filter datadna-{{YEAR}}-{{MONTH}} dev

# G6 - self-critique screenshots (desktop + poster + mobile)
critique YEAR MONTH:
    uv run python tools/shoot.py {{YEAR}} {{MONTH}} --critique

# `vite build` transpiles and DISCARDS types - it has never checked one, and this recipe is
# the only thing in the repo that does. A month shipped a guided tour that never rendered
# because TourOverlay was mounted without its required `open` prop: TS2741, caught in a second
# by a compiler nobody was running.
#
# Typecheck one month
typecheck YEAR MONTH:
    pnpm --filter datadna-{{YEAR}}-{{MONTH}} exec tsc --noEmit

# Exits NON-ZERO on any error: this recipe used to print the count and return 0, which is the
# same fail-by-passing shape as every other tool the audit caught. `a && echo || echo` takes
# the exit code of the echo that ran, so it can only ever succeed.
#
# Typecheck the kit and every month - currently 0 errors, keep it that way
typecheck-all:
    #!/usr/bin/env bash
    set -uo pipefail
    total=0
    printf '  %-10s %s\n' pkg errors
    n=$(cd packages/dna-kit && pnpm exec tsc --noEmit 2>&1 | grep -c "error TS")
    printf '  %-10s %s\n' dna-kit "$n"; total=$((total+n))
    for d in 2*/*/app; do
      [ -f "$d/tsconfig.json" ] || continue
      n=$(cd "$d" && pnpm exec tsc --noEmit 2>&1 | grep -c "error TS")
      printf '  %-10s %s\n' "$(dirname $d)" "$n"; total=$((total+n))
    done
    echo ""
    if [ "$total" -eq 0 ]; then echo "Typecheck clean."; else echo "$total type error(s) outstanding."; exit 1; fi

# Catches the class verify-metrics cannot see: a figure typed into prose. See the tool header.
#
# G7 - every published statistic is either tagged (and so recomputed) or declared
lint-numbers YEAR MONTH:
    node tools/lint_prose_numbers.mjs {{YEAR}} {{MONTH}}

# Order matters, cheapest and blindest-spot-first:
#   typecheck  - catches UI that does not exist. Two months both shipped a guided
#                tour that never rendered (TS2741, a missing `open` prop); no other gate can
#                see absent DOM. Gating here was deferred while 184 errors stood; they are
#                cleared, so a regression must now fail the gate rather than be counted.
#   prose lint - a number nothing recomputes cannot be caught by recomputing.
#   metrics    - recompute what IS tagged, against an independent DuckDB path.
#   POSTER     - the same recompute against /poster. The poster IS the submission, and until
#                then nothing verified its numbers: it can render a different figure from
#                the live route (a state the live page shows only behind a toggle, a panel
#                cut by the poster budget) and every gate would still pass. Verified against
#                two shipped months before being added here, both clean.
#
# G7 - recompute every rendered number. Zero tolerance
verify YEAR MONTH:
    just typecheck {{YEAR}} {{MONTH}}
    # Scaffold first: an unedited template file reports success, so nothing downstream can
    # catch it. Two months published the template's fabricated "412 (0.3%)" row, and
    # shipped profile.md's Top-5 as literal TODOs.
    uv run python tools/check_scaffold.py {{YEAR}} {{MONTH}}
    node tools/lint_prose_numbers.mjs {{YEAR}} {{MONTH}}
    uv run python tools/verify_metrics.py {{YEAR}} {{MONTH}}
    uv run python tools/verify_metrics.py {{YEAR}} {{MONTH}} --url http://localhost:5173/poster

# G7 - axe-core over the built app, four contexts (builds and serves on :4173)
a11y YEAR MONTH:
    #!/usr/bin/env bash
    set -euo pipefail
    # The harness that produced exports/qa/a11y.txt. Accessibility is a scored rubric
    # dimension - do not defer it to G7.
    pnpm --filter datadna-{{YEAR}}-{{MONTH}} exec vite build
    pnpm --filter datadna-{{YEAR}}-{{MONTH}} exec vite preview --port 4173 --strictPort &
    srv=$!
    trap 'pkill -TERM -P $srv 2>/dev/null || true; kill $srv 2>/dev/null || true' EXIT
    for _ in $(seq 1 60); do curl -sf http://localhost:4173/ -o /dev/null && break; sleep 0.5; done
    QA_URL=http://localhost:4173 node tools/qa/a11y.mjs {{YEAR}} {{MONTH}}

# G8 - export the submission PNG at 2560x1440
shoot YEAR MONTH:
    uv run python tools/shoot.py {{YEAR}} {{MONTH}}

# Build the month for production
build YEAR MONTH:
    pnpm --filter datadna-{{YEAR}}-{{MONTH}} build

# --- housekeeping ---

# Ruff check + format check
lint:
    uv run ruff check . && uv run ruff format --check .

# Format and autofix Python
fmt:
    uv run ruff format . && uv run ruff check --fix .

# Show the backlog
status:
    @grep -E '^\s+- folder:|^\s+status:' challenges.yml | paste - - | sed 's/- folder://;s/status://' | column -t

# Remove build output, caches and test artifacts
clean:
    rm -rf node_modules **/node_modules .venv .ruff_cache .pytest_cache
