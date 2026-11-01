import json
import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import cors_origins
from engine import COMPONENT_LABELS, DEFAULT_WEIGHTS, SCORING_FORMULA, analyze
from schemas import AnalysisResponse, ErrorResponse, FarmerInput

logger = logging.getLogger("agritwin")

app = FastAPI(
    title="AgriTwin API",
    version="1.1.0",
    description=(
        "Constraint-aware farm decision support. Given a farmer's land, budget, water, "
        "labour, machinery and risk preference, returns which crop strategies are feasible "
        "and how they rank. All decision logic lives in the backend (engine.py)."
    ),
)

# CORS: always allow the local React/Vite dev server (any localhost / 127.0.0.1 port).
# No cookies or auth are used, so credentials stay off.
# For a deployed frontend, set CORS_ORIGINS to its URL(s), comma-separated
# (e.g. CORS_ORIGINS=https://agritwin.vercel.app). See README "Deployment".
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the crop database once at startup
CROPS_PATH = Path(__file__).parent / "crops.json"
try:
    CROPS_DB = json.loads(CROPS_PATH.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError) as exc:
    raise RuntimeError(f"Could not load crop database at {CROPS_PATH}: {exc}") from exc


# ------------------------------------------------------------------ errors
@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Turn Pydantic's verbose errors into {"error": ..., "details": [{field, message}]}."""
    details = []
    for err in exc.errors():
        loc = [str(part) for part in err.get("loc", ()) if part != "body"]
        message = str(err.get("msg", "Invalid value")).removeprefix("Value error, ")
        details.append({"field": ".".join(loc) or "body", "message": message})
    return JSONResponse(status_code=422, content={"error": "Invalid input", "details": details})


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "details": []},
    )


# ------------------------------------------------------------------ routes
@app.post(
    "/api/analyze",
    response_model=AnalysisResponse,
    responses={422: {"model": ErrorResponse, "description": "Invalid input"}},
    summary="Analyze a farm and rank feasible crop strategies",
)
def analyze_farm(farmer_input: FarmerInput):
    return analyze(farmer_input.model_dump(), CROPS_DB)


@app.get("/api/scoring", summary="Current scoring weights and formula")
def scoring_config():
    """Transparency endpoint: the weights and formula the engine uses to rank crops."""
    return {"weights": DEFAULT_WEIGHTS, "components": COMPONENT_LABELS, "formula": SCORING_FORMULA}


@app.get("/api/health", summary="Health check")
def health():
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def read_root():
    return {"status": "AgriTwin Backend Running", "docs": "/docs"}
