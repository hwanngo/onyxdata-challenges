<!-- TEMPLATE-UNEDITED: delete this line once this file describes THIS month.
     tools/check_scaffold.py fails while it is still here. It exists because an unedited
     template ships silently - provenance blank, and an example row
     reporting "dropped rows with null `region` | 412 (0.3%)" for a column neither dataset
     has. A scaffolded file that was never edited is worse than a missing one, because it
     reports success. Same reason app/interact.mjs carries SCAFFOLD_REWRITTEN. -->

# Assumptions - <YYYY>/<MM>

Every judgement call that a reader could reasonably dispute. Anything here that affects a headline
number must also appear as a footnote in the dashboard.

## Data provenance

| | |
|---|---|
| Source URL | |
| Retrieved | |
| Onyx's file, or a substitute? | |
| Expected rows / actual rows | |
| sha256 | |

> If this is a **substitute** (see `docs/DATA_ACCESS.md` Route C), the G1 benchmarking step is void
> for this month - your numbers cannot reconcile against published entries. Note it and move on.

## Business semantics

One row per term whose definition a reader could dispute. The last column is the point: name the
reading you did **not** take, so the choice is visible rather than implied.

| Term | How I defined it | Why | Alternative reading |
|---|---|---|---|
| \<term\> | \<definition\> | \<why this one\> | \<the reading a reasonable analyst would take instead\> |

## Data handling

Every row that does not reach the model, and why. **Write real counts here, never illustrative
ones** - a plausible-looking example row has shipped as fact twice in this programme.

| Decision | Rows affected | Rationale |
|---|---|---|
| \<what you did\> | \<n\> of \<total\> (\<pct\>%) | \<why those rows are unusable, and what you checked before dropping them\> |

> **Log every row you lose and why.** Silent drops are the fastest way to a number nobody can
> reproduce. If nothing was dropped, say so explicitly and point at the assertion that proves it.

## Statistical choices

Anything seeded, any threshold, any replication count, any test whose answer would move if the
choice moved. State the value, and state what a sceptic would say about it.

| Choice | Value | Why it could be disputed |
|---|---|---|
| \<choice\> | \<value\> | \<what a sceptic would say\> |

## Known limitations

- \<what this file cannot answer, and what would have to be collected to answer it\>
