"""
Stage 1 decision-engine tests: feasibility, financials, scoring, ranking, explanations.
Pure Python (no FastAPI needed). Uses the real crops.json plus small hand-made crop sets
where an exact expectation is needed.
"""
import json
import math
from pathlib import Path

from engine import DEFAULT_WEIGHTS, NO_FEASIBLE_MESSAGE, analyze, check_feasibility, compute_financials

CROPS = json.loads((Path(__file__).resolve().parent / "crops.json").read_text())

BASE = {
    "land_area_acres": 5,
    "budget": 80000,
    "water_availability": "Medium",
    "labour_availability": "Medium",
    "machinery_availability": "Available",
    "risk_preference": "Medium",
}
RICH = {"budget": 10_000_000, "water_availability": "High", "labour_availability": "High",
        "machinery_availability": "Available"}


def run(db=None, weights=None, **overrides):
    return analyze({**BASE, **overrides}, CROPS if db is None else db, weights)


def crop(r, name):
    return next(s for s in r["strategies"] if s["crop"] == name)


def mk(name, cost=10000, rev=30000, water="Low", labour=20, mach="Low", suit=80, risk=10):
    return {"name": name, "cost_per_acre": cost, "expected_revenue": rev, "water_requirement": water,
            "labour_requirement": labour, "machinery_requirement": mach, "suitability_score": suit,
            "risk_score": risk, "strategy": f"{name} Strategy"}


def raises_value_error(fn):
    try:
        fn()
    except ValueError:
        return True
    return False


# ------------------------------------------------------------ budget scenarios
def test_low_budget_farmer_only_cheapest_crop_feasible():
    r = run(budget=40000)  # exactly Mustard's 8000 x 5 acres
    assert r["recommended_crop"] == "Mustard"
    assert [s["crop"] for s in r["strategies"] if s["feasible"]] == ["Mustard"]
    assert crop(r, "Maize")["constraint_details"]["budget"]["status"] == "fail"
    assert crop(r, "Mustard")["constraint_details"]["budget"]["status"] == "tight"  # 100% of budget used


def test_high_budget_farmer_has_many_feasible_crops_sorted_by_score():
    r = run(**RICH)
    assert all(s["feasible"] for s in r["strategies"])
    scores = [s["score"] for s in r["strategies"]]
    assert scores == sorted(scores, reverse=True)
    assert r["recommended_crop"] == "Sugarcane"
    assert all(s["constraint_details"]["budget"]["status"] == "pass" for s in r["strategies"])


def test_large_land_with_insufficient_total_budget():
    r = run(land_area_acres=100, budget=500_000)  # per-acre budget 5,000 < cheapest crop 8,000
    assert r["feasibility_status"] == "No feasible strategy"
    must = crop(r, "Mustard")
    assert must["total_cost"] == 800_000
    b = must["constraint_details"]["budget"]
    assert b["status"] == "fail" and b["shortfall"] == 300_000
    land = must["constraint_details"]["land"]  # soft, informational check
    assert land["status"] == "partial" and land["hard"] is False
    assert land["affordable_acres"] == 62.5
    assert any("300,000" in c for c in must["explanation"]["what_would_make_it_feasible"])
    assert any("62.5" in c for c in must["explanation"]["what_would_make_it_feasible"])


def test_budget_is_whole_farm_not_per_acre():
    small = run(land_area_acres=1, budget=15000)
    big = run(land_area_acres=10, budget=15000)
    assert crop(small, "Wheat")["feasible"] is True
    assert crop(big, "Wheat")["constraint_details"]["budget"]["status"] == "fail"


# ------------------------------------------------------------ water / labour / machinery
def test_limited_water_blocks_water_hungry_crops():
    r = run(**{**RICH, "water_availability": "Low"})
    for name in ("Rice", "Sugarcane", "Wheat", "Cotton"):
        c = crop(r, name)
        assert c["constraints"]["water"] == "Fail" and c["feasible"] is False, name
        assert c["constraint_details"]["water"]["status"] == "fail"
    assert {s["crop"] for s in r["strategies"] if s["feasible"]} == {"Maize", "Mustard"}
    assert crop(r, "Rice")["constraint_details"]["water"]["fulfilment_pct"] == 33.3  # Low(1) of High(3)


def test_limited_labour_blocks_labour_heavy_crops():
    r = run(**{**RICH, "labour_availability": "Low"})
    assert {s["crop"] for s in r["strategies"] if s["feasible"]} == {"Mustard"}
    d = crop(r, "Cotton")["constraint_details"]["labour"]
    assert d["status"] == "fail" and d["person_days_per_acre"] == 70 and d["person_days_whole_farm"] == 350


def test_unavailable_machinery():
    r = run(**{**RICH, "machinery_availability": "None"})
    feasible = {s["crop"] for s in r["strategies"] if s["feasible"]}
    assert feasible == {"Maize", "Mustard"}  # only crops needing "Low" machinery
    assert crop(r, "Sugarcane")["constraint_details"]["machinery"]["status"] == "fail"
    assert crop(r, "Mustard")["constraint_details"]["machinery"]["status"] == "pass"


def test_partial_mismatch_tight_is_pass_but_flagged_and_scored_lower():
    # Wheat at the default farm: budget 94% used, water/labour exactly met -> "tight", still feasible
    w = crop(run(), "Wheat")
    assert w["feasible"] is True
    for k in ("budget", "water", "labour"):
        assert w["constraint_details"][k]["status"] == "tight", k
        assert w["constraint_details"][k]["passed"] is True
    assert w["component_scores"]["feasibility"] == 92.5   # (90 + 90 + 90 + 100) / 4
    assert crop(run(**RICH), "Wheat")["component_scores"]["feasibility"] == 100   # ample resources


# ------------------------------------------------------------ risk
def test_low_risk_farmer_does_not_get_high_risk_crop_by_default():
    low = run(**RICH, risk_preference="Low")
    top = low["strategies"][0]
    assert top["risk_level"] == "Low" and low["recommended_crop"] == "Mustard"
    for name in ("Sugarcane", "Cotton"):   # risk 40 / 50
        assert crop(low, name)["component_scores"]["risk_compatibility"] == 0
        assert crop(low, name)["rank"] > top["rank"]
        obs = " ".join(crop(low, name)["explanation"]["risk_observations"])
        assert "conflicts with your low risk preference" in obs


def test_risk_preference_changes_recommendation_and_risk_score():
    med = run(**RICH, risk_preference="Medium")
    high = run(**RICH, risk_preference="High")
    assert med["recommended_crop"] == "Sugarcane" and high["recommended_crop"] == "Sugarcane"
    assert high["overall_score"] > med["overall_score"]
    comp = [crop(run(**RICH, risk_preference=p), "Cotton")["component_scores"]["risk_compatibility"]
            for p in ("Low", "Medium", "High")]
    assert comp == [0, 50, 75]            # 100 - 50 x (2.5, 1.0, 0.5), clipped at 0
    base = [run(risk_preference=p)["recommended_crop"] for p in ("Low", "Medium", "High")]
    assert base == ["Mustard", "Mustard", "Wheat"]   # risk-tolerant farmer prefers the higher-profit crop


# ------------------------------------------------------------ no feasible / multiple feasible
def test_no_feasible_crop_message_and_alternatives():
    r = run(budget=0, water_availability="Low", labour_availability="Low", machinery_availability="None")
    assert r["feasibility_status"] == "No feasible strategy"
    assert r["message"] == "No suitable crop currently satisfies all critical farming constraints."
    assert r["message"] == NO_FEASIBLE_MESSAGE
    assert r["recommended_crop"] is None and r["overall_score"] is None
    assert r["feasible_ranking"] == [] and len(r["infeasible_ranking"]) == len(CROPS)
    assert 1 <= len(r["best_alternatives"]) <= 3
    for alt in r["best_alternatives"]:
        assert alt["failed_constraints"] and alt["required_changes"]
    assert r["best_alternatives"][0]["crop"] == r["strategies"][0]["crop"]


def test_multiple_feasible_crops_ranked_and_separate_from_infeasible():
    r = run()
    feas = r["feasible_ranking"]
    assert set(feas) == {"Mustard", "Wheat", "Maize"} and feas[0] == r["recommended_crop"]
    flags = [s["feasible"] for s in r["strategies"]]
    assert flags == sorted(flags, reverse=True)
    assert [s["rank"] for s in r["strategies"]] == list(range(1, len(CROPS) + 1))
    assert [s["group_rank"] for s in r["strategies"] if s["feasible"]] == [1, 2, 3]
    assert r["strategies"][0]["category"] == "recommended"
    assert {s["crop"] for s in r["strategies"] if not s["feasible"]} == set(r["infeasible_ranking"])


# ------------------------------------------------------------ hard constraint enforcement
def test_infeasible_crop_never_primary_even_with_higher_score():
    star = mk("Star", cost=10000, rev=200000, water="High", suit=100, risk=0)   # great but needs High water
    plain = mk("Plain", cost=10000, rev=12000, suit=20, risk=50)                # weak but feasible
    r = run([star, plain], water_availability="Low")
    s, p = crop(r, "Star"), crop(r, "Plain")
    assert s["score"] > p["score"]                 # overall score alone would pick Star ...
    assert s["feasible"] is False and s["eligible_for_primary"] is False
    assert r["recommended_crop"] == "Plain"        # ... but the hard constraint wins
    assert p["rank"] == 1 and s["rank"] == 2


def test_every_hard_constraint_blocks_primary():
    for field, value, crop_kw in (
        ("budget", 100, {}),
        ("water_availability", "Low", {"water": "High"}),
        ("labour_availability", "Low", {"labour": 90}),
        ("machinery_availability", "None", {"mach": "High"}),
    ):
        r = run([mk("Only", **crop_kw)], **{field: value})
        assert r["recommended_crop"] is None, field
        assert r["message"] == NO_FEASIBLE_MESSAGE
        assert r["strategies"][0]["feasible"] is False


def test_feasible_flag_matches_constraints_and_issues():
    for overrides in ({}, RICH, {"budget": 30000}, {"water_availability": "Low"}):
        for s in run(**overrides)["strategies"]:
            ok = all(v == "Pass" for v in s["constraints"].values())
            assert s["feasible"] == ok == (not s["issues"])
            assert s["eligible_for_primary"] == s["feasible"]
            assert len(s["issues"]) == sum(v == "Fail" for v in s["constraints"].values())


def test_failed_constraint_caps_feasibility_component():
    r = run(budget=74000)  # Wheat misses budget by a hair but passes the rest
    w = crop(r, "Wheat")
    assert w["feasible"] is False
    assert w["component_scores"]["feasibility"] <= 50


def test_legacy_check_feasibility_helper_contract():
    cons, issues = check_feasibility({**BASE}, next(c for c in CROPS if c["name"] == "Rice"))
    assert cons == {"budget": "Fail", "water": "Fail", "labour": "Fail", "machinery": "Pass"}
    assert len(issues) == 3


# ------------------------------------------------------------ financials
def test_roi_and_net_profit_are_correct():
    c = mk("Exact", cost=10000, rev=25000)
    fin = compute_financials(c, 4)
    assert fin["per_acre"] == {"cost": 10000, "revenue": 25000, "net_profit": 15000, "roi_pct": 150.0}
    assert fin["whole_farm"] == {"cost": 40000, "revenue": 100000, "net_profit": 60000, "roi_pct": 150.0}
    s = run([c], land_area_acres=4, budget=50000)["strategies"][0]
    assert s["total_cost"] == 40000 and s["expected_revenue"] == 100000
    assert s["expected_profit"] == s["expected_revenue"] - s["total_cost"] == 60000
    assert s["roi_pct"] == 150.0 == round(s["expected_profit"] / s["total_cost"] * 100, 1)


def test_every_real_crop_financials_consistent_with_dataset():
    r = run(land_area_acres=7, **RICH)
    src = {c["name"]: c for c in CROPS}
    for s in r["strategies"]:
        c = src[s["crop"]]
        assert s["total_cost"] == c["cost_per_acre"] * 7
        assert s["expected_revenue"] == c["expected_revenue"] * 7
        assert s["expected_profit"] == s["expected_revenue"] - s["total_cost"]
        assert s["roi_pct"] == round((c["expected_revenue"] - c["cost_per_acre"]) / c["cost_per_acre"] * 100, 1)
        assert s["financials"]["per_acre"]["cost"] == c["cost_per_acre"]       # per-acre block untouched
        assert s["financials"]["whole_farm"]["cost"] == s["total_cost"]


def test_loss_making_crop_has_negative_profit_and_zero_financial_score():
    s = run([mk("Loss", cost=20000, rev=15000)], budget=500000)["strategies"][0]
    assert s["expected_profit"] == -25000 and s["roi_pct"] == -25.0
    assert s["component_scores"]["financial_return"] == 0
    assert any("not positive" in w for w in s["explanation"]["financial_weaknesses"])


def test_ranking_uses_net_profit_and_roi_not_gross_revenue():
    big_rev = mk("BigRevenue", cost=95000, rev=100000)    # revenue 100k but net only 5k (ROI ~5%)
    lean = mk("Lean", cost=20000, rev=60000)              # lower revenue, net 40k, ROI 200%
    r = run([big_rev, lean], budget=1_000_000)
    assert crop(r, "BigRevenue")["expected_revenue"] > crop(r, "Lean")["expected_revenue"]
    assert r["recommended_crop"] == "Lean"


def test_zero_cultivation_cost_is_handled_safely():
    free = mk("Free", cost=0, rev=20000)
    fin = compute_financials(free, 5)
    assert fin["valid"] and fin["roi_pct"] is None and fin["whole_farm"]["net_profit"] == 100000
    r = run([free], budget=0)                        # costs nothing, so even budget 0 passes
    s = r["strategies"][0]
    assert s["feasible"] and s["total_cost"] == 0 and s["roi_pct"] is None
    assert 0 <= s["score"] <= 100 and not math.isnan(s["score"])
    assert any("ROI is undefined" in w for w in s["explanation"]["financial_weaknesses"])
    assert s["constraint_details"]["land"]["status"] == "pass"


def test_invalid_financial_data_is_never_recommended_and_does_not_crash():
    bad = [mk("NoneCost", cost=None), mk("StrCost", cost="abc"), mk("NegCost", cost=-5),
           mk("NanRev", rev=float("nan")), mk("NegRev", rev=-1), {**mk("NoCost"), "cost_per_acre": None}]
    good = mk("Good", cost=10000, rev=30000)
    r = run(bad + [good])
    assert r["recommended_crop"] == "Good"
    for name in ("NoneCost", "StrCost", "NegCost", "NanRev", "NegRev"):
        s = crop(r, name)
        assert s["feasible"] is False and s["eligible_for_primary"] is False, name
        assert s["total_cost"] is None and s["expected_profit"] is None and s["roi_pct"] is None
        assert s["financials"]["valid"] is False and s["issues"]
        assert s["score"] >= 0
    assert crop(r, "Good")["rank"] == 1


def test_missing_requirement_fields_use_safe_documented_fallbacks():
    c = {"name": "Sparse", "cost_per_acre": 1000, "expected_revenue": 3000,
         "suitability_score": 50, "risk_score": 10}          # no water/labour/machinery fields
    low = run([c], **{**RICH, "water_availability": "Low", "labour_availability": "Low"})
    s = low["strategies"][0]
    assert s["constraints"]["water"] == "Fail" and s["constraints"]["labour"] == "Fail"   # assumed strictest
    assert s["constraint_details"]["water"].get("assumed") is True
    assert s["constraints"]["machinery"] == "Pass"                                         # assumed "Low" need
    assert s["strategy"] == "Sparse Cultivation"


# ------------------------------------------------------------ scoring
def test_default_weights_sum_to_one_and_are_echoed():
    assert abs(sum(DEFAULT_WEIGHTS.values()) - 1.0) < 1e-9
    r = run()
    assert r["scoring"]["weights"] == DEFAULT_WEIGHTS and r["scoring"]["formula"]


def test_scores_normalised_0_to_100_and_overall_is_weighted_sum():
    for overrides in ({}, RICH, {"budget": 0}, {"risk_preference": "Low"}):
        for s in run(**overrides)["strategies"]:
            cs = s["component_scores"]
            assert set(cs) == {"suitability", "feasibility", "financial_return", "risk_compatibility"}
            assert all(0 <= v <= 100 for v in cs.values()) and 0 <= s["score"] <= 100
            expected = (0.25 * cs["suitability"] + 0.25 * cs["feasibility"]
                        + 0.30 * cs["financial_return"] + 0.20 * cs["risk_compatibility"])
            assert abs(expected - s["score"]) < 0.3          # component scores are rounded to 1 dp
            assert s["expected_return_score"] == cs["financial_return"]


def test_configurable_weights_change_ranking():
    only_fin = {"suitability": 0, "feasibility": 0, "financial": 1.0, "risk": 0}
    only_risk = {"suitability": 0, "feasibility": 0, "financial": 0, "risk": 1.0}
    assert run(weights=only_fin, **RICH)["recommended_crop"] == "Sugarcane"   # highest net profit/acre
    assert run(weights=only_risk, **RICH)["recommended_crop"] == "Mustard"    # lowest risk
    assert run(weights=only_fin, **RICH)["scoring"]["weights"] == only_fin


def test_invalid_weights_rejected():
    assert raises_value_error(lambda: run(weights={"suitability": 0.5, "feasibility": 0.5, "financial": 0.5, "risk": 0.5}))
    assert raises_value_error(lambda: run(weights={"suitability": 1.0}))
    assert raises_value_error(lambda: run(weights={"suitability": -0.5, "feasibility": 0.5, "financial": 0.5, "risk": 0.5}))


def test_invalid_farmer_input_rejected_by_engine():
    assert raises_value_error(lambda: run(land_area_acres=0))
    assert raises_value_error(lambda: run(budget=-1))
    assert raises_value_error(lambda: run(land_area_acres=float("nan")))


def test_engine_is_deterministic():
    assert run() == run()


# ------------------------------------------------------------ explanations
def test_explanation_structure_for_feasible_and_infeasible_crops():
    r = run()
    for s in r["strategies"]:
        e = s["explanation"]
        assert set(e) == {"score_breakdown", "resources_sufficient", "constraints_not_satisfied",
                          "financial_strengths", "financial_weaknesses", "risk_observations",
                          "ranking_reasons", "what_would_make_it_feasible"}
        assert len(e["score_breakdown"]) == 4 and e["ranking_reasons"] and e["risk_observations"]
        assert abs(sum(b["weight"] for b in e["score_breakdown"]) - 1.0) < 1e-9
        assert abs(sum(b["contribution"] for b in e["score_breakdown"]) - s["score"]) < 0.3
        assert len(e["constraints_not_satisfied"]) >= len(s["issues"])
        if s["feasible"]:
            assert e["resources_sufficient"] and e["what_would_make_it_feasible"] == []
        else:
            assert e["what_would_make_it_feasible"] and "Not eligible" in e["ranking_reasons"][0]


def test_explanations_reflect_actual_numbers():
    r = run()
    top = r["strategies"][0]
    assert "Highest overall score (79.8)" in top["explanation"]["ranking_reasons"][0]
    assert "Wheat (79.0)" in top["explanation"]["ranking_reasons"][1]
    rice = crop(r, "Rice")
    assert any("₹125,000" in m for m in rice["explanation"]["constraints_not_satisfied"])
    assert any("High water" in m for m in rice["explanation"]["what_would_make_it_feasible"])
    assert top["reason"] and "reference estimates" in top["reason"]
    assert r["disclaimer"] and "not guaranteed" in r["disclaimer"]
