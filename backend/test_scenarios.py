"""Hackathon demo scenarios and mathematical consistency checks."""
import json
from pathlib import Path
from engine import analyze

CROPS = json.loads((Path(__file__).resolve().parent / "crops.json").read_text())
BASE = {"land_area_acres": 5, "budget": 80000, "water_availability": "Medium", "labour_availability": "Medium", "machinery_availability": "Available", "risk_preference": "Medium"}

def run(**overrides): return analyze({**BASE, **overrides}, CROPS)
def crop(r, name): return next(x for x in r["strategies"] if x["crop"] == name)

def test_normal_demo():
    r = run()
    # Stage 1 formula: Mustard 79.8 (was Wheat 70.5 under the old formula); Wheat is a close 2nd.
    assert r["recommended_crop"] == "Mustard" and r["overall_score"] == 79.8
    assert crop(r, "Wheat")["rank"] == 2

def test_low_budget_changes_recommendation():
    r = run(budget=50000)
    assert r["recommended_crop"] == "Mustard"
    assert crop(r, "Wheat")["feasible"] is False
    assert crop(r, "Mustard")["feasible"] is True

def test_low_water_blocks_high_water_crops():
    r = run(water_availability="Low", budget=1_000_000)
    assert crop(r, "Rice")["constraints"]["water"] == "Fail"
    assert crop(r, "Sugarcane")["constraints"]["water"] == "Fail"
    assert r["recommended_crop"] in {"Maize", "Mustard"}

def test_low_labour_blocks_high_labour_crops():
    r = run(labour_availability="Low", budget=1_000_000)
    assert crop(r, "Wheat")["constraints"]["labour"] == "Fail"
    assert crop(r, "Rice")["constraints"]["labour"] == "Fail"
    assert crop(r, "Sugarcane")["constraints"]["labour"] == "Fail"
    assert r["recommended_crop"] == "Mustard"

def test_no_machinery_handles_machinery_dependent_strategies():
    r = run(machinery_availability="None", budget=1_000_000, water_availability="High", labour_availability="High")
    assert crop(r, "Sugarcane")["constraints"]["machinery"] == "Fail"
    assert crop(r, "Wheat")["constraints"]["machinery"] == "Fail"
    assert crop(r, "Mustard")["feasible"] is True

def test_low_risk_preference_strengthens_risk_penalty():
    low = crop(run(risk_preference="Low"), "Wheat")["score"]
    medium = crop(run(risk_preference="Medium"), "Wheat")["score"]
    high = crop(run(risk_preference="High"), "Wheat")["score"]
    # Stage 1 formula (risk compatibility): a risk-averse farmer scores the same crop lower
    assert (low, medium, high) == (73.0, 79.0, 81.0)

def test_money_invariants_for_every_crop():
    r = run(land_area_acres=7, budget=1_000_000, water_availability="High", labour_availability="High", machinery_availability="Available")
    source = {c["name"]: c for c in CROPS}
    for item in r["strategies"]:
        c = source[item["crop"]]
        assert item["total_cost"] == c["cost_per_acre"] * 7
        assert item["expected_revenue"] == c["expected_revenue"] * 7
        assert item["expected_profit"] == item["expected_revenue"] - item["total_cost"]

def test_extremely_low_budget_has_no_feasible_strategy():
    r = run(budget=1)
    assert r["feasibility_status"] == "No feasible strategy"
    assert r["recommended_crop"] is None

def test_all_low_can_have_no_feasible_strategy():
    r = run(budget=1, water_availability="Low", labour_availability="Low", machinery_availability="None")
    assert r["feasibility_status"] == "No feasible strategy"

def test_all_high_can_make_sugarcane_best():
    r = run(budget=1_000_000, water_availability="High", labour_availability="High", machinery_availability="Available")
    assert r["recommended_crop"] == "Sugarcane"
    assert all(item["feasible"] for item in r["strategies"])
