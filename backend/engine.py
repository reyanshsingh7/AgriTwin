"""
AgriTwin decision engine (Stage 1) -- the SINGLE source of truth for feasibility,
financials, scoring and ranking. The frontend only displays what this module returns.
Everything here is deterministic arithmetic over crops.json and the farmer's inputs:
no machine learning, no yield prediction, no LLM.

Units (important):
  crops.json  cost_per_acre / expected_revenue   -> rupees PER ACRE
  engine "per_acre"    block                     -> rupees per acre (straight from crops.json)
  engine "whole_farm"  block, total_cost,
  expected_revenue, expected_profit              -> rupees for the WHOLE farm
                                                    (per-acre value x land_area_acres)
  ROI is a percentage and is the same per acre and for the whole farm.

Pipeline for every crop
  1. Hard-constraint checks   budget / water / labour / machinery   (+ informational land check)
  2. Financials               cost, revenue, net profit, ROI
  3. Four 0-100 component scores
       suitability, feasibility, financial return, risk compatibility
  4. Weighted overall score   (weights are configurable, see DEFAULT_WEIGHTS)
  5. Ranking                  feasible crops first, infeasible crops are alternatives only
  6. Deterministic explanations built from the numbers above
"""
import math

# --------------------------------------------------------------------------- scales
# Ordinal scales: a farmer can satisfy a crop if their level >= the crop's need.
LEVELS = {"Low": 1, "Medium": 2, "High": 3}
LEVEL_NAMES = {1: "Low", 2: "Medium", 3: "High"}
# Farmer machinery -> level. "None" = hand tools only, so it only satisfies crops
# whose machinery_requirement is "Low".
MACHINERY_LEVELS = {"None": 1, "Limited": 2, "Available": 3}

# --------------------------------------------------------------------------- scoring config
# Overall = sum(weight x component score). Must sum to 1.0. See README for the reasoning.
DEFAULT_WEIGHTS = {
    "suitability": 0.25,   # unchanged from the original engine
    "feasibility": 0.25,   # was 0.40 but binary; hard failures are now enforced by a gate
    "financial": 0.30,     # was 0.25 revenue-only; now net profit + ROI
    "risk": 0.20,          # was a subtractive 5-25% penalty; now a positive compatibility score
}
COMPONENTS = ("suitability", "feasibility", "financial", "risk")
COMPONENT_LABELS = {
    "suitability": "crop suitability",
    "feasibility": "resource feasibility",
    "financial": "financial return",
    "risk": "risk compatibility",
}

# Financial return = 60% net-profit-per-acre score + 40% ROI score (each 0-100).
FINANCIAL_SUBWEIGHTS = {"net_profit": 0.6, "roi": 0.4}
# Reference caps that map to a sub-score of 100 (values above are clipped). They equal the
# best values in the shipped crops.json (Sugarcane net profit/acre, Mustard ROI).
NET_PROFIT_REF_PER_ACRE = 60000.0
ROI_REF_PCT = 250.0

# Risk compatibility = 100 - crop_risk_score x sensitivity, clipped to 0-100.
# Sensitivities reuse the ratios of the original penalty weights (25% : 10% : 5%).
RISK_SENSITIVITY = {"Low": 2.5, "Medium": 1.0, "High": 0.5}
# Crop risk bands (same cut-offs the frontend already uses for its risk meter)
RISK_HIGH_AT, RISK_MEDIUM_AT = 40, 20

# Resource feasibility sub-scores (0-100 per constraint)
TIGHT_SCORE = 90            # requirement met but with no spare capacity
FAIL_SCORE_MAX = 60         # a failed constraint scores at most 60 x how-much-is-covered
HARD_FAIL_FEASIBILITY_CAP = 50   # any hard failure caps the feasibility component
BUDGET_TIGHT_AT = 0.90      # cost uses >= 90% of the budget -> "tight" (little working-capital reserve)

NO_FEASIBLE_MESSAGE = "No suitable crop currently satisfies all critical farming constraints."
DISCLAIMER = (
    "Costs, revenues and ROI are reference estimates from the crop dataset (per acre, scaled "
    "to your land area). They are not guaranteed outcomes: real results depend on weather, "
    "prices and management."
)
SCORING_FORMULA = (
    "overall = w_suit x suitability + w_feas x feasibility + w_fin x financial + w_risk x risk_compatibility; "
    "financial = 0.6 x min(100, net_profit_per_acre / 60000 x 100) + 0.4 x min(100, ROI% / 250 x 100); "
    "risk_compatibility = max(0, 100 - crop_risk x sensitivity) with sensitivity Low 2.5 / Medium 1.0 / High 0.5; "
    "feasibility = mean of the 4 constraint sub-scores (pass 100, tight 90, fail <= 60), capped at 50 if any hard constraint fails. "
    "A crop that fails any hard constraint is never eligible to be the primary recommendation."
)


# --------------------------------------------------------------------------- helpers
def _num(value):
    """Return value as a finite float, or None if it is missing / non-numeric / NaN / inf."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    return value if math.isfinite(value) else None


def _clamp(x, lo=0.0, hi=100.0):
    return max(lo, min(hi, x))


def _inr(v):
    return f"₹{v:,.0f}"


def _labour_category(person_days_per_acre):
    """Map a crop's numeric labour need to a Low/Medium/High level (1/2/3)."""
    if person_days_per_acre >= 70:
        return 3
    if person_days_per_acre >= 40:
        return 2
    return 1


def validate_weights(weights):
    """Return a clean copy of weights, or raise ValueError if they are unusable."""
    if set(weights) != set(COMPONENTS):
        raise ValueError(f"weights must have exactly these keys: {', '.join(COMPONENTS)}")
    clean = {}
    for k in COMPONENTS:
        v = _num(weights[k])
        if v is None or v < 0:
            raise ValueError(f"weight '{k}' must be a non-negative number")
        clean[k] = v
    if abs(sum(clean.values()) - 1.0) > 1e-6:
        raise ValueError("weights must sum to 1.0")
    return clean


def _risk_band(risk_score):
    return "High" if risk_score >= RISK_HIGH_AT else "Medium" if risk_score >= RISK_MEDIUM_AT else "Low"


# --------------------------------------------------------------------------- financials
def compute_financials(crop, land):
    """
    Per-acre and whole-farm financials straight from the crop dataset.
      net profit = gross revenue - total cultivation cost
      ROI (%)    = net profit / total cultivation cost x 100   (None if cost is 0)
    Missing / negative / non-numeric cost or revenue -> valid=False and no numbers are made up.
    Zero cost is valid, but ROI is undefined (None) instead of dividing by zero.
    """
    cost = _num(crop.get("cost_per_acre"))
    revenue = _num(crop.get("expected_revenue"))
    if cost is None or revenue is None or cost < 0 or revenue < 0:
        return {"valid": False, "per_acre": None, "whole_farm": None, "roi_pct": None,
                "note": "Cost or revenue data for this crop is missing or invalid, so no financial estimate is shown."}

    def block(c, r):
        net = r - c
        return {"cost": round(c, 2), "revenue": round(r, 2), "net_profit": round(net, 2),
                "roi_pct": round(net / c * 100, 1) if c > 0 else None}

    per_acre = block(cost, revenue)
    whole = block(cost * land, revenue * land)
    note = DISCLAIMER
    if cost == 0:
        note = "Cultivation cost in the dataset is 0, so ROI is undefined and is not used. " + DISCLAIMER
    return {"valid": True, "per_acre": per_acre, "whole_farm": whole,
            "roi_pct": per_acre["roi_pct"], "note": note}


def financial_score(fin):
    """0-100. Net profit per acre (60%) and ROI (40%); only net profit if ROI is undefined."""
    if not fin["valid"]:
        return 0.0
    net_s = _clamp(fin["per_acre"]["net_profit"] / NET_PROFIT_REF_PER_ACRE * 100)
    if fin["roi_pct"] is None:
        return net_s
    roi_s = _clamp(fin["roi_pct"] / ROI_REF_PCT * 100)
    return (FINANCIAL_SUBWEIGHTS["net_profit"] * net_s + FINANCIAL_SUBWEIGHTS["roi"] * roi_s)


# --------------------------------------------------------------------------- constraints
def _detail(status, message, required, available, fulfilment, **extra):
    d = {"status": status, "hard": True, "passed": status != "fail", "message": message,
         "required": required, "available": available,
         "fulfilment_pct": round(_clamp(fulfilment), 1)}
    d.update(extra)
    return d


def _check_budget(farmer, crop, land, fin):
    budget = farmer["budget"]
    if not fin["valid"]:
        return _detail("fail", "Cultivation cost data for this crop is missing or invalid, so the budget cannot be checked.",
                       None, _inr(budget), 0.0)
    total = fin["whole_farm"]["cost"]
    if total > budget:
        short = total - budget
        return _detail(
            "fail",
            f"Needs a budget of {_inr(total)} for {land:g} acres but only {_inr(budget)} is available.",
            _inr(total), _inr(budget), budget / total * 100, shortfall=round(short, 2),
        )
    used = total / budget * 100 if budget > 0 else 0.0
    status = "tight" if budget > 0 and total / budget >= BUDGET_TIGHT_AT else "pass"
    msg = f"Cultivation cost {_inr(total)} fits the {_inr(budget)} budget ({used:.0f}% used)."
    if status == "tight":
        msg += " Very little money is left as a reserve."
    return _detail(status, msg, _inr(total), _inr(budget), 100.0, budget_used_pct=round(used, 1))


def _check_level(kind, farmer_level_name, need, need_name, assumed, issue_msg, ok_msg):
    """Shared logic for water / labour / machinery (ordinal levels)."""
    have = {"water": LEVELS, "labour": LEVELS, "machinery": MACHINERY_LEVELS}[kind].get(farmer_level_name, 0)
    if need > have:
        d = _detail("fail", issue_msg, need_name, farmer_level_name, have / need * 100)
    else:
        # "Low" needs are always comfortably met; equal level means no spare capacity.
        tight = need == have and need > 1
        d = _detail("tight" if tight else "pass",
                    ok_msg + (" No spare capacity." if tight else ""), need_name, farmer_level_name, 100.0)
    if assumed:
        d["message"] += f" (The crop data has no usable {kind} requirement, so the strictest/safest level was assumed.)"
        d["assumed"] = True
    return d


def check_constraints(farmer, crop, land, fin):
    """
    Evaluate one crop against the farmer's resources.
    Returns a dict of detail records. budget/water/labour/machinery are HARD constraints:
    if any fails the crop is infeasible. 'land' is a soft, informational check.
    Status: "pass" | "tight" (met, but no spare capacity) | "fail" (hard failure).
    """
    details = {"budget": _check_budget(farmer, crop, land, fin)}

    # Water
    raw = crop.get("water_requirement")
    assumed = raw not in LEVELS
    need = LEVELS.get(raw, 3)
    details["water"] = _check_level(
        "water", farmer["water_availability"], need, LEVEL_NAMES[need], assumed,
        f"Water requirement is {LEVEL_NAMES[need]} but availability is {farmer['water_availability']}.",
        f"Water requirement ({LEVEL_NAMES[need]}) is covered by your {farmer['water_availability']} water availability.",
    )

    # Labour (crop need is a numeric person-days/acre figure, classed Low/Medium/High)
    days = _num(crop.get("labour_requirement"))
    assumed = days is None or days < 0
    need = 3 if assumed else _labour_category(days)
    d = _check_level(
        "labour", farmer["labour_availability"], need, LEVEL_NAMES[need], assumed,
        f"Labour requirement is too high for the available labour ({farmer['labour_availability']}).",
        f"Labour requirement ({LEVEL_NAMES[need]}) is covered by your {farmer['labour_availability']} labour availability.",
    )
    if not assumed:
        d["person_days_per_acre"] = days
        d["person_days_whole_farm"] = round(days * land, 1)
    details["labour"] = d

    # Machinery (crops without the field are assumed to need none -> "Low")
    raw = crop.get("machinery_requirement")
    assumed = raw is not None and raw not in LEVELS
    need_name = raw if raw in LEVELS else "Low"
    need = LEVELS[need_name]
    d = _check_level(
        "machinery", farmer["machinery_availability"], need, need_name, assumed,
        f"Machinery requirement is {need_name} but machinery availability is {farmer['machinery_availability']}.",
        f"Machinery requirement ({need_name}) is covered by your '{farmer['machinery_availability']}' machinery.",
    )
    if raw is None:
        d["assumed"] = True
    details["machinery"] = d

    # Land (soft / informational): how much of the land the budget can actually cover.
    cost_pa = fin["per_acre"]["cost"] if fin["valid"] else None
    if cost_pa and cost_pa > 0:
        affordable = farmer["budget"] / cost_pa
        if affordable >= land:
            land_d = {"status": "pass", "message": f"The budget covers cultivation of all {land:g} acres."}
        else:
            land_d = {"status": "partial",
                      "message": f"The budget covers about {affordable:.1f} of your {land:g} acres for this crop."}
        land_d.update({"hard": False, "passed": affordable >= land, "required": f"{land:g} acres",
                       "available": f"{min(affordable, land):.1f} acres affordable",
                       "fulfilment_pct": round(_clamp(affordable / land * 100), 1),
                       "affordable_acres": round(affordable, 2)})
    else:
        land_d = {"status": "pass", "hard": False, "passed": True, "required": f"{land:g} acres",
                  "available": "n/a", "fulfilment_pct": 100.0,
                  "message": "No cultivation cost recorded for this crop, so land coverage by budget cannot be assessed."}
    details["land"] = land_d
    return details


HARD_KEYS = ("budget", "water", "labour", "machinery")


def feasibility_score(details):
    """0-100: mean of the four hard-constraint sub-scores; capped if any hard constraint fails."""
    subs = []
    for k in HARD_KEYS:
        d = details[k]
        if d["status"] == "pass":
            subs.append(100.0)
        elif d["status"] == "tight":
            subs.append(float(TIGHT_SCORE))
        else:
            subs.append(FAIL_SCORE_MAX * d["fulfilment_pct"] / 100)
    score = sum(subs) / len(subs)
    if any(details[k]["status"] == "fail" for k in HARD_KEYS):
        score = min(score, HARD_FAIL_FEASIBILITY_CAP)
    return score


def check_feasibility(farmer_input, crop):
    """
    Backward-compatible helper (original signature).
    Returns (constraints, issues): constraints -> {"budget": "Pass"/"Fail", ...}; issues -> failure messages.
    """
    land = farmer_input["land_area_acres"]
    details = check_constraints(farmer_input, crop, land, compute_financials(crop, land))
    constraints = {k: ("Fail" if details[k]["status"] == "fail" else "Pass") for k in HARD_KEYS}
    issues = [details[k]["message"] for k in HARD_KEYS if details[k]["status"] == "fail"]
    return constraints, issues


# --------------------------------------------------------------------------- risk
def risk_compatibility(crop_risk, preference):
    sens = RISK_SENSITIVITY.get(preference, RISK_SENSITIVITY["Medium"])
    return _clamp(100 - crop_risk * sens)


# --------------------------------------------------------------------------- per-crop evaluation
def _evaluate_one(farmer, crop, weights):
    land = farmer["land_area_acres"]
    fin = compute_financials(crop, land)
    details = check_constraints(farmer, crop, land, fin)
    constraints = {k: ("Fail" if details[k]["status"] == "fail" else "Pass") for k in HARD_KEYS}
    issues = [details[k]["message"] for k in HARD_KEYS if details[k]["status"] == "fail"]
    feasible = not issues

    suit = _clamp(_num(crop.get("suitability_score")) or 0.0)
    crop_risk = _clamp(_num(crop.get("risk_score")) if _num(crop.get("risk_score")) is not None else 100.0)
    scores = {
        "suitability": suit,
        "feasibility": feasibility_score(details),
        "financial": financial_score(fin),
        "risk": risk_compatibility(crop_risk, farmer["risk_preference"]),
    }
    overall = _clamp(sum(weights[k] * scores[k] for k in COMPONENTS))

    whole = fin["whole_farm"]
    return {
        "strategy": crop.get("strategy", f"{crop['name']} Cultivation"),
        "crop": crop["name"],
        "feasible": feasible,
        "eligible_for_primary": feasible and fin["valid"],
        "category": "feasible" if feasible else "alternative_infeasible",
        "score": round(overall, 1),
        "total_cost": whole["cost"] if fin["valid"] else None,
        "expected_revenue": whole["revenue"] if fin["valid"] else None,
        "expected_profit": whole["net_profit"] if fin["valid"] else None,
        "roi_pct": fin["roi_pct"],
        "risk_score": round(crop_risk, 1),
        "risk_level": _risk_band(crop_risk),
        "suitability_score": round(suit, 1),
        "expected_return_score": round(scores["financial"], 1),  # legacy name for the financial score
        "component_scores": {
            "suitability": round(scores["suitability"], 1),
            "feasibility": round(scores["feasibility"], 1),
            "financial_return": round(scores["financial"], 1),
            "risk_compatibility": round(scores["risk"], 1),
        },
        "financials": fin,
        "constraints": constraints,
        "constraint_details": details,
        "issues": issues,
        # internal (stripped before returning): unrounded numbers for exact ranking & explanations
        "_scores": scores,
        "_crop": crop,
    }


# --------------------------------------------------------------------------- explanations
def _what_would_change(item, farmer):
    """Concrete, data-based changes that would clear each failed hard constraint."""
    land = farmer["land_area_acres"]
    out = []
    d = item["constraint_details"]
    if d["budget"]["status"] == "fail":
        if item["financials"]["valid"]:
            cost_pa = item["financials"]["per_acre"]["cost"]
            out.append(
                f"Budget: raise it by {_inr(d['budget']['shortfall'])} (to {_inr(item['total_cost'])}), "
                f"or grow it on about {farmer['budget'] / cost_pa:.1f} of your {land:g} acres."
                if cost_pa > 0 else "Budget: fix the crop's cost data."
            )
        else:
            out.append("Budget: correct the crop's cost data in crops.json.")
    for k, noun in (("water", "water availability"), ("labour", "labour availability"),
                    ("machinery", "machinery availability")):
        if d[k]["status"] == "fail":
            if k == "machinery":
                out.append(f"Machinery: arrange access to at least '{d[k]['required']}'-level machinery "
                           f"(currently '{d[k]['available']}').")
            else:
                out.append(f"{k.capitalize()}: secure at least {d[k]['required']} {noun} (currently {d[k]['available']}).")
    return out


def _explain(item, farmer, ctx, weights):
    """Build the structured explanation for one crop from already-computed numbers."""
    d = item["constraint_details"]
    fin = item["financials"]
    sc = item["_scores"]
    pref = farmer["risk_preference"]

    breakdown = []
    how = {
        "suitability": "Crop suitability rating from the dataset (0-100).",
        "feasibility": "Mean of budget/water/labour/machinery sub-scores (pass 100, tight 90, fail <= 60); capped at 50 if any hard constraint fails.",
        "financial": "60% net profit per acre (vs ₹60,000 reference) + 40% ROI (vs 250% reference).",
        "risk": f"100 - crop risk ({item['risk_score']:g}) x {RISK_SENSITIVITY.get(pref, 1.0):g} for a '{pref}' risk preference.",
    }
    for k in COMPONENTS:
        breakdown.append({
            "component": COMPONENT_LABELS[k], "key": k,
            "score": round(sc[k], 1), "weight": weights[k],
            "contribution": round(sc[k] * weights[k], 1), "how": how[k],
        })

    sufficient, not_met = [], []
    for k in HARD_KEYS:
        (not_met if d[k]["status"] == "fail" else sufficient).append(d[k]["message"])
    if d["land"]["status"] == "partial":
        not_met.append(d["land"]["message"])
    elif d["land"]["passed"] and "cannot be assessed" not in d["land"]["message"]:
        sufficient.append(d["land"]["message"])

    strengths, weaknesses = [], []
    if not fin["valid"]:
        weaknesses.append(fin["note"])
    else:
        pa = fin["per_acre"]
        wf = fin["whole_farm"]
        if pa["net_profit"] <= 0:
            weaknesses.append(f"Expected net profit is {_inr(wf['net_profit'])} (not positive).")
        else:
            if pa["net_profit"] >= ctx["max_net"] - 1e-9:
                strengths.append(f"Highest net profit per acre of all crops evaluated ({_inr(pa['net_profit'])}).")
            elif pa["net_profit"] >= ctx["avg_net"]:
                strengths.append(f"Net profit per acre ({_inr(pa['net_profit'])}) is above the average of all crops ({_inr(ctx['avg_net'])}).")
            else:
                weaknesses.append(f"Net profit per acre ({_inr(pa['net_profit'])}) is below the average of all crops ({_inr(ctx['avg_net'])}).")
        if pa["roi_pct"] is None:
            weaknesses.append("ROI is undefined because the dataset records zero cultivation cost.")
        elif ctx["max_roi"] is not None and pa["roi_pct"] >= ctx["max_roi"] - 1e-9:
            strengths.append(f"Highest ROI of all crops evaluated ({pa['roi_pct']:.0f}%).")
        elif ctx["avg_roi"] is not None and pa["roi_pct"] >= ctx["avg_roi"]:
            strengths.append(f"ROI of {pa['roi_pct']:.0f}% is above the all-crop average ({ctx['avg_roi']:.0f}%).")
        elif ctx["avg_roi"] is not None:
            weaknesses.append(f"ROI of {pa['roi_pct']:.0f}% is below the all-crop average ({ctx['avg_roi']:.0f}%).")
        strengths_line = (f"Whole farm ({farmer['land_area_acres']:g} acres): cost {_inr(wf['cost'])}, revenue {_inr(wf['revenue'])}, "
                          f"net profit {_inr(wf['net_profit'])}.")
        (strengths if wf["net_profit"] > 0 else weaknesses).append(strengths_line)

    risk_obs = [f"Crop risk is {item['risk_score']:g}/100 ({item['risk_level']}); for a '{pref}' risk preference its "
                f"risk-compatibility score is {sc['risk']:.0f}/100."]
    if pref == "Low" and item["risk_level"] == "High":
        risk_obs.append("This is a high-risk crop and conflicts with your low risk preference.")
    elif pref == "Low" and item["risk_level"] == "Medium":
        risk_obs.append("Medium-risk crop: acceptable but not the safest choice for a low risk preference.")
    elif pref == "High" and item["risk_level"] == "Low":
        risk_obs.append("Low-risk crop: within your risk tolerance, but it earns no extra credit for being safer than you require.")
    else:
        risk_obs.append("The crop's risk level is consistent with your risk preference.")

    return {
        "score_breakdown": breakdown,
        "resources_sufficient": sufficient,
        "constraints_not_satisfied": not_met,
        "financial_strengths": strengths,
        "financial_weaknesses": weaknesses,
        "risk_observations": risk_obs,
        "ranking_reasons": [],            # filled after ranking
        "what_would_make_it_feasible": _what_would_change(item, farmer) if not item["feasible"] else [],
    }


def _ranking_reasons(item, group, position, weights):
    """Deterministic reasons for the item's place in the ranking (group = same-feasibility list)."""
    reasons = []
    k_all = {k: weights[k] * item["_scores"][k] for k in COMPONENTS}
    if item["feasible"]:
        n = len(group)
        if position == 0:
            reasons.append(f"Highest overall score ({item['score']:.1f}) among the {n} feasible crop(s); it passes every hard constraint.")
            if n > 1:
                nxt = group[1]
                gaps = {k: k_all[k] - weights[k] * nxt["_scores"][k] for k in COMPONENTS}
                lead = max(COMPONENTS, key=lambda k: (gaps[k], -COMPONENTS.index(k)))
                reasons.append(f"It leads {nxt['crop']} ({nxt['score']:.1f}) mainly on {COMPONENT_LABELS[lead]} "
                               f"({gaps[lead]:+.1f} weighted points).")
        else:
            top = group[0]
            gaps = {k: k_all[k] - weights[k] * top["_scores"][k] for k in COMPONENTS}
            weak = min(COMPONENTS, key=lambda k: (gaps[k], COMPONENTS.index(k)))
            reasons.append(f"Feasible, but ranked #{position + 1} of {n}: its score ({item['score']:.1f}) is "
                           f"{top['score'] - item['score']:.1f} points behind {top['crop']} ({top['score']:.1f}).")
            reasons.append(f"Biggest gap to the top pick is {COMPONENT_LABELS[weak]} ({gaps[weak]:+.1f} weighted points).")
    else:
        failed = [k for k in HARD_KEYS if item["constraint_details"][k]["status"] == "fail"]
        reasons.append("Not eligible as the primary recommendation: it fails hard constraint(s): " + ", ".join(failed) + ".")
        reasons.append(f"Shown as an alternative and ordered by overall score ({item['score']:.1f}); "
                       f"the feasibility component is capped because of the failed constraint(s).")
        if position == 0:
            reasons.append("It is the closest alternative to becoming feasible.")
    return reasons


# --------------------------------------------------------------------------- main evaluation
def evaluate_crops(farmer_input, crops_db, weights=None):
    """Evaluate every crop and return ALL strategies ranked best-first (feasible crops always first)."""
    _check_farmer(farmer_input)
    weights = validate_weights(weights if weights is not None else DEFAULT_WEIGHTS)

    items = [_evaluate_one(farmer_input, crop, weights) for crop in crops_db]

    # Context for relative financial statements (only crops with valid data)
    valid = [i for i in items if i["financials"]["valid"]]
    nets = [i["financials"]["per_acre"]["net_profit"] for i in valid]
    rois = [i["financials"]["roi_pct"] for i in valid if i["financials"]["roi_pct"] is not None]
    ctx = {"max_net": max(nets) if nets else 0.0, "avg_net": sum(nets) / len(nets) if nets else 0.0,
           "max_roi": max(rois) if rois else None, "avg_roi": sum(rois) / len(rois) if rois else None}

    # Rank: eligible (feasible) crops first, then alternatives. Ties broken deterministically.
    def key(i):
        net = i["expected_profit"] if i["expected_profit"] is not None else float("-inf")
        return (not i["eligible_for_primary"], -i["score"], -net, i["crop"])

    items.sort(key=key)
    eligible = [i for i in items if i["eligible_for_primary"]]
    others = [i for i in items if not i["eligible_for_primary"]]
    for i in items:
        i["feasible"] = i["eligible_for_primary"]   # invalid-data crops are never reported as feasible
        i["category"] = "feasible" if i["feasible"] else "alternative_infeasible"
    for group in (eligible, others):
        for pos, i in enumerate(group):
            i["group_rank"] = pos + 1
            i["explanation"] = _explain(i, farmer_input, ctx, weights)
            i["explanation"]["ranking_reasons"] = _ranking_reasons(i, group, pos, weights)
            if not i["financials"]["valid"] and not i["issues"]:
                i["issues"] = ["Crop cost/revenue data is missing or invalid."]
            i["reason"] = _reason_text(i, farmer_input)
    for rank, i in enumerate(items, start=1):
        i["rank"] = rank
        del i["_scores"], i["_crop"]
    if items and items[0]["feasible"]:
        items[0]["category"] = "recommended"
    return items


def _reason_text(item, farmer):
    if item["feasible"]:
        wf = item["financials"]["whole_farm"]
        roi = f"{item['roi_pct']:.0f}%" if item["roi_pct"] is not None else "n/a"
        return (
            f"{item['crop']} fits your budget, water, labour and machinery. "
            f"Estimated cost {_inr(wf['cost'])} (budget {_inr(farmer['budget'])}), "
            f"expected revenue {_inr(wf['revenue'])}, expected net profit {_inr(wf['net_profit'])} (ROI {roi}), "
            f"risk {item['risk_score']:g}/100. These are reference estimates, not guaranteed."
        )
    return f"{item['crop']} is not feasible: " + " ".join(item["issues"])


def _check_farmer(f):
    land, budget = _num(f.get("land_area_acres")), _num(f.get("budget"))
    if land is None or land <= 0:
        raise ValueError("land_area_acres must be a number greater than 0")
    if budget is None or budget < 0:
        raise ValueError("budget must be a number >= 0")


def analyze(farmer_input, crops_db, weights=None):
    """Full API response payload."""
    w = validate_weights(weights if weights is not None else DEFAULT_WEIGHTS)
    strategies = evaluate_crops(farmer_input, crops_db, w)
    best = strategies[0] if strategies and strategies[0]["feasible"] else None
    feasible_list = [s for s in strategies if s["feasible"]]
    infeasible_list = [s for s in strategies if not s["feasible"]]

    if best:
        status = "Feasible"
        message = best["reason"]
        alternatives = []
    else:
        status = "No feasible strategy"
        message = NO_FEASIBLE_MESSAGE
        alternatives = [
            {"crop": s["crop"], "strategy": s["strategy"], "score": s["score"],
             "failed_constraints": s["issues"],
             "required_changes": s["explanation"]["what_would_make_it_feasible"]}
            for s in infeasible_list[:3]
        ]

    return {
        "recommended_strategy": best["strategy"] if best else None,
        "recommended_crop": best["crop"] if best else None,
        "overall_score": best["score"] if best else None,
        "feasibility_status": status,
        "message": message,
        "inputs": dict(farmer_input),
        "strategies": strategies,
        "feasible_ranking": [s["crop"] for s in feasible_list],
        "infeasible_ranking": [s["crop"] for s in infeasible_list],
        "best_alternatives": alternatives,
        "scoring": {"weights": w, "formula": SCORING_FORMULA},
        "disclaimer": DISCLAIMER,
    }
