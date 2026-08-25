from __future__ import annotations

import importlib.util
import shutil
from pathlib import Path

import pytest

MONTH_DIR = Path(__file__).resolve().parents[1]
INTEGRITY_PATH = Path(__file__).with_name("integrity.py")
SPEC = importlib.util.spec_from_file_location("august_integrity", INTEGRITY_PATH)
assert SPEC is not None and SPEC.loader is not None
integrity = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(integrity)


def test_integrity_module_imports_without_raw_archive(tmp_path: Path) -> None:
    copied = tmp_path / "2026" / "08" / "analysis" / "integrity.py"
    copied.parent.mkdir(parents=True)
    shutil.copy(INTEGRITY_PATH, copied)
    spec = importlib.util.spec_from_file_location("integrity_without_raw", copied)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)

    spec.loader.exec_module(module)

    assert module.DATA is None


@pytest.fixture(scope="module")
def findings() -> dict[str, dict[str, object]]:
    facts = list(MONTH_DIR.rglob("fact_transactions_Updated_.csv"))
    if not facts:
        pytest.skip("raw August archive is not present")
    return integrity.analyze(facts[0].parent)


def test_delivered_tables_have_transaction_grain(findings: dict[str, dict[str, object]]) -> None:
    shape = findings["shape"]
    assert shape["fact_rows"] == 50_000
    assert shape["distinct_transaction_ids"] == 50_000
    assert shape["worker_rows"] == 5_000
    assert shape["used_workers"] == 4_999
    assert shape["worker_fraud_icc"] == pytest.approx(-0.0018420154)


def test_all_six_supplied_claims_are_rejected(findings: dict[str, dict[str, object]]) -> None:
    claims = findings["claims"]
    assert claims["ussd_app_fraud_ratio"] == pytest.approx(1.0171687296)
    assert claims["nigeria_kenya_fraud_count_share"] == pytest.approx(0.4981507258)
    assert claims["new_account_fraud_ratio"] == pytest.approx(1.0161044439)
    assert claims["market_trader_dispute_rank"] == 10
    assert claims["velocity_fraud_r"] == pytest.approx(-0.0007426564)
    assert claims["velocity_reversal_r"] == pytest.approx(0.0026659625)
    assert claims["month_end_cashout_diff"] == pytest.approx(0.0065973400)
    assert claims["month_end_reversal_diff"] == pytest.approx(0.0190194295)
    assert claims["month_end_cashout_reversal_diff"] == pytest.approx(0.0827518296)
    assert claims["month_end_cashout_reversal_pvalue"] == pytest.approx(0.0575158879)
    assert claims["supported_count"] == 0


def test_risk_fields_have_no_corrected_predictive_linkage(
    findings: dict[str, dict[str, object]],
) -> None:
    risk = findings["risk_screen"]
    assert risk["categorical_tests"] == 60
    assert risk["bonferroni_survivors"] == 0
    assert risk["max_cramers_v"] == pytest.approx(0.0215589831)
    assert risk["interaction_tests"] == 570
    assert risk["interaction_survivors"] == 0
    assert risk["min_interaction_p"] == pytest.approx(0.0032285996)
    assert risk["ussd_transaction_type_p"] == pytest.approx(0.0078146589)
    assert risk["ussd_transaction_type_v"] == pytest.approx(0.0434841136)
    assert risk["max_abs_continuous_r"] == pytest.approx(0.0063228545)
    assert risk["daily_variance_ratio"] == pytest.approx(0.9926776346)
    assert risk["fraud_loss_flag_alignment"] == 50_000


def test_financial_fields_do_not_reconcile(findings: dict[str, dict[str, object]]) -> None:
    finance = findings["finance"]
    assert finance["local_usd_r"] == pytest.approx(0.0018912371)
    assert finance["usd_fx_r"] == pytest.approx(0.0020661481)
    assert finance["loss_amount_r"] == pytest.approx(-0.0045296922)
    assert finance["loss_exceeds_amount_rows"] == 12_562
    assert finance["loss_to_flagged_value"] == pytest.approx(0.9973808008)


def test_archive_validation_targets_fields_the_csvs_do_not_have(
    findings: dict[str, dict[str, object]],
) -> None:
    archive = findings["archive"]
    assert archive["validation_checks_passed"] == 9
    assert archive["configured_relationships"] == 9
    assert archive["unavailable_relationships"] == 5
    assert archive["configured_constraints"] == 54
    assert archive["matching_constraint_names"] == 0
    assert archive["eda_date_rows"] == 730
    assert archive["actual_date_rows"] == 731
