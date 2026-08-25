# Connected Tables, Disconnected Risk

SolidJS dashboard for the August 2026 DataDNA African Gig-Economy and Digital Wallet challenge.

```bash
just build-model 2026 08
just dev 2026 08
```

Routes:

- `/` — responsive interactive diagnostic bench
- `/poster` — fixed 2560×1440 submission composition

The browser loads compact evidence JSON generated from curated Parquet. It intentionally does not
ship DuckDB-WASM: the complete payload is far smaller than the engine and is already constrained by
the tested semantic model.

## Interaction contract

- Every evidence visual emits and consumes the shared `topic` filter.
- Filter state is visible, URL-backed and clearable in one click.
- Drill path: connector → evidence → decision.
- Six-step first-run tour; `?` reopens it.
- Every SVG mark is keyboard-operable and mirrored by a hidden table.
- The poster prints evidence, uncertainty, provenance and the synthetic-data boundary without
  requiring interaction.
