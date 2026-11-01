"""Request / response models. These define the API contract shown in /docs."""
from typing import Any, Dict, List, Literal, Optional, get_args

from pydantic import BaseModel, ConfigDict, Field, field_validator

Level = Literal["Low", "Medium", "High"]
Machinery = Literal["Available", "Limited", "None"]
CheckResult = Literal["Pass", "Fail"]


def _canonical(value: Any, allowed: tuple) -> Any:
    """Accept 'medium' / ' MEDIUM ' as 'Medium'. Anything else is left for Literal to reject."""
    if isinstance(value, str):
        for option in allowed:
            if value.strip().lower() == option.lower():
                return option
    return value


# ---------------------------------------------------------------- request
class FarmerInput(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "land_area_acres": 5,
                "budget": 80000,
                "water_availability": "Medium",
                "labour_availability": "Medium",
                "machinery_availability": "Available",
                "risk_preference": "Medium",
            }
        }
    )

    land_area_acres: float = Field(..., gt=0, allow_inf_nan=False, description="Farm size in acres (> 0)")
    budget: float = Field(..., ge=0, allow_inf_nan=False, description="Total budget in rupees (>= 0)")
    water_availability: Level = Field(..., description="Low | Medium | High")
    labour_availability: Level = Field(..., description="Low | Medium | High")
    machinery_availability: Machinery = Field(..., description="Available | Limited | None")
    risk_preference: Level = Field(..., description="Low | Medium | High")

    @field_validator("water_availability", "labour_availability", "risk_preference", mode="before")
    @classmethod
    def _normalise_level(cls, v):
        return _canonical(v, get_args(Level))

    @field_validator("machinery_availability", mode="before")
    @classmethod
    def _normalise_machinery(cls, v):
        return _canonical(v, get_args(Machinery))


# --------------------------------------------------------------- response
# Stage 1: every field below that is marked "NEW" was added on top of the original response.
# All original fields keep their names, types and meaning, so existing clients keep working.
class ConstraintResults(BaseModel):
    budget: CheckResult
    water: CheckResult
    labour: CheckResult
    machinery: CheckResult


class ConstraintDetail(BaseModel):
    """NEW. Detailed result of one resource check."""
    status: Literal["pass", "tight", "fail", "partial"] = Field(
        ..., description="pass | tight (met, no spare capacity) | fail (hard failure) | partial (soft land check)")
    hard: bool = Field(..., description="True if failing it makes the crop infeasible")
    passed: bool
    message: str
    required: Optional[str] = None
    available: Optional[str] = None
    fulfilment_pct: float = Field(..., description="How much of the requirement is covered, 0-100")
    shortfall: Optional[float] = Field(None, description="Budget only: rupees missing")
    budget_used_pct: Optional[float] = None
    person_days_per_acre: Optional[float] = None
    person_days_whole_farm: Optional[float] = None
    affordable_acres: Optional[float] = Field(None, description="Land check only: acres the budget can cover")
    assumed: Optional[bool] = Field(None, description="True if the crop data lacked this requirement and a safe default was used")


class ConstraintDetails(BaseModel):
    budget: ConstraintDetail
    water: ConstraintDetail
    labour: ConstraintDetail
    machinery: ConstraintDetail
    land: ConstraintDetail = Field(..., description="Soft / informational: how much of the land the budget covers")


class ComponentScores(BaseModel):
    suitability: float
    feasibility: float
    financial_return: float
    risk_compatibility: float


class MoneyBlock(BaseModel):
    cost: float
    revenue: float
    net_profit: float
    roi_pct: Optional[float] = Field(None, description="null when cost is 0 (ROI undefined)")


class Financials(BaseModel):
    """NEW. per_acre = values straight from crops.json; whole_farm = per_acre x land_area_acres."""
    valid: bool
    per_acre: Optional[MoneyBlock] = None
    whole_farm: Optional[MoneyBlock] = None
    roi_pct: Optional[float] = None
    note: str = Field(..., description="Reference-estimate disclaimer / data warning")


class ScoreComponentExplanation(BaseModel):
    component: str
    key: str
    score: float
    weight: float
    contribution: float
    how: str


class Explanation(BaseModel):
    """NEW. Deterministic, calculation-based explanation (no LLM)."""
    score_breakdown: List[ScoreComponentExplanation]
    resources_sufficient: List[str]
    constraints_not_satisfied: List[str]
    financial_strengths: List[str]
    financial_weaknesses: List[str]
    risk_observations: List[str]
    ranking_reasons: List[str]
    what_would_make_it_feasible: List[str]


class StrategyResult(BaseModel):
    rank: int
    strategy: str
    crop: str
    feasible: bool
    score: float = Field(..., description="Final score 0-100")
    total_cost: Optional[float] = Field(None, description="Whole-farm cost in rupees (cost_per_acre x acres); null if crop cost data is invalid")
    expected_revenue: Optional[float] = Field(None, description="Whole-farm revenue in rupees (revenue_per_acre x acres)")
    expected_profit: Optional[float] = Field(None, description="Whole-farm net profit = expected_revenue - total_cost")
    risk_score: float = Field(..., description="Crop risk 0-100 (higher = riskier)")
    suitability_score: float
    expected_return_score: float = Field(..., description="Financial return score 0-100 (net profit + ROI based). Name kept for compatibility.")
    constraints: ConstraintResults
    issues: List[str] = Field(..., description="Why the strategy failed (empty if feasible)")
    reason: str
    # ---- NEW in Stage 1 (all optional so older consumers are unaffected)
    eligible_for_primary: Optional[bool] = Field(None, description="False if any hard constraint fails or crop data is invalid")
    category: Optional[Literal["recommended", "feasible", "alternative_infeasible"]] = None
    group_rank: Optional[int] = Field(None, description="Rank within feasible crops, or within infeasible alternatives")
    roi_pct: Optional[float] = Field(None, description="Return on investment %, null if cost is 0 or data invalid")
    risk_level: Optional[Level] = Field(None, description="Crop risk band: Low <20, Medium 20-39, High >=40")
    component_scores: Optional[ComponentScores] = None
    financials: Optional[Financials] = None
    constraint_details: Optional[ConstraintDetails] = None
    explanation: Optional[Explanation] = None


class Alternative(BaseModel):
    crop: str
    strategy: str
    score: float
    failed_constraints: List[str]
    required_changes: List[str]


class ScoringInfo(BaseModel):
    weights: Dict[str, float]
    formula: str


class AnalysisResponse(BaseModel):
    recommended_strategy: Optional[str] = Field(None, description="null if nothing is feasible")
    recommended_crop: Optional[str] = Field(None, description="null if nothing is feasible")
    overall_score: Optional[float] = Field(None, description="Score of the recommended strategy")
    feasibility_status: Literal["Feasible", "No feasible strategy"]
    message: str = Field(..., description="Top-level explanation, ready to display")
    inputs: FarmerInput
    strategies: List[StrategyResult] = Field(..., description="All strategies: feasible first (best first), then infeasible alternatives")
    # ---- NEW in Stage 1
    feasible_ranking: List[str] = Field(default_factory=list, description="Crop names of feasible crops, best first")
    infeasible_ranking: List[str] = Field(default_factory=list, description="Crop names of infeasible alternatives, closest first")
    best_alternatives: List[Alternative] = Field(default_factory=list, description="Only when nothing is feasible: top 3 near-misses and what would fix them")
    scoring: Optional[ScoringInfo] = None
    disclaimer: Optional[str] = None


# ----------------------------------------------------------------- errors
class FieldError(BaseModel):
    field: str
    message: str


class ErrorResponse(BaseModel):
    error: str
    details: List[FieldError]
