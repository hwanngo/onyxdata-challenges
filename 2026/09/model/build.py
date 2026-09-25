#!/usr/bin/env python3
"""Build the September 2026 evidence model from immutable Golden Wok files.

The wrong report is intentionally difficult to express:

1. Stable IDs, dates and allocation counts are modeled as descriptive facts.
2. Nine disconnected business measures survive only with explicit ``source_`` names.
3. Every supplied finding travels with its denominator, observed effect and verdict.
4. Validation-contract mismatches and collection requirements are first-class tables.
5. No raw row is dropped, rewritten or silently repaired.
"""

from __future__ import annotations

import itertools
import json
import math
from datetime import date, datetime
from pathlib import Path

import numpy as np
import polars as pl
from scipy import stats

f = pl.col
MONTH = Path(__file__).resolve().parents[1]
CURATED = MONTH / "data" / "curated"
PUBLIC = MONTH / "app" / "public" / "data"

SOURCE_MEASURES = [
    "order_value_ngn",
    "delivery_distance_km",
    "promised_delivery_min",
    "actual_delivery_min",
    "traffic_friction_score",
    "food_temp_on_arrival_c",
    "customer_rating",
    "delivery_cost_ngn",
    "order_profit_ngn",
]
EXPECTED_LINKS = [
    ("traffic_to_time", "traffic_friction_score", "actual_delivery_min"),
    ("distance_to_time", "delivery_distance_km", "actual_delivery_min"),
    ("time_to_temperature", "actual_delivery_min", "food_temp_on_arrival_c"),
    ("time_to_rating", "actual_delivery_min", "customer_rating"),
    ("distance_to_cost", "delivery_distance_km", "delivery_cost_ngn"),
    ("distance_to_profit", "delivery_distance_km", "order_profit_ngn"),
    ("value_to_profit", "order_value_ngn", "order_profit_ngn"),
    ("cost_to_profit", "delivery_cost_ngn", "order_profit_ngn"),
]


def premise(ok: bool, message: str) -> None:
    if not ok:
        raise SystemExit(f"PREMISE VIOLATED: {message}")


def find_archive() -> Path:
    facts = list(MONTH.rglob("fact_orders.csv"))
    if len(facts) != 1:
        raise SystemExit(f"Expected one fact_orders.csv, found {len(facts)}")
    return facts[0].parents[1]


def load(archive: Path, name: str) -> pl.DataFrame:
    return pl.read_csv(archive / "data" / name, infer_schema_length=None)


def finite(value):
    if isinstance(value, (np.integer, np.floating)):
        value = value.item()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: finite(item) for key, item in value.items()}
    if isinstance(value, list):
        return [finite(item) for item in value]
    return value


def dump_json(path: Path, data) -> None:
    path.write_text(
        json.dumps(finite(data), indent=2, sort_keys=True, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def write_table(name: str, frame: pl.DataFrame) -> None:
    frame.write_parquet(CURATED / f"{name}.parquet", compression="zstd", statistics=True)
    print(f"  {name:<31} {frame.height:>5,} rows")


def build_dim_date(lo: date, hi: date) -> pl.DataFrame:
    return (
        pl.DataFrame({"order_date": pl.date_range(lo, hi, "1d", eager=True)})
        .with_columns(
            calendar_year=f("order_date").dt.year(),
            quarter_number=f("order_date").dt.quarter(),
            month_number=f("order_date").dt.month(),
            month_name=f("order_date").dt.strftime("%b"),
            year_month=f("order_date").dt.strftime("%Y-%m"),
            day_of_month=f("order_date").dt.day(),
            day_of_week_number=f("order_date").dt.weekday(),
            day_name=f("order_date").dt.strftime("%A"),
            is_weekend=f("order_date").dt.weekday() > 5,
            iso_week=f("order_date").dt.week(),
        )
        .sort("order_date")
    )


def build_measure_contract() -> pl.DataFrame:
    reasons = {
        "order_value_ngn": "Documented normal distribution rejected; unrelated to supplied profit.",
        "delivery_distance_km": "Broad bounded draw; unrelated to time, cost or supplied profit.",
        "promised_delivery_min": "4,892 values fall outside the documented 25-45 minute range.",
        "actual_delivery_min": "4,400 values exceed 120 minutes and promised-time correlation is near zero.",
        "traffic_friction_score": "Unrelated to actual delivery minutes; weather comparison is unsupported.",
        "food_temp_on_arrival_c": "4,516 values fall outside 0-100 Celsius and time correlation is near zero.",
        "customer_rating": "Disconnected from actual delivery minutes after multiplicity control.",
        "delivery_cost_ngn": "Unrelated to distance and does not reconcile supplied profit.",
        "order_profit_ngn": "No negative values; all 5,000 rows fail value minus cost equals profit.",
    }
    return pl.DataFrame(
        {
            "source_field": SOURCE_MEASURES,
            "curated_field": [f"source_{name}" for name in SOURCE_MEASURES],
            "semantic_status": ["quarantined"] * len(SOURCE_MEASURES),
            "safe_use": ["source audit only"] * len(SOURCE_MEASURES),
            "reason": [reasons[name] for name in SOURCE_MEASURES],
        }
    )


def build_contract_ledger(
    archive: Path,
    raw_tables: dict[str, pl.DataFrame],
) -> pl.DataFrame:
    config = json.loads((archive / "docs" / "SCHEMA_CONFIG.json").read_text(encoding="utf-8"))
    rows = []
    for contract_id, rule in config["column_constraints"].items():
        matches = (
            rule["table_name"] in raw_tables
            and rule["column_name"] in raw_tables[rule["table_name"]].columns
        )
        rows.append(
            {
                "sequence": len(rows) + 1,
                "contract_id": contract_id,
                "kind": "constraint",
                "status": "MATCH" if matches else "MISSING",
                "from_table": rule["table_name"],
                "from_column": rule["column_name"],
                "to_table": None,
                "to_column": None,
                "detail": f"{rule['data_type']} · nullable={rule['nullable']}",
            }
        )
    for contract_id, relation in config["relationship_rules"].items():
        available = (
            relation["from_table"] in raw_tables
            and relation["to_table"] in raw_tables
            and relation["from_column"] in raw_tables[relation["from_table"]].columns
            and relation["to_column"] in raw_tables[relation["to_table"]].columns
        )
        semantically_invalid = available and (
            relation["from_table"],
            relation["from_column"],
            relation["to_table"],
            relation["to_column"],
        ) == ("fact_orders", "kitchen_id", "dim_time_slot", "time_slot_id")
        status = "INVALID" if semantically_invalid else "AVAILABLE" if available else "MISSING"
        rows.append(
            {
                "sequence": len(rows) + 1,
                "contract_id": contract_id,
                "kind": "relationship",
                "status": status,
                "from_table": relation["from_table"],
                "from_column": relation["from_column"],
                "to_table": relation["to_table"],
                "to_column": relation["to_column"],
                "detail": (
                    f"{relation['from_table']}.{relation['from_column']} → "
                    f"{relation['to_table']}.{relation['to_column']}"
                ),
            }
        )
    return pl.DataFrame(rows).sort("sequence")


def build_release_contract(
    archive: Path,
    dim_contract: pl.DataFrame,
) -> pl.DataFrame:
    validation = json.loads(
        (archive / "docs" / "VALIDATION_REPORT.json").read_text(encoding="utf-8")
    )
    return pl.DataFrame(
        {
            "release_id": ["2026-09"],
            "validation_checks_passed": [validation["summary"]["passed"]],
            "configured_constraints": [dim_contract.filter(f("kind") == "constraint").height],
            "matching_constraints": [
                dim_contract.filter((f("kind") == "constraint") & (f("status") == "MATCH")).height
            ],
            "configured_relationships": [dim_contract.filter(f("kind") == "relationship").height],
            "unavailable_relationships": [
                dim_contract.filter(
                    (f("kind") == "relationship") & (f("status") == "MISSING")
                ).height
            ],
            "invalid_relationships": [
                dim_contract.filter(
                    (f("kind") == "relationship") & (f("status") == "INVALID")
                ).height
            ],
            "semantic_status": ["failed closed"],
            "decision": ["Allocation counts only; operational measures quarantined."],
        }
    )


def build_process_links(fact: pl.DataFrame) -> pl.DataFrame:
    alpha = 0.05 / 36
    rows = []
    for sequence, (link_id, source, target) in enumerate(EXPECTED_LINKS, start=1):
        result = stats.pearsonr(fact[source].to_numpy(), fact[target].to_numpy())
        survives = bool(result.pvalue < alpha)
        rows.append(
            {
                "sequence": sequence,
                "link_id": link_id,
                "source_measure": source,
                "target_measure": target,
                "correlation_r": float(result.statistic),
                "abs_correlation_r": abs(float(result.statistic)),
                "p_value": float(result.pvalue),
                "corrected_alpha": alpha,
                "survives_correction": survives,
                "status": "connected" if survives else "disconnected",
                "decision": "Do not use this link for operational attribution.",
            }
        )
    return pl.DataFrame(rows).sort("sequence")


def build_claims(joined: pl.DataFrame, zones: pl.DataFrame) -> pl.DataFrame:
    rush_outer = joined.filter((f("is_rush_hour") == "Yes") & f("zone_tier").str.contains("Outer"))
    rain = joined.filter(f("weather_condition").is_in(["Light Rain", "Heavy Rain"]))
    non_rain = joined.filter(~f("weather_condition").is_in(["Light Rain", "Heavy Rain"]))
    long_distance = joined.filter(f("delivery_distance_km") > 8)
    slow = joined.filter(f("actual_delivery_min") > 60)
    lekki_ikoyi = joined.filter(
        f("kitchen_name").str.contains("Lekki") & (f("zone_name") == "Ikoyi")
    )
    vi_present = bool(
        zones.filter(
            (f("zone_name") == "VI") | f("zone_name").str.contains("Victoria Island")
        ).height
    )

    return pl.DataFrame(
        [
            {
                "sequence": 1,
                "claim_id": "rush_outer_loss",
                "claim": "Rush-hour outer-zone orders triple SLA and average below NGN -500.",
                "sample_n": rush_outer.height,
                "observed_value": float(rush_outer["order_profit_ngn"].mean()),
                "claimed_value": -500.0,
                "value_unit": "mean supplied profit NGN",
                "observed": (
                    f"{rush_outer.filter(f('actual_delivery_min') > 90).height} above 90 raw "
                    f"minutes; {rush_outer.filter(f('actual_delivery_min') >= 3 * f('promised_delivery_min')).height} "
                    "at least 3× promise; 0 below NGN -500"
                ),
                "verdict": "REJECTED",
                "decision": "Do not reduce outer-zone service from this file.",
            },
            {
                "sequence": 2,
                "claim_id": "rain_delay",
                "claim": "Rain creates 1.8× traffic and adds 28 minutes.",
                "sample_n": rain.height,
                "observed_value": float(
                    rain["traffic_friction_score"].mean()
                    / non_rain["traffic_friction_score"].mean()
                ),
                "claimed_value": 1.8,
                "value_unit": "traffic ratio",
                "observed": (
                    "Clear comparator absent; alternative rain versus all other conditions: "
                    f"traffic ratio {rain['traffic_friction_score'].mean() / non_rain['traffic_friction_score'].mean():.5f}×; "
                    f"raw time difference {rain['actual_delivery_min'].mean() - non_rain['actual_delivery_min'].mean():+.2f} minutes"
                ),
                "verdict": "UNSUPPORTED",
                "decision": "The specified Clear comparison is unavailable; do not change weather policy from static slot metadata.",
            },
            {
                "sequence": 3,
                "claim_id": "distance_loss",
                "claim": "Deliveries above 8 km are structurally unprofitable.",
                "sample_n": long_distance.height,
                "observed_value": float(
                    long_distance.filter(f("order_profit_ngn") < 0).height / long_distance.height
                ),
                "claimed_value": None,
                "value_unit": "negative supplied-profit share",
                "observed": "0 negative supplied-profit rows above 8 km",
                "verdict": "REJECTED",
                "decision": "Do not shrink the delivery radius from this file.",
            },
            {
                "sequence": 4,
                "claim_id": "slow_cold_low_rating",
                "claim": "Deliveries above 60 minutes arrive below 45°C with ratings below 2.5.",
                "sample_n": slow.height,
                "observed_value": float(
                    slow.filter(f("food_temp_on_arrival_c") < 45).height / slow.height
                ),
                "claimed_value": None,
                "value_unit": "cold share among raw >60-minute rows",
                "observed": (
                    f"{slow.filter(f('food_temp_on_arrival_c') < 45).height} below 45°C; "
                    f"{slow.filter(f('customer_rating') < 2.5).height} below 2.5"
                ),
                "verdict": "REJECTED",
                "decision": "Do not infer quality degradation from invalid measures.",
            },
            {
                "sequence": 5,
                "claim_id": "lekki_vi_ikoyi_loss",
                "claim": "Lekki serving VI and Ikoyi is consistently unprofitable.",
                "sample_n": lekki_ikoyi.height,
                "observed_value": float(lekki_ikoyi.filter(f("order_profit_ngn") < 0).height),
                "claimed_value": None,
                "value_unit": "negative supplied-profit rows in Lekki × Ikoyi",
                "observed": f"0 negative rows; VI present={str(vi_present).lower()}",
                "verdict": "UNSUPPORTED",
                "decision": "Collect route identity before evaluating the named corridor.",
            },
        ]
    )


def build_collection_requirements() -> pl.DataFrame:
    requirements = [
        (
            "service_timestamps",
            "Created, promised-by, accepted, ready, pickup and delivered timestamps",
        ),
        ("route_identity", "Origin/destination coordinates, route ID and distance method"),
        ("observed_weather", "Weather joined by event timestamp and location"),
        ("order_status", "Status, cancellation, retry and reassignment history"),
        (
            "unit_economics",
            "Fee, food revenue, rider payment, other cost and enforced profit formula",
        ),
        ("temperature_provenance", "Measurement timestamp, method and unit"),
        ("rider_assignment", "Assignment history and cross-kitchen dispatch rule"),
    ]
    return pl.DataFrame(
        [
            {
                "sequence": sequence,
                "requirement_id": requirement_id,
                "requirement": requirement,
                "blocks": "operational attribution",
                "status": "MISSING",
            }
            for sequence, (requirement_id, requirement) in enumerate(requirements, start=1)
        ]
    )


def main() -> int:
    archive = find_archive()
    print(f"Reading {archive.name}/")

    fact_raw = load(archive, "fact_orders.csv")
    kitchen_raw = load(archive, "dim_kitchen.csv")
    zone_raw = load(archive, "dim_delivery_zone.csv")
    rider_raw = load(archive, "dim_rider.csv")
    slot_raw = load(archive, "dim_time_slot.csv")
    raw_tables = {
        "fact_orders": fact_raw,
        "dim_kitchen": kitchen_raw,
        "dim_delivery_zone": zone_raw,
        "dim_rider": rider_raw,
        "dim_time_slot": slot_raw,
    }

    premise(fact_raw.height == 5_000, f"fact row count changed: {fact_raw.height}")
    premise(fact_raw["order_id"].n_unique() == 5_000, "order_id is no longer unique")
    for name, frame, expected in (
        ("dim_kitchen", kitchen_raw, 4),
        ("dim_delivery_zone", zone_raw, 20),
        ("dim_rider", rider_raw, 60),
        ("dim_time_slot", slot_raw, 48),
    ):
        premise(frame.height == expected, f"{name} row count changed: {frame.height}")
    for key, dimension in (
        ("kitchen_id", kitchen_raw),
        ("zone_id", zone_raw),
        ("rider_id", rider_raw),
        ("time_slot_id", slot_raw),
    ):
        premise(
            not (set(fact_raw[key].unique()) - set(dimension[key].unique())),
            f"fact.{key} has orphan values",
        )

    dim_kitchen = (
        kitchen_raw.with_columns(f("date_opened").str.to_date("%m/%d/%Y"))
        .rename(
            {
                "kitchen_capacity_orders_hr": "source_kitchen_capacity_orders_hr",
                "is_active": "source_is_active",
            }
        )
        .sort("kitchen_id")
    )
    dim_zone = zone_raw.rename(
        {
            "avg_zone_traffic_index": "source_avg_zone_traffic_index",
            "baseline_delivery_min": "source_baseline_delivery_min",
            "is_restricted_zone": "source_is_restricted_zone",
        }
    ).sort("zone_id")
    dim_rider = rider_raw.rename(
        {
            "avg_speed_kmh": "source_avg_speed_kmh",
            "avg_rider_rating": "source_avg_rider_rating",
            "is_active": "source_is_active",
        }
    ).sort("rider_id")
    dim_time_slot = (
        slot_raw.rename(
            {column: f"source_{column}" for column in slot_raw.columns if column != "time_slot_id"}
        )
        .with_columns(
            slot_hour_consistent=(
                f("source_hour_of_day") == f("source_slot_label").str.slice(0, 5)
            ),
            slot_weekend_consistent=(
                f("source_is_weekend") == f("source_day_of_week").is_in(["Saturday", "Sunday"])
            ),
            semantic_status=pl.lit("quarantined metadata"),
        )
        .sort("time_slot_id")
    )

    joined = (
        fact_raw.join(kitchen_raw, on="kitchen_id")
        .join(zone_raw, on="zone_id")
        .join(slot_raw, on="time_slot_id")
    )
    premise(joined.height == fact_raw.height, "dimension joins fanned out or dropped rows")

    fact = (
        fact_raw.with_columns(f("order_date").str.to_date("%m/%d/%Y"))
        .rename({name: f"source_{name}" for name in SOURCE_MEASURES})
        .join(dim_time_slot.select("time_slot_id", "source_day_of_week"), on="time_slot_id")
        .join(dim_kitchen.select("kitchen_id", "date_opened"), on="kitchen_id")
        .join(dim_rider.select("rider_id", "assigned_kitchen_id"), on="rider_id")
        .with_columns(calendar_day=f("order_date").dt.strftime("%A"))
        .with_columns(
            promise_in_documented_range=f("source_promised_delivery_min").is_between(25, 45),
            actual_within_120_min_screen=f("source_actual_delivery_min").is_between(0, 120),
            temperature_within_0_100_screen=f("source_food_temp_on_arrival_c").is_between(0, 100),
            profit_identity_matches=(
                f("source_order_profit_ngn")
                - (f("source_order_value_ngn") - f("source_delivery_cost_ngn"))
            ).abs()
            <= 0.01,
            date_matches_slot_weekday=(f("calendar_day") == f("source_day_of_week")),
            order_on_or_after_kitchen_open=(f("order_date") >= f("date_opened")),
            rider_matches_base_kitchen=(f("kitchen_id") == f("assigned_kitchen_id")),
        )
        .drop("calendar_day", "source_day_of_week", "date_opened", "assigned_kitchen_id")
        .sort("order_date", "order_id")
    )
    dim_date = build_dim_date(fact["order_date"].min(), fact["order_date"].max())
    premise(dim_date.height == 731, f"calendar row count changed: {dim_date.height}")

    premise(
        fact.filter(~f("promise_in_documented_range")).height == 4_892,
        "promise-range defect count changed",
    )
    premise(
        fact.filter(~f("actual_within_120_min_screen")).height == 4_400,
        "actual-time defect count changed",
    )
    premise(
        fact.filter(~f("temperature_within_0_100_screen")).height == 4_516,
        "temperature defect count changed",
    )
    premise(
        fact.filter(~f("profit_identity_matches")).height == 5_000,
        "profit-identity defect count changed",
    )
    premise(
        fact.filter(~f("date_matches_slot_weekday")).height == 4_288,
        "date-slot mismatch count changed",
    )
    premise(
        fact.filter(~f("order_on_or_after_kitchen_open")).height == 1_238,
        "opening-date mismatch count changed",
    )
    premise(
        fact.filter(~f("rider_matches_base_kitchen")).height == 3_736,
        "rider-base mismatch count changed",
    )

    dim_measure_contract = build_measure_contract()
    dim_process_link = build_process_links(fact_raw)
    dim_claim = build_claims(joined, zone_raw)
    dim_contract = build_contract_ledger(archive, raw_tables)
    audit_release_contract = build_release_contract(archive, dim_contract)
    dim_collection_requirement = build_collection_requirements()

    fact_corridor_allocation = (
        fact.group_by("kitchen_id", "zone_id")
        .len(name="order_rows")
        .with_columns(allocation_share=f("order_rows") / fact.height)
        .with_columns(
            corridor_rank_within_kitchen=f("order_rows")
            .rank(method="dense", descending=True)
            .over("kitchen_id")
            .cast(pl.Int64)
        )
        .join(dim_kitchen.select("kitchen_id", "kitchen_name"), on="kitchen_id")
        .join(dim_zone.select("zone_id", "zone_name", "zone_tier"), on="zone_id")
        .select(
            "kitchen_id",
            "kitchen_name",
            "zone_id",
            "zone_name",
            "zone_tier",
            "order_rows",
            "allocation_share",
            "corridor_rank_within_kitchen",
        )
        .sort("kitchen_id", "corridor_rank_within_kitchen", "zone_id")
    )
    premise(fact_corridor_allocation.height == 80, "kitchen-zone grid is no longer complete")
    premise(
        fact.select("kitchen_id", "rider_id").unique().height == 240,
        "kitchen-rider grid is no longer complete",
    )
    premise(
        fact.select("kitchen_id", "time_slot_id").unique().height == 192,
        "kitchen-slot grid is no longer complete",
    )

    pairwise_results = [
        stats.pearsonr(fact_raw[left].to_numpy(), fact_raw[right].to_numpy())
        for left, right in itertools.combinations(SOURCE_MEASURES, 2)
    ]
    release = audit_release_contract.row(0, named=True)
    headline = pl.DataFrame(
        {
            "title": ["Every route. No journey."],
            "order_rows": [fact.height],
            "calendar_dates": [dim_date.height],
            "kitchens": [dim_kitchen.height],
            "zones": [dim_zone.height],
            "riders": [dim_rider.height],
            "time_slots": [dim_time_slot.height],
            "kitchen_zone_pairs": [fact_corridor_allocation.height],
            "kitchen_rider_pairs": [fact.select("kitchen_id", "rider_id").unique().height],
            "kitchen_slot_pairs": [fact.select("kitchen_id", "time_slot_id").unique().height],
            "largest_corridor_rows": [int(fact_corridor_allocation["order_rows"].max())],
            "largest_corridor_share": [float(fact_corridor_allocation["allocation_share"].max())],
            "rider_base_mismatches": [fact.filter(~f("rider_matches_base_kitchen")).height],
            "quarantined_measures": [dim_measure_contract.height],
            "pairwise_measure_tests": [len(pairwise_results)],
            "process_links_surviving_correction": [
                int(dim_process_link["survives_correction"].sum())
            ],
            "max_abs_pairwise_r": [
                max(abs(float(result.statistic)) for result in pairwise_results)
            ],
            "supplied_claims_confirmed": [dim_claim.filter(f("verdict") == "CONFIRMED").height],
            "supplied_claims_failed": [
                dim_claim.filter(f("verdict").is_in(["REJECTED", "UNSUPPORTED"])).height
            ],
            "validation_checks_passed": [release["validation_checks_passed"]],
            "configured_constraints": [release["configured_constraints"]],
            "matching_constraints": [release["matching_constraints"]],
            "configured_relationships": [release["configured_relationships"]],
            "unavailable_relationships": [release["unavailable_relationships"]],
            "invalid_relationships": [release["invalid_relationships"]],
        }
    )

    curated = {
        "audit_release_contract": audit_release_contract,
        "dim_claim": dim_claim,
        "dim_collection_requirement": dim_collection_requirement,
        "dim_contract": dim_contract,
        "dim_date": dim_date,
        "dim_kitchen": dim_kitchen,
        "dim_measure_contract": dim_measure_contract,
        "dim_process_link": dim_process_link,
        "dim_rider": dim_rider,
        "dim_time_slot": dim_time_slot,
        "dim_zone": dim_zone,
        "fact_corridor_allocation": fact_corridor_allocation,
        "fct_order_allocation": fact,
        "headline": headline,
    }

    CURATED.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for path in CURATED.glob("*.parquet"):
        path.unlink()
    for path in PUBLIC.glob("*.json"):
        path.unlink()

    print("\nCurated tables:")
    for name, frame in curated.items():
        write_table(name, frame)

    exports = {
        "allocations.json": fact.select(
            "order_id",
            "order_date",
            "kitchen_id",
            "zone_id",
            "rider_id",
            "time_slot_id",
        ).to_dicts(),
        "claims.json": dim_claim.to_dicts(),
        "collection_requirements.json": dim_collection_requirement.to_dicts(),
        "contracts.json": dim_contract.to_dicts(),
        "corridors.json": fact_corridor_allocation.to_dicts(),
        "headline.json": headline.to_dicts()[0],
        "measure_contracts.json": dim_measure_contract.to_dicts(),
        "process_links.json": dim_process_link.to_dicts(),
    }
    for name, payload in exports.items():
        dump_json(PUBLIC / name, payload)

    print("\nRow drop log:")
    print("  none - all 5,000 raw fact rows preserved")
    print("  nine source measures quarantined at column and semantic-layer level")
    print(f"\nPublic JSON: {len(exports)} finite files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
