# AgriTwin Backend

FastAPI service wrapping the decision engine. **All decision logic lives in `engine.py`**; the frontend only displays the response.

See the project-level `../README.md` for the full API reference, the feasibility logic, the scoring
formula and the reasoning behind the weights.

## Run
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt     # runtime + tests (production uses requirements.txt)
uvicorn main:app --reload --port 8000
```
- Swagger UI: http://localhost:8000/docs
- Health: `GET /api/health` · Scoring config: `GET /api/scoring` · Analyze: `POST /api/analyze`

## Tests
```bash
pytest -q
```
| file | covers |
|---|---|
| `test_engine.py` | original engine tests (constraints, money scaling, boundaries) |
| `test_scenarios.py` | original demo scenarios and invariants |
| `test_decision_engine.py` | **Stage 1**: budgets, water/labour/machinery limits, risk preferences, large land, no-feasible, ROI/net-profit maths, zero/invalid costs, ranking, hard-constraint gate, weights, explanations |
| `test_config.py` | `CORS_ORIGINS` parsing |
| `test_api.py` | HTTP contract, validation errors, CORS, Stage 1 response fields |

## Files
- `engine.py`: constraints, financials, scoring, ranking, explanations
- `schemas.py`: request/response models (new Stage 1 fields are optional → backward compatible)
- `config.py`: environment config (`CORS_ORIGINS`)
- `Dockerfile`: production image · `.env.example`: environment variables
- `main.py`: routes · `crops.json`: crop dataset (per-acre values; unchanged in Stage 1)

## Data assumptions
- `crops.json` `cost_per_acre` and `expected_revenue` are **per acre** and are reference estimates.
- `machinery_requirement` (Low/Medium/High) and `strategy` were added to the dataset earlier as placeholders; edit freely.
- Machinery: `None` = hand tools only (satisfies only `Low`), `Limited` satisfies up to `Medium`, `Available` satisfies all.
- Water, labour and machinery are ordinal: a crop is feasible only if availability ≥ requirement.
- Crop `labour_requirement` is classed Low (<40), Medium (40–69), High (≥70).
