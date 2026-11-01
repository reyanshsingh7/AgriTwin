"""Engine tests -- pure Python, no FastAPI needed."""
import json
from pathlib import Path

from engine import analyze

CROPS = json.loads((Path(__file__).resolve().parent / "crops.json").read_text())

BASE = {
    "land_area_acres": 5,
    "budget": 80000,
    "water_availability": "Medium",
    "labour_availability": "Medium",
    "machinery_availability": "Available",
    "risk_preference": "Medium",
}


def run(**overrides):
    return analyze({**BASE, **overrides}, CROPS)


def by_crop(result, name):
    return next(s for s in result["strategies"] if s["crop"] == name)


def test_example_payload_recommendation():
    # STAGE 1: the scoring formula changed (see README), so the old exact numbers no longer apply.
    # Wheat (old winner, 70.5) is still feasible and a close second; Mustard now edges it by 0.8
    # points because it leaves headroom on every resource (Wheat uses 94% of the budget and
    # exactly meets water/labour). Weights are configurable if you prefer a different balance.
    r = run()
    assert r["feasibility_status"] == "Feasible"
    assert r["recommended_crop"] == "Mustard"
    assert r["recommended_strategy"] == "Low-Cost Oilseed Strategy"
    assert r["overall_score"] == 79.8
    wheat = by_crop(r, "Wheat")
    assert wheat["feasible"] is True and wheat["rank"] == 2 and wheat["score"] == 79.0


def test_money_scales_with_land_area():
    wheat5 = by_crop(run(land_area_acres=5), "Wheat")
    wheat10 = by_crop(run(land_area_acres=10, budget=1_000_000), "Wheat")
    assert wheat5["total_cost"] == 15000 * 5
    assert wheat5["expected_revenue"] == 45000 * 5
    assert wheat5["expected_profit"] == 45000 * 5 - 15000 * 5
    assert wheat10["total_cost"] == 15000 * 10
    assert wheat10["expected_revenue"] == 45000 * 10


def test_budget_boundary_is_inclusive():
    assert by_crop(run(budget=75000), "Wheat")["constraints"]["budget"] == "Pass"
    assert by_crop(run(budget=74999), "Wheat")["constraints"]["budget"] == "Fail"


def test_constraint_breakdown_for_failed_crop():
    rice = by_crop(run(), "Rice")  # needs 125k, High water, High labour, Medium machinery
    assert rice["feasible"] is False
    assert rice["constraints"] == {
        "budget": "Fail", "water": "Fail", "labour": "Fail", "machinery": "Pass",
    }
    assert len(rice["issues"]) == 3


def test_machinery_constraint():
    r = run(machinery_availability="None", budget=10_000_000,
            water_availability="High", labour_availability="High")
    assert by_crop(r, "Sugarcane")["constraints"]["machinery"] == "Fail"
    assert by_crop(r, "Wheat")["constraints"]["machinery"] == "Fail"
    assert by_crop(r, "Mustard")["constraints"]["machinery"] == "Pass"  # hand-workable
    assert r["recommended_crop"] in {"Maize", "Mustard"}


def test_limited_machinery_blocks_only_high_need_crops():
    r = run(machinery_availability="Limited", budget=10_000_000,
            water_availability="High", labour_availability="High")
    assert by_crop(r, "Sugarcane")["constraints"]["machinery"] == "Fail"
    assert by_crop(r, "Wheat")["constraints"]["machinery"] == "Pass"


def test_risk_preference_changes_penalty():
    low = by_crop(run(risk_preference="Low"), "Wheat")["score"]
    med = by_crop(run(risk_preference="Medium"), "Wheat")["score"]
    high = by_crop(run(risk_preference="High"), "Wheat")["score"]
    assert low < med < high


def test_no_feasible_strategy():
    r = run(budget=0, water_availability="Low", labour_availability="Low",
            machinery_availability="None")
    assert r["feasibility_status"] == "No feasible strategy"
    assert r["recommended_crop"] is None
    assert r["recommended_strategy"] is None
    assert r["overall_score"] is None
    assert r["strategies"] and all(not s["feasible"] for s in r["strategies"])
    assert all(s["issues"] for s in r["strategies"])


def test_feasible_always_ranked_before_infeasible_and_ranks_sequential():
    r = run()
    flags = [s["feasible"] for s in r["strategies"]]
    assert flags == sorted(flags, reverse=True)
    assert [s["rank"] for s in r["strategies"]] == list(range(1, len(CROPS) + 1))
    scores = [s["score"] for s in r["strategies"] if s["feasible"]]
    assert scores == sorted(scores, reverse=True)


def test_all_strategies_have_full_contract():
    for s in run()["strategies"]:
        assert set(s["constraints"]) == {"budget", "water", "labour", "machinery"}
        assert all(v in ("Pass", "Fail") for v in s["constraints"].values())
        assert s["feasible"] == all(v == "Pass" for v in s["constraints"].values())
        assert 0 <= s["score"] <= 100
        assert s["reason"]
