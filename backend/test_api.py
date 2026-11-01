"""API tests -- need: pip install -r requirements.txt  (fastapi + httpx)."""
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

VALID = {
    "land_area_acres": 5,
    "budget": 80000,
    "water_availability": "Medium",
    "labour_availability": "Medium",
    "machinery_availability": "Available",
    "risk_preference": "Medium",
}


def post(**overrides):
    return client.post("/api/analyze", json={**VALID, **overrides})


def test_docs_and_openapi_available():
    assert client.get("/docs").status_code == 200
    assert "/api/analyze" in client.get("/openapi.json").json()["paths"]


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_valid_request_contract():
    r = post()
    assert r.status_code == 200
    body = r.json()
    for key in ("recommended_strategy", "recommended_crop", "overall_score",
                "feasibility_status", "message", "inputs", "strategies"):
        assert key in body
    assert body["recommended_crop"] == "Mustard"   # Stage 1 scoring (was Wheat / 70.5)
    assert body["overall_score"] == 79.8
    first = body["strategies"][0]
    assert first["total_cost"] == 40000 and first["expected_revenue"] == 140000
    assert first["constraints"] == {
        "budget": "Pass", "water": "Pass", "labour": "Pass", "machinery": "Pass"}


def test_case_insensitive_enums_are_accepted():
    r = post(water_availability="medium", machinery_availability=" none ")
    assert r.status_code == 200
    assert r.json()["inputs"]["water_availability"] == "Medium"
    assert r.json()["inputs"]["machinery_availability"] == "None"


def test_zero_budget_is_valid_but_nothing_feasible():
    r = post(budget=0)
    assert r.status_code == 200
    assert r.json()["feasibility_status"] == "No feasible strategy"
    assert r.json()["recommended_crop"] is None


@pytest.mark.parametrize("overrides, field", [
    ({"land_area_acres": 0}, "land_area_acres"),
    ({"land_area_acres": -3}, "land_area_acres"),
    ({"budget": -1}, "budget"),
    ({"water_availability": "Huge"}, "water_availability"),
    ({"labour_availability": "none"}, "labour_availability"),
    ({"machinery_availability": "Some"}, "machinery_availability"),
    ({"risk_preference": "Extreme"}, "risk_preference"),
    ({"land_area_acres": "abc"}, "land_area_acres"),
    ({"budget": None}, "budget"),
])
def test_invalid_inputs_rejected_with_readable_error(overrides, field):
    r = post(**overrides)
    assert r.status_code == 422
    body = r.json()
    assert body["error"] == "Invalid input"
    assert any(d["field"] == field and d["message"] for d in body["details"])


def test_missing_fields_reported():
    r = client.post("/api/analyze", json={})
    assert r.status_code == 422
    fields = {d["field"] for d in r.json()["details"]}
    assert fields == set(VALID)


def test_malformed_json_gives_readable_error():
    r = client.post("/api/analyze", content="{not json",
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 422
    assert r.json()["error"] == "Invalid input"


def test_cors_allows_vite_dev_server():
    r = client.options("/api/analyze", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"


# ------------------------------------------------------------ Stage 1 additions
def test_stage1_fields_are_exposed_and_backward_compatible():
    body = post().json()
    for key in ("feasible_ranking", "infeasible_ranking", "best_alternatives", "scoring", "disclaimer"):
        assert key in body
    assert body["scoring"]["weights"] and abs(sum(body["scoring"]["weights"].values()) - 1.0) < 1e-9
    first = body["strategies"][0]
    for key in ("roi_pct", "component_scores", "financials", "constraint_details", "explanation",
                "eligible_for_primary", "risk_level", "category", "group_rank"):
        assert key in first
    # Mustard: ₹8,000 cost / ₹28,000 revenue per acre, 5 acres
    assert first["roi_pct"] == 250.0
    assert first["financials"]["per_acre"]["net_profit"] == 20000
    assert first["financials"]["whole_farm"]["net_profit"] == 100000
    assert first["constraint_details"]["budget"]["status"] == "pass"
    assert first["explanation"]["ranking_reasons"]
    # original fields keep their shape
    assert set(first["constraints"]) == {"budget", "water", "labour", "machinery"}
    assert all(v in ("Pass", "Fail") for v in first["constraints"].values())


def test_no_feasible_crop_message_through_api():
    r = post(budget=0, water_availability="Low", labour_availability="Low", machinery_availability="None")
    body = r.json()
    assert r.status_code == 200
    assert body["message"] == "No suitable crop currently satisfies all critical farming constraints."
    assert body["recommended_crop"] is None and body["overall_score"] is None
    assert body["best_alternatives"] and body["best_alternatives"][0]["required_changes"]
    assert all(not s["feasible"] for s in body["strategies"])


def test_infeasible_crop_is_never_the_recommendation():
    body = post(budget=50000).json()
    assert body["recommended_crop"] == "Mustard"
    for s in body["strategies"]:
        if s["crop"] != "Mustard":
            assert s["feasible"] is False and s["eligible_for_primary"] is False


def test_scoring_endpoint_exposes_weights_and_formula():
    r = client.get("/api/scoring")
    assert r.status_code == 200
    body = r.json()
    assert abs(sum(body["weights"].values()) - 1.0) < 1e-9 and body["formula"]


def test_cors_blocks_unlisted_origin():
    r = client.options("/api/analyze", headers={
        "Origin": "https://evil.example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert "access-control-allow-origin" not in r.headers
