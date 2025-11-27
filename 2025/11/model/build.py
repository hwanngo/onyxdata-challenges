"""
Star schema - 2025/11 E-commerce Analytics  (Gate G4)

Reads the read-only XLSX, writes parquet to data/curated/. The raw folder is never touched.

THE SCHEMA ENCODES THE FINDINGS. Four decisions here are arguments, not plumbing:

  1. THREE REVENUE COLUMNS, NOT ONE. `reported_usd` is the file's `net_revenue_usd` verbatim;
     `ex_tax_usd` removes sales tax; `net_usd` additionally zeroes refunded events. All three
     are persisted so no downstream query can silently pick the wrong one, and so the UI can
     SHOW the correction rather than assert it. Difference: $3,825,574, 12.02%.

  2. dim_geo IS KEYED ON COUNTRY, and carries region, currency and tax_rate as ATTRIBUTES.
     That is the month's central finding rendered as a table shape: region and currency are
     functionally dependent on country (no country appears under two regions, none bills in
     two currencies), and tax_rate is a deterministic function of country. Anyone who reads
     this dimension can see that "revenue by currency" and "revenue by country" are the same
     question, and that both are entangled with tax.

  3. THERE IS NO SIGNUP-COHORT DIMENSION. Deliberately. 37.9% of events precede their own
     customer's signup_date, and the affected share correlates with the signup timestamp at
     r = 0.925 - the column was drawn independently of the transactions. A dim_cohort keyed on
     signup month would be a working join to a meaningless grouping, which is worse than its
     absence. `first_event_date` on dim_customer is the only customer clock.

  4. dim_product CARRIES BOTH GRAINS. `product_id` is the file's key; `family` merges SKUs
     sharing base_key + billing_cycle + price. `is_pure_dup` marks the 6 families where that
     merge changes the answer. Keeping both lets the dashboard show the naive ranking beside
     the corrected one, which is the whole point of C22.

The build RAISES if any of its own premises stop holding - including the thesis itself, in
build_correction(). A silent schema is a schema you cannot trust; see
.workbench/docs/LEARNINGS.md 2025/10.
"""

from __future__ import annotations

from pathlib import Path

import polars as pl

f = pl.col

ROOT = Path(__file__).resolve().parents[1]
SRC = (
    ROOT
    / "DataDNA-Dataset-Challenge-E-commerce-Dataset-November-2025"
    / "DataDNA Dataset Challenge - E-commerce Dataset - November 2025"
    / "DataDNA Dataset Challenge - E-commerce Dataset - November 2025.xlsx"
)
OUT = ROOT / "data" / "curated"

# The blank region is not missing data - it is exactly {United States, Canada}. assumptions A-2.
NORTH_AMERICA = "North America"
# Sentinels the file uses in place of null. Both would otherwise read as real categories.
NO_DISCOUNT = "N/A"
NO_REFUND_REASON = ""


def _require(condition: bool, message: str) -> None:
    """A premise of this build. If it stops holding, the schema is lying and the build stops."""
    if not condition:
        raise AssertionError(f"build premise violated: {message}")


def _cents(expr: pl.Expr) -> pl.Expr:
    """A money column, quantised to cents - and to the RIGHT double.

    `(x * 100).round() / 100` alone is not enough. Polars evaluates the division as a multiply
    by 0.01, so 11,010 cents comes back as 110.10000000000001 rather than the nearest double
    to 110.1, which is what `11010 / 100` gives in DuckDB, in Python and in the browser. The
    dollar figure is identical either way; the BITS are not, and a rank test ties on bits.
    4,776 of 48,000 reported values landed on the wrong side of that. The trailing `.round(2)`
    snaps them back, so every consumer of this parquet sees the same doubles the payload does.
    """
    return ((expr * 100).round() / 100).round(2)


def load() -> tuple[pl.DataFrame, pl.DataFrame, pl.DataFrame]:
    events = pl.read_excel(SRC, sheet_name="Events")
    products = pl.read_excel(SRC, sheet_name="Products")
    customers = pl.read_excel(SRC, sheet_name="Customers")

    # The XLSX reader hands back eight numeric columns as text. Every value parses; a null
    # after the cast would mean a non-numeric sneaked in, so check rather than assume.
    numeric = [
        "unit_price_local",
        "discount_local",
        "tax_local",
        "net_revenue_local",
        "fx_rate_to_usd",
        "net_revenue_usd",
        "latitude",
        "longitude",
    ]
    events = events.with_columns([f(c).cast(pl.Float64) for c in numeric])
    _require(
        all(events[c].null_count() == 0 for c in numeric),
        "a numeric Events column failed to parse",
    )
    products = products.with_columns(
        f("base_price_usd").cast(pl.Float64), f("base_price_usd_orig").cast(pl.Float64)
    )
    return events, products, customers


def build_geo(events: pl.DataFrame) -> pl.DataFrame:
    """One row per country. Region, currency and tax rate are attributes BECAUSE they are
    functionally dependent on it - which is the finding, not a convenience."""
    geo = (
        events.with_columns(
            region=pl.when(f("region") == "").then(pl.lit(NORTH_AMERICA)).otherwise(f("region"))
        )
        .group_by("country")
        .agg(
            f("region").n_unique().alias("n_regions"),
            f("currency").n_unique().alias("n_currencies"),
            f("region").first(),
            f("currency").first(),
            f("fx_rate_to_usd").first(),
            f("latitude").first(),
            f("longitude").first(),
            pl.len().alias("events"),
            # Statutory rate, measured against the PRE-DISCOUNT gross. Against the
            # post-discount base it reads ~5% relatively higher and is not a round number.
            (f("tax_local") / (f("quantity") * f("unit_price_local"))).mean().alias("tax_rate"),
        )
    )
    _require((geo["n_regions"] == 1).all(), "a country appears under more than one region")
    _require((geo["n_currencies"] == 1).all(), "a country bills in more than one currency")
    geo = geo.drop("n_regions", "n_currencies").with_columns(
        # 0 / 5 / 10 / 15 / 20 %. Round to the nearest 5pp and check we barely moved.
        tax_rate_statutory=(f("tax_rate") * 20).round() / 20
    )
    _require(
        float((geo["tax_rate"] - geo["tax_rate_statutory"]).abs().max()) < 1e-3,
        "tax rates are not the statutory 0/5/10/15/20% on the pre-discount gross",
    )
    return geo.sort("country")


def build_product(products: pl.DataFrame) -> pl.DataFrame:
    """Both grains. `product_id` is the file's key; `family` is what the file meant."""
    products = products.with_columns(family=f("base_key") + " · " + f("billing_cycle"))
    fam = products.group_by("family").agg(
        pl.len().alias("sku_count"),
        f("base_price_usd").n_unique().alias("price_count"),
        # Display name: the shortest name in the family, i.e. the un-suffixed one
        # ("Power BI Pro Annual" rather than "...Annual Business").
        f("product_name").sort_by(f("product_name").str.len_chars()).first().alias("family_name"),
    )
    # A "pure duplicate" family: several product_ids, one price. Those SKUs are the same thing.
    fam = fam.with_columns(is_pure_dup=(f("sku_count") > 1) & (f("price_count") == 1))
    out = products.join(fam, on="family")
    _require(out.height == products.height, "product family join changed the row count")
    _require(out["product_id"].n_unique() == out.height, "product_id not unique after the join")
    return out


def build_customer(events: pl.DataFrame, customers: pl.DataFrame) -> pl.DataFrame:
    """first_event_date is the ONLY customer clock. signup_date is carried but marked."""
    clock = events.group_by("customer_id").agg(
        f("event_date").min().alias("first_event_date"),
        f("event_date").max().alias("last_event_date"),
        pl.len().alias("events"),
        (f("event_type") == "order").sum().alias("orders"),
    )
    out = (
        customers.with_columns(
            region=pl.when(f("region") == "").then(pl.lit(NORTH_AMERICA)).otherwise(f("region"))
        )
        .join(clock, on="customer_id", how="left")
        .with_columns(
            # NOT "tenure" - the file has no acquisition date. This is observation time.
            signup_precedes_first_event=(f("signup_date") <= f("first_event_date")),
            is_repeat_buyer=(f("orders") >= 2),
        )
    )
    _require(out["events"].null_count() == 0, "a customer has no events")
    _require(out.height == customers.height, "customer join changed the row count")
    return out


def build_fact(
    events: pl.DataFrame, product: pl.DataFrame, customer: pl.DataFrame, geo: pl.DataFrame
) -> pl.DataFrame:
    fact = (
        events.join(
            product.select(
                "product_id",
                "family",
                "family_name",
                "category",
                "vendor",
                "billing_cycle",
                "is_subscription",
                "base_price_usd",
                "sku_count",
                "is_pure_dup",
            ),
            on="product_id",
        )
        .join(
            customer.select(
                "customer_id",
                pl.col("signup_date").alias("signup"),
                "segment",
                "acquisition_channel",
                "age_band",
                "currency_preference",
                "first_event_date",
            ),
            on="customer_id",
        )
        .join(geo.select("country", "tax_rate_statutory"), on="country")
    )
    _require(fact.height == events.height, "the fact join changed the row count")

    fact = fact.with_columns(
        region=pl.when(f("region") == "").then(pl.lit(NORTH_AMERICA)).otherwise(f("region")),
        discount_code=pl.when(f("discount_code") == NO_DISCOUNT)
        .then(None)
        .otherwise(f("discount_code")),
        refund_reason=pl.when(f("refund_reason") == NO_REFUND_REASON)
        .then(None)
        .otherwise(f("refund_reason")),
        refund_datetime=f("refund_datetime").str.to_datetime(),
        month=f("event_date").dt.truncate("1mo").dt.date(),
        is_order=(f("event_type") == "order"),
        # MONEY IS QUANTISED TO CENTS EXACTLY ONCE, HERE.
        # tax_local x fx produces more than two decimals for EUR/GBP/AUD, and the browser
        # payload transports integer cents. If the build kept full floats while the client
        # rounded, the two would disagree in the third decimal of any derived percentage -
        # which is precisely how G7 caught a 4.7076 / 4.7085 split on the family span.
        # Rounding once, upstream, means parquet, Malloy, metric_checks and the payload are
        # all the same numbers. A report about a revenue column that disagrees with itself
        # cannot afford to disagree with itself.
        tax_usd=_cents(f("tax_local") * f("fx_rate_to_usd")),
        discount_usd=_cents(f("discount_local") * f("fx_rate_to_usd")),
        # THE THREE REVENUE COLUMNS. Rule 1 of this month.
        reported_usd=_cents(f("net_revenue_usd")),
    )
    # ...AND SO IS EVERY VALUE DERIVED FROM IT. `reported - tax` in float64 lands on
    # 110.10000000000001 where the browser's `(reported_cents - tax_cents)/100` lands on
    # 110.1. Both are "the same" to six decimal places and NEITHER is wrong as money - but
    # they are different doubles, so they tie differently, and Kruskal-Wallis is a rank test.
    # That one-ulp gap moved this month's headline statistic from H = 4.6865 to H = 4.6639
    # (4,722 distinct ex-tax values against 4,706) and its p from 0.8607 to 0.8626.
    #
    # The integrity pass caught the outer version of this: a published p computed on
    # unquantised float64. Fixing only that would have left the parquet and the payload still
    # disagreeing in the twelfth decimal. Quantising the DERIVED column too - not just its
    # inputs - is what makes "quantise once, upstream" actually hold, and it is what lets
    # metric_checks.yml recompute the test statistic in SQL and get the browser's answer.
    fact = fact.with_columns(ex_tax_usd=_cents(f("reported_usd") - f("tax_usd")))
    fact = fact.with_columns(
        net_usd=pl.when(f("is_refunded")).then(0.0).otherwise(f("ex_tax_usd")),
        before_signup=(f("event_date") < f("signup")),
        days_since_first_event=(f("event_date") - f("first_event_date")).dt.total_days(),
    )

    # --- premises of the revenue columns, checked rather than trusted ---
    recon_local = f("quantity") * f("unit_price_local") - f("discount_local") + f("tax_local")
    _require(
        fact.filter((recon_local - f("net_revenue_local")).abs() > 0.011).height == 0,
        "net_revenue_local != qty*price - discount + tax",
    )
    _require(
        fact.filter(
            (f("net_revenue_local") * f("fx_rate_to_usd") - f("net_revenue_usd")).abs() > 0.011
        ).height
        == 0,
        "net_revenue_usd != net_revenue_local * fx",
    )
    _require((fact["ex_tax_usd"] <= fact["reported_usd"] + 1e-9).all(), "ex_tax exceeds reported")
    _require((fact["net_usd"] <= fact["ex_tax_usd"] + 1e-9).all(), "net exceeds ex_tax")
    _require(
        set(fact.filter(f("region") == NORTH_AMERICA)["country"].unique())
        == {"United States", "Canada"},
        "the blank region is not exactly {United States, Canada}",
    )
    return fact


def build_month(fact: pl.DataFrame) -> pl.DataFrame:
    """A date dimension whose only job is to mark the two partial months. assumptions A-8."""
    lo, hi = fact["event_date"].min(), fact["event_date"].max()
    return (
        fact.group_by("month")
        .agg(pl.len().alias("events"))
        .with_columns(
            is_partial=(f("month") == lo.date().replace(day=1))
            | (f("month") == hi.date().replace(day=1))
        )
        .sort("month")
    )


def build_correction(fact: pl.DataFrame) -> pl.DataFrame:
    """THE THESIS, persisted. Per-cut correction span, so verify_metrics recomputes the headline
    separation instead of trusting a literal in the spec - the 2025/10 lesson."""
    rows = []
    for cut in [
        "channel",
        "month",
        "family",
        "category",
        "payment_method",
        "segment",
        "discount_code",
        "currency",
        "region",
        "country",
    ]:
        g = (
            fact.filter(f(cut).is_not_null())
            .group_by(cut)
            .agg(pl.sum("reported_usd").alias("r"), pl.sum("net_usd").alias("n"))
            .with_columns(pct=100 * (f("r") - f("n")) / f("r"))
        )
        rows.append(
            {
                "cut": cut,
                "groups": g.height,
                "lo": float(g["pct"].min()),
                "hi": float(g["pct"].max()),
                "span": float(g["pct"].max() - g["pct"].min()),
            }
        )
    out = pl.DataFrame(rows).sort("span")
    geo_cuts = ["country", "region", "currency"]
    # discount_code is excluded from "non-geographic" because SALE15 is US-only and
    # LOYALTY15 is non-US-only - its span is geography in disguise (C14).
    worst_non_geo = out.filter(~f("cut").is_in([*geo_cuts, "discount_code"]))["span"].max()
    best_geo = out.filter(f("cut").is_in(geo_cuts))["span"].min()
    _require(
        best_geo > worst_non_geo,
        f"the thesis fails: worst non-geographic span {worst_non_geo:.2f} >= "
        f"best geographic span {best_geo:.2f}",
    )
    return out


def export_app_data(
    fact: pl.DataFrame, correction: pl.DataFrame, geo: pl.DataFrame, customer: pl.DataFrame
) -> None:
    """Columnar + dictionary-encoded payload for the browser.

    Money travels as INTEGER CENTS, and only two money columns ship: `reported` and `tax`.
    The other two are derived in the client - ex_tax = reported - tax, and net = 0 when
    refunded else ex_tax. Shipping all four would be 50% more bytes and would let the client
    and the build disagree about the arithmetic, which is the one thing this month is about.
    """
    import json

    cat_cols = [
        "channel",
        "country",
        "region",
        "currency",
        "category",
        "family_name",
        "billing_cycle",
        "segment",
        "payment_method",
        "acquisition_channel",
        "discount_code",
    ]
    cols: dict[str, dict] = {}
    for c in cat_cols:
        levels = sorted(fact[c].drop_nulls().unique().to_list())
        idx = {v: i for i, v in enumerate(levels)}
        codes = [(-1 if v is None else idx[v]) for v in fact[c].to_list()]
        cols[c] = {"levels": levels, "codes": codes}

    months = [str(m) for m in sorted(fact["month"].unique().to_list())]
    midx = {m: i for i, m in enumerate(months)}
    month_dim = build_month(fact)

    payload = {
        "n": fact.height,
        "months": months,
        "monthPartial": month_dim["is_partial"].to_list(),
        "cols": cols,
        "month_idx": [midx[str(m)] for m in fact["month"].to_list()],
        "reported": [round(x * 100) for x in fact["reported_usd"].to_list()],
        "tax": [round(x * 100) for x in fact["tax_usd"].to_list()],
        "qty": fact["quantity"].to_list(),
        "isOrder": [int(x) for x in fact["is_order"].to_list()],
        "isRefunded": [int(x) for x in fact["is_refunded"].to_list()],
        "beforeSignup": [int(x) for x in fact["before_signup"].to_list()],
        "correction": correction.to_dicts(),
        "geo": geo.select("country", "region", "currency", "tax_rate_statutory", "events")
        .sort("country")
        .to_dicts(),
        "meta": {
            "events": fact.height,
            "customers": customer.height,
            "skus": fact["product_id"].n_unique(),
            "families": fact["family"].n_unique(),
            # C9. Shipped because the tour and the recommendation strip both state it in prose,
            # and a customer-grain count cannot be derived from an event-grain payload. Typing
            # it into the copy instead is exactly the defect the integrity pass found elsewhere.
            "repeat_buyers": int(customer["is_repeat_buyer"].sum()),
            "reported_usd": float(fact["reported_usd"].sum()),
            "ex_tax_usd": float(fact["ex_tax_usd"].sum()),
            "net_usd": float(fact["net_usd"].sum()),
            "tax_usd": float(fact["tax_usd"].sum()),
            "refunded_ex_tax": float(fact.filter(f("is_refunded"))["ex_tax_usd"].sum()),
            "first": str(fact["event_date"].min()),
            "last": str(fact["event_date"].max()),
        },
    }
    out = ROOT / "app" / "src" / "data.json"
    out.write_text(json.dumps(payload, separators=(",", ":")))
    print(
        f"  wrote app/src/data.json  ({out.stat().st_size / 1024:,.0f} KB, {fact.height:,} events)"
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    events, products, customers = load()

    geo = build_geo(events)
    product = build_product(products)
    customer = build_customer(events, customers)
    fact = build_fact(events, product, customer, geo)
    month = build_month(fact)
    correction = build_correction(fact)

    geo.write_parquet(OUT / "dim_geo.parquet")
    product.write_parquet(OUT / "dim_product.parquet")
    customer.write_parquet(OUT / "dim_customer.parquet")
    month.write_parquet(OUT / "dim_month.parquet")
    correction.write_parquet(OUT / "dim_correction.parquet")
    fact.write_parquet(OUT / "fct_event.parquet")
    export_app_data(fact, correction, geo, customer)

    rep = fact["reported_usd"].sum()
    ex = fact["ex_tax_usd"].sum()
    net = fact["net_usd"].sum()
    print(f"fct_event      {fact.height:>7,} x {fact.width}")
    print(
        f"dim_customer   {customer.height:>7,} | dim_product {product.height:>5,} "
        f"({product['family'].n_unique()} families) | dim_geo {geo.height} | "
        f"dim_month {month.height}"
    )
    print(f"reported ${rep:>14,.0f}")
    print(f"ex-tax   ${ex:>14,.0f}   (-{100 * (rep - ex) / rep:.2f}%)")
    print(f"net      ${net:>14,.0f}   (-{100 * (rep - net) / rep:.2f}% total correction)")
    print("\ncorrection span by cut:")
    for r in correction.iter_rows(named=True):
        flag = "  <-- geography" if r["cut"] in {"country", "region", "currency"} else ""
        print(
            f"  {r['cut']:16s} {r['groups']:3d} groups  {r['lo']:6.2f}% - {r['hi']:6.2f}%"
            f"  span {r['span']:6.2f} pp{flag}"
        )


if __name__ == "__main__":
    main()
