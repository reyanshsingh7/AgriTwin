<div align="center">

# 🌱 AgriTwin

**AI-assisted, constraint-aware farm decision support**
Recommends the crop a farmer can *realistically afford and implement*, not just the one that looks best on paper.

![Hackathon](https://img.shields.io/badge/Hackathon-AI%20for%20AgroFoods-2e7d32)
![Stage](https://img.shields.io/badge/Stage-1%20Prototype-orange)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)

<!-- Add after your first push (replace <your-user>/<your-repo>):
[![CI](https://github.com/<your-user>/<your-repo>/actions/workflows/ci.yml/badge.svg)](https://github.com/<your-user>/<your-repo>/actions/workflows/ci.yml)
-->

</div>

> **AI for AgroFoods Hackathon · Stage 1 prototype.**
> Crop data are reference estimates. Results are decision support, not guaranteed outcomes.

<!-- Add your deployed link here: **Live demo:** https://your-app.onrender.com -->

---

## 👥 Team

| Name | Role |
|---|---|
| **Reyansh** | Team Lead |
| Anushka | Team Member |
| Ayush | Team Member |
| Prince | Team Member |
| Arnav | Team Member |
| Pushkar | Team Member |
| Shivansh | Team Member |

## 📑 Contents
[Overview](#-overview) · [Quick start](#-quick-start) · [Project structure](#-project-structure) · [How the engine works](#-how-the-decision-engine-works) · [API](#-api) · [Testing](#-testing) · [Deployment](#-deployment) · [Limitations](#-limitations-and-assumptions)

---

## 🌾 Overview

A farmer enters land area, total budget, water, labour, machinery and risk preference. AgriTwin checks
which crops are **actually feasible** for those resources, calculates profit and ROI, scores each crop on
four factors, and explains the ranking in plain language.

**Key features**
- ✅ **Hard-constraint gate:** a crop that fails budget, water, labour or machinery is never the primary recommendation.
- 💰 **Real financials:** net profit and ROI (per acre and whole farm), not revenue alone.
- ⚖️ **Four transparent scores (0-100):** crop suitability, resource feasibility, financial return, risk compatibility, with configurable weights.
- 🎯 **Risk-aware:** a low-risk-tolerance farmer is not automatically given high-risk crops.
- 🧾 **Explainable:** every crop returns why it scored as it did, what passed or failed, and what would make an infeasible crop feasible.
- 🌐 **English and Hindi** interface.

**Flow:** Farmer inputs → React → `POST /api/analyze` → FastAPI → Decision Engine → JSON → results dashboard.

> The engine is deterministic arithmetic over `backend/crops.json`. There is **no machine learning, yield prediction, weather API or LLM** in this stage.

<!-- Add screenshots: ![Dashboard](docs/dashboard.png) -->

## 🚀 Quick start

**Prerequisites:** Python 3.10+ and Node.js 20.19+ or 22+ (with npm).

**1. Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

**2. Frontend** (in a second terminal)
```bash
cd frontend
npm install
npm run dev
```
Open the URL Vite prints (normally http://localhost:5173). The app calls `http://localhost:8000` by default;
set `VITE_API_BASE_URL` (see `frontend/.env.example`) to change it.

## 📁 Project structure
```
.
├── backend/
│   ├── engine.py            decision engine (feasibility, financials, scoring, ranking, explanations)
│   ├── main.py              FastAPI routes
│   ├── schemas.py           request/response models
│   ├── config.py            environment config (CORS_ORIGINS)
│   ├── crops.json           crop dataset (per-acre values)
│   ├── test_*.py            tests
│   ├── Dockerfile
│   └── requirements.txt / requirements-dev.txt
├── frontend/                React + Vite dashboard
├── .github/workflows/ci.yml backend tests + frontend build
├── render.yaml              Render blueprint (API + static frontend)
├── STAGE_1_CHANGELOG.md     what changed in Stage 1
└── README.md
```

## 🧠 How the Decision Engine works

For every crop: **check constraints → compute financials → score → rank → explain.**

**1. Feasibility.** Budget, water, labour and machinery are *hard constraints*. Each check is `pass`, `tight`
(met with no spare capacity) or `fail`, with a fulfilment % and shortfall. A soft land check shows how many
acres the budget can cover.

| check | rule |
|---|---|
| Budget | `cost_per_acre × acres ≤ budget` (whole farm) |
| Water | farmer level ≥ crop `water_requirement` |
| Labour | farmer level ≥ crop level (person-days/acre: Low < 40, Medium 40-69, High ≥ 70) |
| Machinery | `None` / `Limited` / `Available` (1/2/3) ≥ crop need Low / Medium / High (1/2/3) |

**2. Financials**
```
Net profit = Gross revenue − Total cultivation cost
ROI (%)    = Net profit ÷ Total cultivation cost × 100
```
Zero cost gives ROI `null` (no divide-by-zero). Missing or invalid cost data is flagged and never recommended.

**3. Scoring**
```
overall = 0.25 × suitability + 0.25 × feasibility + 0.30 × financial + 0.20 × risk_compatibility
```

| component | calculation |
|---|---|
| Suitability | `suitability_score` from the dataset |
| Feasibility | mean of the 4 constraint sub-scores (pass 100, tight 90, fail ≤ 60); capped at 50 if any hard constraint fails |
| Financial return | 0.6 × net profit per acre (vs ₹60,000) + 0.4 × ROI (vs 250%), each capped at 100 |
| Risk compatibility | `max(0, 100 − crop_risk × s)`, with s = 2.5 (Low), 1.0 (Medium), 0.5 (High) risk preference |

<details>
<summary><b>Why these weights?</b></summary>

The original engine used suitability 25%, feasibility 40%, return 25% and a 25/10/5% risk penalty.
- **Suitability 0.25:** unchanged.
- **Feasibility 0.40 → 0.25:** it was binary, so every feasible crop got the same +40. Hard failures are now enforced by the eligibility gate, so the score only needs to reward headroom and rank near-misses.
- **Financial 0.25 → 0.30:** it now carries two measures (net profit and ROI) instead of revenue alone.
- **Risk → 0.20:** risk preference is a core input and gets a real, visible share. The old ratio between preferences (25 : 10 : 5) is kept as the sensitivity (2.5 : 1.0 : 0.5).

Weights are a judgement call, not fitted to data. Change `DEFAULT_WEIGHTS` in `backend/engine.py`, or call
`analyze(farmer_input, crops, weights={...})` (four keys, sum to 1.0).
</details>

**4. Ranking.** Feasible crops are ranked by score (ties: higher net profit, then name). Infeasible crops follow
as alternatives. If nothing is feasible, no crop is forced: the response says
*"No suitable crop currently satisfies all critical farming constraints."* and lists the 3 closest
alternatives with the changes that would make them feasible.

**5. Explanations.** Built deterministically from the calculated numbers: score breakdown, sufficient resources,
unmet constraints, financial strengths and weaknesses, risk observations, ranking reasons and required changes.

## 🔌 API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/analyze` | Analyze a farm; returns every crop evaluated and ranked |
| `GET` | `/api/scoring` | Current scoring weights and formula |
| `GET` | `/api/health` | Health check |
| `GET` | `/docs` | Swagger UI |

**Request** (all fields required; enum values are case-insensitive)
```json
{
  "land_area_acres": 5,
  "budget": 80000,
  "water_availability": "Medium",
  "labour_availability": "Medium",
  "machinery_availability": "Available",
  "risk_preference": "Medium"
}
```
| field | rule |
|---|---|
| `land_area_acres` | number > 0 |
| `budget` | number ≥ 0, rupees for the whole farm |
| `water_availability`, `labour_availability`, `risk_preference` | `Low` / `Medium` / `High` |
| `machinery_availability` | `Available` / `Limited` / `None` |

<details>
<summary><b>Response fields and an abridged example</b></summary>

Top level: `recommended_strategy`, `recommended_crop`, `overall_score`, `feasibility_status`, `message`, `inputs`,
`strategies`, `feasible_ranking`, `infeasible_ranking`, `best_alternatives`, `scoring`, `disclaimer`.

Each item in `strategies` (feasible first, then infeasible alternatives) includes: `rank`, `crop`, `feasible`,
`eligible_for_primary`, `score`, `total_cost`, `expected_revenue`, `expected_profit` (whole-farm ₹), `roi_pct`,
`constraints` (Pass/Fail), `constraint_details`, `component_scores`, `financials` (`per_acre` and `whole_farm`),
`risk_level`, `issues`, `reason`, `explanation`.

```json
{
  "recommended_crop": "Mustard",
  "overall_score": 79.8,
  "feasibility_status": "Feasible",
  "feasible_ranking": ["Mustard", "Wheat", "Maize"],
  "infeasible_ranking": ["Sugarcane", "Rice", "Cotton"],
  "strategies": [
    {
      "rank": 5, "crop": "Rice", "feasible": false, "score": 66.2,
      "total_cost": 125000.0, "expected_revenue": 300000.0, "expected_profit": 175000.0, "roi_pct": 140.0,
      "constraints": {"budget": "Fail", "water": "Fail", "labour": "Fail", "machinery": "Pass"},
      "explanation": {
        "what_would_make_it_feasible": [
          "Budget: raise it by ₹45,000 (to ₹125,000), or grow it on about 3.2 of your 5 acres.",
          "Water: secure at least High water availability (currently Medium).",
          "Labour: secure at least High labour availability (currently Medium)."
        ]
      }
    }
  ]
}
```
Invalid input returns `422` with `{"error": "Invalid input", "details": [{"field": "...", "message": "..."}]}`.
</details>

## 🧪 Testing
```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```
Covers low/high budgets, water/labour/machinery limits, risk preferences, large land with insufficient budget,
no feasible crop, multiple feasible crops, zero/invalid costs, ROI and net-profit maths, ranking, hard-constraint
enforcement, configurable weights, explanations, and the HTTP contract. GitHub Actions runs the backend tests and a
frontend build on every push and pull request.

## ☁️ Deployment

**Render (API and frontend from one blueprint)**
1. Push this repo to GitHub.
2. Render dashboard → **New → Blueprint** → select the repo (creates `agritwin-api` and `agritwin-web`).
3. Set `VITE_API_BASE_URL` on `agritwin-web` to the API URL, and `CORS_ORIGINS` on `agritwin-api` to the web URL.
4. Redeploy `agritwin-web` (Vite bakes the API URL in at build time), then open `<api>/api/health` to confirm.

On the free tier the API sleeps when idle, so the first request after a pause can take 30-60 seconds.

**Docker (backend):** `cd backend && docker build -t agritwin-api . && docker run -p 8000:8000 -e CORS_ORIGINS=https://your-frontend agritwin-api`

**Vercel or Netlify (frontend):** root directory `frontend`, build `npm run build`, output `dist`, env `VITE_API_BASE_URL=<API URL>`; add the frontend URL to the API's `CORS_ORIGINS`.

## ⚠️ Limitations and assumptions
- `crops.json` values are reference estimates; real costs, yields and prices vary by region and season.
- Water, labour and machinery are coarse levels. The dataset has no minimum land area and the input has no numeric labour or water capacity, so none was invented.
- The `tight` score (90), the feasibility cap (50) and the financial reference caps (₹60,000, 250%) are modelling choices, not measured values.
- With the default weights several crops can score within 1-2 points of each other (for the default example, Mustard 79.8 vs Wheat 79.0), so treat nearby ranks as similar.
- Missing crop requirements use safe fallbacks: unknown water or labour is treated as the strictest level (flagged `assumed`); missing machinery is treated as `Low`.
- Explanation text is English only; the Hindi UI translates labels, not backend sentences.
- One strategy is one crop: no rotation, intercropping or seasonality.

---
<div align="center">
Built by the AgriTwin team for the <b>AI for AgroFoods Hackathon</b> · Stage 1 prototype
</div>
