# NOTICE

Datasets are provided by [Onyx Data](https://onyxdata.co.uk) for the DataDNA challenges and remain
subject to their terms and to the terms of any upstream source.

**What is and is not committed here.** The original download archives are not committed, and the
raw dataset folders are gitignored. Curated derivatives *are* committed: the parquet tables under
`<YYYY>/<MM>/data/curated/`, and the JSON payloads each month's app reads - under
`app/public/data/` and, in several months, `app/src/data.json`. Some of those tables sit
at full row grain, because the dashboards query them in the browser and drill-down has to reach the
underlying rows. For those months the source data is substantially reconstructible from this
repository. Treat everything under `data/curated/`, `app/public/data/` and `app/src/data.json` as
carrying the same terms as the Onyx source it derives from, not as this repository's to relicense.

**Quoted challenge text.** Each month's `brief.md` reproduces passages from the Onyx Data
challenge page and the brief shipped inside the dataset archive - the scenario, the stated
objective and the requirements list - marked as blockquotes and attributed in place. That prose
is Onyx's, quoted here so the analysis can be checked against what was actually asked. It is
neither this repository's code nor a derived table, and is not covered by `LICENSE`.

If you are the rights holder and would prefer the row-level tables or the quoted brief text not
be published here, open an issue and they will be removed or replaced with pre-aggregated
extracts.

Where a dataset has been sourced from somewhere other than Onyx (see `docs/DATA_ACCESS.md`), the
substitution and its origin are recorded in that month's `assumptions.md`.

Code in this repository is the author's own, and is licensed under the terms in `LICENSE`.
