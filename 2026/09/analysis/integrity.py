#!/usr/bin/env python3
"""Read-only G2/G3 integrity and hypothesis audit for the September 2026 archive."""

from __future__ import annotations

import itertools
import json
import math
from pathlib import Path

import numpy as np
import polars as pl
from scipy import stats

MONTH_DIR = Path(__file__).resolve().parents[1]
ARCHIVE = next((path.parents[1] for path in MONTH_DIR.rglob("fact_orders.csv")), None)


def load(data_dir: Path, name: str) -> pl.DataFrame:
    return pl.read_csv(data_dir / "data" / name, infer_schema_length=None)


def analyze(archive_root: Path) -> dict[str, dict[str, object]]:
    fact = load(archive_root, "fact_orders.csv").with_columns(
        pl.col("order_date").str.to_date("%m/%d/%Y")
    )
    kitchens = load(archive_root, "dim_kitchen.csv").with_columns(
        pl.col("date_opened").str.to_date("%m/%d/%Y")
    )
    zones = load(archive_root, "dim_delivery_zone.csv")
    riders = load(archive_root, "dim_rider.csv")
    slots = load(archive_root, "dim_time_slot.csv")

    start = fact["order_date"].min()
    end = fact["order_date"].max()
    fact_orphans = sum(
        fact.join(dim, left_on=fk, right_on=pk, how="anti").height
        for fk, dim, pk in (
            ("kitchen_id", kitchens, "kitchen_id"),
            ("zone_id", zones, "zone_id"),
            ("rider_id", riders, "rider_id"),
            ("time_slot_id", slots, "time_slot_id"),
        )
    )
    rider_kitchen_orphans = riders.join(
        kitchens, left_on="assigned_kitchen_id", right_on="kitchen_id", how="anti"
    ).height

    profit_residual = (
        pl.col("order_profit_ngn") - (pl.col("order_value_ngn") - pl.col("delivery_cost_ngn"))
    ).abs()
    order_slots = fact.join(slots, on="time_slot_id").with_columns(
        pl.col("order_date").dt.strftime("%A").alias("calendar_day")
    )
    slot_checks = slots.with_columns(
        pl.col("day_of_week").is_in(["Saturday", "Sunday"]).alias("day_is_weekend"),
        pl.col("slot_label").str.slice(0, 5).alias("slot_start"),
    )

    validation = json.loads(
        (archive_root / "docs" / "VALIDATION_REPORT.json").read_text(encoding="utf-8")
    )
    config = json.loads((archive_root / "docs" / "SCHEMA_CONFIG.json").read_text(encoding="utf-8"))
    tables = {
        "fact_orders": fact,
        "dim_kitchen": kitchens,
        "dim_delivery_zone": zones,
        "dim_rider": riders,
        "dim_time_slot": slots,
    }
    exact_duplicate_rows = sum(table.height - table.unique().height for table in tables.values())
    null_values = sum(sum(table.null_count().row(0)) for table in tables.values())
    constraints = config["column_constraints"]
    matching_constraints = sum(
        spec["table_name"] in tables and spec["column_name"] in tables[spec["table_name"]].columns
        for spec in constraints.values()
    )
    unavailable_relationships = sum(
        rel["from_table"] not in tables
        or rel["to_table"] not in tables
        or rel["from_column"] not in tables.get(rel["from_table"], pl.DataFrame()).columns
        or rel["to_column"] not in tables.get(rel["to_table"], pl.DataFrame()).columns
        for rel in config["relationship_rules"].values()
    )

    duplicate_zone_names = zones.group_by("zone_name").len().filter(pl.col("len") > 1)
    duplicate_rider_names = riders.group_by("rider_name").len().filter(pl.col("len") > 1)

    continuous_supports = {
        "order_value_ngn": (500.0, 150_000.0),
        "delivery_distance_km": (0.2, 35.0),
        "traffic_friction_score": (1.0, 10.0),
        "food_temp_on_arrival_c": (0.0, 1_000.0),
        "customer_rating": (1.0, 5.0),
        "delivery_cost_ngn": (200.0, 12_000.0),
        "order_profit_ngn": (0.0, 1_000.0),
    }
    uniform_pvalues = {
        column: float(
            stats.kstest((fact[column].to_numpy() - low) / (high - low), "uniform").pvalue
        )
        for column, (low, high) in continuous_supports.items()
    }
    clock_uniform_pvalues = {}
    for column in ("promised_delivery_min", "actual_delivery_min"):
        counts, _ = np.histogram(fact[column].to_numpy(), bins=np.linspace(0, 1001, 11))
        clock_uniform_pvalues[column] = float(stats.chisquare(counts).pvalue)

    documented_normals = {
        "order_value_ngn": (4_800.0, 1_600.0),
        "actual_delivery_min": (52.0, 18.0),
        "food_temp_on_arrival_c": (58.0, 12.0),
        "delivery_cost_ngn": (1_200.0, 400.0),
        "order_profit_ngn": (800.0, 950.0),
    }
    documented_normal_results = {
        column: stats.kstest(fact[column].to_numpy(), stats.norm(loc=mean, scale=sd).cdf)
        for column, (mean, sd) in documented_normals.items()
    }

    measure_columns = [
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
    pairwise_results = []
    for left, right in itertools.combinations(measure_columns, 2):
        result = stats.pearsonr(fact[left].to_numpy(), fact[right].to_numpy())
        pairwise_results.append((left, right, float(result.statistic), float(result.pvalue)))
    pairwise_alpha = 0.05 / len(pairwise_results)
    expected_chain_pairs = [
        ("traffic_friction_score", "actual_delivery_min"),
        ("delivery_distance_km", "actual_delivery_min"),
        ("actual_delivery_min", "food_temp_on_arrival_c"),
        ("actual_delivery_min", "customer_rating"),
        ("delivery_distance_km", "delivery_cost_ngn"),
        ("delivery_distance_km", "order_profit_ngn"),
        ("order_value_ngn", "order_profit_ngn"),
        ("delivery_cost_ngn", "order_profit_ngn"),
    ]
    expected_chain = {
        f"{left}__{right}": float(
            stats.pearsonr(fact[left].to_numpy(), fact[right].to_numpy()).statistic
        )
        for left, right in expected_chain_pairs
    }
    promised_actual = stats.pearsonr(
        fact["promised_delivery_min"].to_numpy(), fact["actual_delivery_min"].to_numpy()
    )

    key_balance = {}
    for column in ("kitchen_id", "zone_id", "rider_id", "time_slot_id"):
        counts = fact.group_by(column).len()["len"].to_numpy()
        key_balance[column] = {
            "groups": len(counts),
            "min": int(counts.min()),
            "max": int(counts.max()),
            "pvalue": float(stats.chisquare(counts).pvalue),
        }
    corridor_counts = fact.group_by("kitchen_id", "zone_id").len()
    rider_base = fact.join(riders.select("rider_id", "assigned_kitchen_id"), on="rider_id")
    rider_base_table = (
        rider_base.group_by("kitchen_id", "assigned_kitchen_id")
        .len()
        .pivot(values="len", index="kitchen_id", on="assigned_kitchen_id")
        .fill_null(0)
        .drop("kitchen_id")
        .to_numpy()
    )
    rider_base_chi = stats.chi2_contingency(rider_base_table)
    rider_base_v = math.sqrt(
        rider_base_chi.statistic
        / (
            rider_base_table.sum()
            * min(rider_base_table.shape[0] - 1, rider_base_table.shape[1] - 1)
        )
    )

    joined = (
        fact.join(kitchens, on="kitchen_id")
        .join(zones, on="zone_id")
        .join(slots, on="time_slot_id")
    )
    rush_outer = joined.filter(
        (pl.col("is_rush_hour") == "Yes") & pl.col("zone_tier").str.contains("Outer")
    )
    rain = joined.filter(
        (pl.col("weather_condition") == "Light Rain")
        | (pl.col("weather_condition") == "Heavy Rain")
    )
    non_rain = joined.filter(
        (pl.col("weather_condition") != "Light Rain")
        & (pl.col("weather_condition") != "Heavy Rain")
    )
    long_distance = joined.filter(pl.col("delivery_distance_km") > 8)
    near_distance = joined.filter(pl.col("delivery_distance_km") <= 8)
    slow = joined.filter(pl.col("actual_delivery_min") > 60)
    lekki_ikoyi = joined.filter(
        pl.col("kitchen_name").str.contains("Lekki") & (pl.col("zone_name") == "Ikoyi")
    )
    vi_zone_present = bool(
        zones.filter(
            (pl.col("zone_name") == "VI") | pl.col("zone_name").str.contains("Victoria Island")
        ).height
    )

    return {
        "shape": {
            "fact_rows": fact.height,
            "distinct_order_ids": fact["order_id"].n_unique(),
            "date_start": start.isoformat(),
            "date_end": end.isoformat(),
            "distinct_dates": fact["order_date"].n_unique(),
            "date_gaps": pl.date_range(start, end, "1d", eager=True).len()
            - fact["order_date"].n_unique(),
            "exact_duplicate_rows": exact_duplicate_rows,
            "null_values": null_values,
            "total_fact_orphans": fact_orphans,
            "rider_kitchen_orphans": rider_kitchen_orphans,
        },
        "quality": {
            "promised_outside_documented_range": fact.filter(
                (pl.col("promised_delivery_min") < 25) | (pl.col("promised_delivery_min") > 45)
            ).height,
            "actual_over_120_minutes": fact.filter(pl.col("actual_delivery_min") > 120).height,
            "temperature_outside_0_100": fact.filter(
                (pl.col("food_temp_on_arrival_c") < 0) | (pl.col("food_temp_on_arrival_c") > 100)
            ).height,
            "rider_speed_over_100": riders.filter(pl.col("avg_speed_kmh") > 100).height,
            "profit_identity_failures": fact.filter(profit_residual > 0.01).height,
            "negative_profit_rows": fact.filter(pl.col("order_profit_ngn") < 0).height,
            "profit_residual_median": fact.select(profit_residual.median()).item(),
        },
        "dimensions": {
            "order_weekday_mismatches": order_slots.filter(
                pl.col("calendar_day") != pl.col("day_of_week")
            ).height,
            "slot_weekend_contradictions": slot_checks.filter(
                pl.col("is_weekend") != pl.col("day_is_weekend")
            ).height,
            "slot_hour_label_contradictions": slot_checks.filter(
                pl.col("hour_of_day") != pl.col("slot_start")
            ).height,
            "orders_before_kitchen_open": fact.join(
                kitchens.select("kitchen_id", "date_opened"), on="kitchen_id"
            )
            .filter(pl.col("order_date") < pl.col("date_opened"))
            .height,
            "orders_outside_rider_base_kitchen": fact.join(
                riders.select("rider_id", "assigned_kitchen_id"), on="rider_id"
            )
            .filter(pl.col("kitchen_id") != pl.col("assigned_kitchen_id"))
            .height,
            "duplicate_zone_name_rows": int(duplicate_zone_names["len"].sum()),
            "duplicate_rider_name_rows": int(duplicate_rider_names["len"].sum()),
        },
        "generation": {
            "continuous_uniform_tests": len(uniform_pvalues),
            "continuous_uniform_survivors": sum(
                pvalue > 0.05 for pvalue in uniform_pvalues.values()
            ),
            "continuous_uniform_pvalues": uniform_pvalues,
            "minimum_continuous_uniform_p": min(uniform_pvalues.values()),
            "promised_uniform_p": clock_uniform_pvalues["promised_delivery_min"],
            "actual_uniform_p": clock_uniform_pvalues["actual_delivery_min"],
            "documented_normal_rejections": int(
                sum(result.pvalue < 0.05 for result in documented_normal_results.values())
            ),
            "documented_normal_d": {
                column: float(result.statistic)
                for column, result in documented_normal_results.items()
            },
            "pairwise_tests": len(pairwise_results),
            "pairwise_alpha": pairwise_alpha,
            "pairwise_survivors": sum(result[3] < pairwise_alpha for result in pairwise_results),
            "max_abs_pairwise_r": max(abs(result[2]) for result in pairwise_results),
            "strongest_pair": max(pairwise_results, key=lambda result: abs(result[2])),
            "expected_chain_r": expected_chain,
            "promised_actual_r": float(promised_actual.statistic),
            "actual_gt_promised": fact.filter(
                pl.col("actual_delivery_min") > pl.col("promised_delivery_min")
            ).height,
            "actual_equal_promised": fact.filter(
                pl.col("actual_delivery_min") == pl.col("promised_delivery_min")
            ).height,
            "actual_lt_promised": fact.filter(
                pl.col("actual_delivery_min") < pl.col("promised_delivery_min")
            ).height,
        },
        "network": {
            "key_balance": key_balance,
            "minimum_key_balance_p": min(item["pvalue"] for item in key_balance.values()),
            "kitchen_zone_pairs": fact.select("kitchen_id", "zone_id").unique().height,
            "possible_kitchen_zone_pairs": kitchens.height * zones.height,
            "kitchen_rider_pairs": fact.select("kitchen_id", "rider_id").unique().height,
            "possible_kitchen_rider_pairs": kitchens.height * riders.height,
            "kitchen_slot_pairs": fact.select("kitchen_id", "time_slot_id").unique().height,
            "possible_kitchen_slot_pairs": kitchens.height * slots.height,
            "zone_slot_pairs": fact.select("zone_id", "time_slot_id").unique().height,
            "possible_zone_slot_pairs": zones.height * slots.height,
            "smallest_corridor_orders": int(corridor_counts["len"].min()),
            "largest_corridor_orders": int(corridor_counts["len"].max()),
            "largest_corridor_share": float(corridor_counts["len"].max() / fact.height),
            "rider_base_matches": rider_base.filter(
                pl.col("kitchen_id") == pl.col("assigned_kitchen_id")
            ).height,
            "rider_base_mismatches": rider_base.filter(
                pl.col("kitchen_id") != pl.col("assigned_kitchen_id")
            ).height,
            "rider_base_association_p": float(rider_base_chi.pvalue),
            "rider_base_cramers_v": rider_base_v,
        },
        "claims": {
            "rush_outer_n": rush_outer.height,
            "rush_outer_over_90": rush_outer.filter(pl.col("actual_delivery_min") > 90).height,
            "rush_outer_triple_sla": rush_outer.filter(
                pl.col("actual_delivery_min") >= 3 * pl.col("promised_delivery_min")
            ).height,
            "rush_outer_negative_profit": rush_outer.filter(
                pl.col("order_profit_ngn") < -500
            ).height,
            "rush_outer_mean_actual": float(rush_outer["actual_delivery_min"].mean()),
            "rush_outer_mean_profit": float(rush_outer["order_profit_ngn"].mean()),
            "rain_n": rain.height,
            "non_rain_n": non_rain.height,
            "rain_mean_traffic": float(rain["traffic_friction_score"].mean()),
            "non_rain_mean_traffic": float(non_rain["traffic_friction_score"].mean()),
            "rain_traffic_ratio": float(
                rain["traffic_friction_score"].mean() / non_rain["traffic_friction_score"].mean()
            ),
            "rain_mean_actual": float(rain["actual_delivery_min"].mean()),
            "non_rain_mean_actual": float(non_rain["actual_delivery_min"].mean()),
            "rain_actual_diff": float(
                rain["actual_delivery_min"].mean() - non_rain["actual_delivery_min"].mean()
            ),
            "long_distance_n": long_distance.height,
            "long_distance_share": long_distance.height / fact.height,
            "long_distance_negative_profit": long_distance.filter(
                pl.col("order_profit_ngn") < 0
            ).height,
            "long_distance_mean_profit": float(long_distance["order_profit_ngn"].mean()),
            "near_distance_mean_profit": float(near_distance["order_profit_ngn"].mean()),
            "slow_n": slow.height,
            "slow_cold_n": slow.filter(pl.col("food_temp_on_arrival_c") < 45).height,
            "slow_low_rating_n": slow.filter(pl.col("customer_rating") < 2.5).height,
            "lekki_ikoyi_n": lekki_ikoyi.height,
            "lekki_ikoyi_negative_profit": lekki_ikoyi.filter(
                pl.col("order_profit_ngn") < 0
            ).height,
            "lekki_ikoyi_mean_profit": float(lekki_ikoyi["order_profit_ngn"].mean()),
            "vi_zone_present": vi_zone_present,
            "supported_count": 0,
        },
        "archive": {
            "validation_checks_passed": validation["summary"]["passed"],
            "configured_constraints": len(constraints),
            "matching_constraints": matching_constraints,
            "configured_relationships": len(config["relationship_rules"]),
            "unavailable_relationships": unavailable_relationships,
        },
    }


def main() -> int:
    if ARCHIVE is None:
        raise SystemExit("Raw September archive is not present")
    print(json.dumps(analyze(ARCHIVE), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
