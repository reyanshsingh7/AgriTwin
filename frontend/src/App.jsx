import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/* ------------------------------------------------------------------ copy */
const T = {
  en: {
    tagline: 'Farm decision support',
    heroKicker: 'Make the most of what you have',
    heroTitle: 'Plan your farm with confidence.',
    heroText:
      'Tell us about your land, budget and resources. AgriTwin checks what is actually possible first, then ranks the crops that fit.',
    presetsLabel: 'Quick start',
    presets: { small: 'Small farm', typical: 'Typical farm', large: 'Large farm' },
    formTitle: 'Tell us about your farm',
    formHint: 'Change anything and analyze again to compare.',
    land: 'How much land do you have?',
    landUnit: 'acres',
    budget: 'How much can you invest?',
    budgetHint: 'Total for the whole farm',
    perAcre: 'per acre',
    water: 'How much water is available?',
    labour: 'How many workers can you get?',
    machinery: 'What machinery do you have?',
    risk: 'How much risk are you comfortable with?',
    riskHelp: {
      Low: 'Play safe — steady crops',
      Medium: 'Balanced',
      High: 'Willing to gamble for higher returns',
    },
    levels: { Low: 'Low', Medium: 'Medium', High: 'High' },
    machineryLevels: { Available: 'Available', Limited: 'Limited', None: 'None' },
    analyze: 'Find my best crop',
    analyzing: 'Analyzing your farm…',
    reset: 'Reset',
    landError: 'Please enter a land area greater than 0 acres.',
    budgetError: 'Please enter a budget of ₹0 or more.',
    offline:
      'We could not reach the analysis service. Make sure the backend is running, then try again.',
    retry: 'Try again',
    emptyTitle: 'We check feasibility before we recommend.',
    emptyText:
      'A crop is only suggested if you can really afford and manage it. Fill in your farm details and press the button.',
    checks: { budget: 'Budget', water: 'Water', labour: 'Labour', machinery: 'Machinery' },
    resultEyebrow: 'Your result',
    best: 'Best fit for your farm',
    score: 'Fit score',
    scoreHelp: 'Higher is better. Out of 100.',
    profit: 'Expected profit',
    cost: 'Cost to grow',
    revenue: 'Expected income',
    returnOnCost: 'Return on cost',
    riskLabel: 'Risk',
    feasible: 'Feasible',
    notFeasible: 'Not feasible',
    noneTitle: 'No crop fits all your limits right now.',
    noneText:
      'See below what is holding each crop back. Even a small change — a bit more budget or water — can open up options.',
    rankingTitle: 'All strategies, ranked',
    rankingHint: 'Crops you can grow come first.',
    showDetails: 'Details',
    hideDetails: 'Hide',
    whyNot: 'Why not',
    exScore: 'How the score is built',
    exWeight: 'weight',
    exStrengths: 'Financial strengths',
    exWeaknesses: 'Financial weaknesses',
    exRisk: 'Risk',
    exRanking: 'Why this rank',
    exChanges: 'What would make it feasible',
    estimateNote: 'Costs, income and return are reference estimates, not guaranteed results.',
    pass: 'OK',
    fail: 'Short',
    footer: 'AgriTwin · Hackathon prototype · Estimates only — check with your local agriculture office.',
    lang: 'हिन्दी',
    skip: 'Skip to results',
  },
  hi: {
    tagline: 'खेती के फ़ैसलों में मदद',
    heroKicker: 'जो आपके पास है, उसका पूरा लाभ लें',
    heroTitle: 'अपनी खेती की योजना भरोसे के साथ बनाएं।',
    heroText:
      'अपनी ज़मीन, बजट और संसाधन बताइए। AgriTwin पहले देखता है कि क्या संभव है, फिर आपके लिए सही फ़सलें क्रम में दिखाता है।',
    presetsLabel: 'जल्दी शुरू करें',
    presets: { small: 'छोटा खेत', typical: 'सामान्य खेत', large: 'बड़ा खेत' },
    formTitle: 'अपने खेत के बारे में बताइए',
    formHint: 'कुछ भी बदलें और फिर से जांचें।',
    land: 'आपके पास कितनी ज़मीन है?',
    landUnit: 'एकड़',
    budget: 'आप कितना पैसा लगा सकते हैं?',
    budgetHint: 'पूरे खेत के लिए कुल रकम',
    perAcre: 'प्रति एकड़',
    water: 'पानी कितना उपलब्ध है?',
    labour: 'मज़दूर कितने मिल सकते हैं?',
    machinery: 'आपके पास कौन-सी मशीनें हैं?',
    risk: 'आप कितना जोखिम ले सकते हैं?',
    riskHelp: {
      Low: 'सुरक्षित — स्थिर फ़सलें',
      Medium: 'संतुलित',
      High: 'ज़्यादा कमाई के लिए जोखिम मंज़ूर',
    },
    levels: { Low: 'कम', Medium: 'मध्यम', High: 'ज़्यादा' },
    machineryLevels: { Available: 'उपलब्ध', Limited: 'सीमित', None: 'नहीं' },
    analyze: 'मेरी सबसे अच्छी फ़सल खोजें',
    analyzing: 'आपके खेत की जांच हो रही है…',
    reset: 'रीसेट',
    landError: 'कृपया 0 से ज़्यादा एकड़ ज़मीन दर्ज करें।',
    budgetError: 'कृपया ₹0 या उससे ज़्यादा बजट दर्ज करें।',
    offline: 'विश्लेषण सेवा से संपर्क नहीं हो सका। जांचें कि बैकएंड चालू है, फिर दोबारा कोशिश करें।',
    retry: 'दोबारा कोशिश करें',
    emptyTitle: 'सुझाव से पहले हम व्यवहारिकता जांचते हैं।',
    emptyText:
      'फ़सल तभी सुझाई जाती है जब आप उसे सच में उगा सकें। खेत की जानकारी भरें और बटन दबाएं।',
    checks: { budget: 'बजट', water: 'पानी', labour: 'मज़दूर', machinery: 'मशीन' },
    resultEyebrow: 'आपका नतीजा',
    best: 'आपके खेत के लिए सबसे उपयुक्त',
    score: 'उपयुक्तता स्कोर',
    scoreHelp: 'जितना ज़्यादा, उतना बेहतर। 100 में से।',
    profit: 'अनुमानित मुनाफ़ा',
    cost: 'उगाने की लागत',
    revenue: 'अनुमानित आमदनी',
    returnOnCost: 'लागत पर रिटर्न',
    riskLabel: 'जोखिम',
    feasible: 'संभव',
    notFeasible: 'संभव नहीं',
    noneTitle: 'अभी कोई फ़सल आपकी सभी सीमाओं में फिट नहीं बैठती।',
    noneText: 'नीचे देखें कि हर फ़सल में क्या कमी है। थोड़ा बजट या पानी बढ़ने से भी विकल्प खुल सकते हैं।',
    rankingTitle: 'सभी रणनीतियां, क्रम से',
    rankingHint: 'जो फ़सलें आप उगा सकते हैं वे पहले हैं।',
    showDetails: 'विवरण',
    hideDetails: 'छुपाएं',
    whyNot: 'क्यों नहीं',
    exScore: 'स्कोर कैसे बना',
    exWeight: 'भार',
    exStrengths: 'आर्थिक खूबियां',
    exWeaknesses: 'आर्थिक कमियां',
    exRisk: 'जोखिम',
    exRanking: 'यह रैंक क्यों',
    exChanges: 'क्या बदलने से संभव होगा',
    estimateNote: 'लागत, आमदनी और रिटर्न केवल संदर्भ अनुमान हैं, गारंटीशुदा नतीजे नहीं।',
    pass: 'ठीक',
    fail: 'कमी',
    footer: 'AgriTwin · हैकाथॉन प्रोटोटाइप · केवल अनुमान — अपने स्थानीय कृषि कार्यालय से सलाह लें।',
    lang: 'English',
    skip: 'नतीजे पर जाएं',
  },
}

/* ---------------------------------------------------------------- config */
const DEFAULTS = {
  land_area_acres: 5,
  budget: 80000,
  water_availability: 'Medium',
  labour_availability: 'Medium',
  machinery_availability: 'Available',
  risk_preference: 'Medium',
}

const PRESETS = {
  small: { land_area_acres: 2, budget: 40000, water_availability: 'Low', labour_availability: 'Low', machinery_availability: 'None', risk_preference: 'Low' },
  typical: DEFAULTS,
  large: { land_area_acres: 15, budget: 500000, water_availability: 'High', labour_availability: 'High', machinery_availability: 'Available', risk_preference: 'High' },
}

const LEVEL_OPTIONS = ['Low', 'Medium', 'High']
const MACHINERY_OPTIONS = ['None', 'Limited', 'Available']
const BUDGET_STEPS = [25000, 50000, 100000, 250000]

const CROP_EMOJI = {
  Wheat: '🌾', Rice: '🍚', Maize: '🌽', Mustard: '🌼', Sugarcane: '🎋', Cotton: '☁️',
}
const CHECK_ICON = { budget: '💰', water: '💧', labour: '🧑‍🌾', machinery: '🚜' }
const FIELD_ICON = { water: '💧', labour: '🧑‍🌾', machinery: '🚜', risk: '⚖️' }

const inr = (v) => (v == null ? '—' : `₹${Math.round(Number(v)).toLocaleString('en-IN')}`)
const compactInr = (v) => {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`
}
// ROI comes from the backend (roi_pct, null when undefined); fall back to the old calculation for older responses
const roiOf = (item) => {
  const v = 'roi_pct' in item ? item.roi_pct : item.total_cost > 0 ? (item.expected_profit / item.total_cost) * 100 : null
  return v == null ? '—' : `${Math.round(v)}%`
}
const riskBand = (score) => (score >= 40 ? 'High' : score >= 20 ? 'Medium' : 'Low')

/* ------------------------------------------------------------ components */
function Segmented({ id, label, icon, value, options, labels, onChange, help }) {
  return (
    <div className="field" role="radiogroup" aria-labelledby={`${id}-label`}>
      <div className="field-label" id={`${id}-label`}>
        {icon && <span className="field-icon" aria-hidden="true">{icon}</span>}
        {label}
      </div>
      <div className="segmented">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={value === opt}
            className={value === opt ? 'seg active' : 'seg'}
            onClick={() => onChange(id, opt)}
          >
            {labels[opt]}
          </button>
        ))}
      </div>
      {help && <p className="field-help">{help}</p>}
    </div>
  )
}

function CheckChips({ constraints, t, compact }) {
  return (
    <ul className={compact ? 'checks compact' : 'checks'} aria-label="Constraint checks">
      {Object.entries(constraints).map(([key, val]) => {
        const ok = val === 'Pass'
        return (
          <li key={key} className={ok ? 'check pass' : 'check fail'}>
            <span aria-hidden="true">{CHECK_ICON[key]}</span>
            <span>{t.checks[key] || key}</span>
            <span className="check-mark" aria-hidden="true">{ok ? '✓' : '✕'}</span>
            <span className="sr-only">{ok ? t.pass : t.fail}</span>
          </li>
        )
      })}
    </ul>
  )
}

function ScoreRing({ value, label }) {
  const r = 44
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="ring" role="img" aria-label={`${label}: ${pct} / 100`}>
      <svg viewBox="0 0 104 104" width="132" height="132">
        <circle cx="52" cy="52" r={r} className="ring-track" />
        <circle
          cx="52" cy="52" r={r} className="ring-fill"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 52 52)"
        />
      </svg>
      <div className="ring-text"><strong>{pct}</strong><small>/ 100</small></div>
    </div>
  )
}

function RiskMeter({ score, t }) {
  const band = riskBand(score)
  return (
    <span className={`risk risk-${band.toLowerCase()}`}>
      <span className="risk-bars" aria-hidden="true"><i /><i /><i /></span>
      {t.levels[band]}
    </span>
  )
}

function ExplainList({ title, items, tone }) {
  if (!items || items.length === 0) return null
  return (
    <div className={tone ? `explain-block ${tone}` : 'explain-block'}>
      <strong>{title}</strong>
      <ul>{items.map((m, i) => <li key={`${i}-${m}`}>{m}</li>)}</ul>
    </div>
  )
}

function Explanation({ ex, t }) {
  return (
    <div className="explain">
      {ex.score_breakdown?.length > 0 && (
        <div className="explain-block">
          <strong>{t.exScore}</strong>
          <ul className="breakdown">
            {ex.score_breakdown.map((b) => (
              <li key={b.key}>
                <span className="breakdown-name">{b.component}</span>
                <span className="breakdown-val">{b.score} × {Math.round(b.weight * 100)}% {t.exWeight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ExplainList title={t.exStrengths} items={ex.financial_strengths} tone="good" />
      <ExplainList title={t.exWeaknesses} items={ex.financial_weaknesses} tone="warn" />
      <ExplainList title={t.exRisk} items={ex.risk_observations} />
      <ExplainList title={t.exRanking} items={ex.ranking_reasons} />
      <ExplainList title={t.exChanges} items={ex.what_would_make_it_feasible} tone="warn" />
    </div>
  )
}

function StrategyCard({ item, t, maxProfit, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const barWidth = maxProfit > 0 ? Math.max(4, (Math.max(item.expected_profit, 0) / maxProfit) * 100) : 4
  const failed = Object.entries(item.constraints).filter(([, v]) => v !== 'Pass')

  return (
    <article className={`strategy ${item.feasible ? '' : 'is-infeasible'}`}>
      <button
        type="button"
        className="strategy-head"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="rank">{item.rank}</span>
        <span className="crop-emoji" aria-hidden="true">{CROP_EMOJI[item.crop] || '🌱'}</span>
        <span className="strategy-name">
          <strong>{item.crop}</strong>
          <small>{item.strategy}</small>
        </span>
        <span className="strategy-quick">
          {item.feasible ? (
            <>
              <span className="quick-profit">{compactInr(item.expected_profit)}</span>
              <span className="quick-sub">{t.profit}</span>
            </>
          ) : (
            <span className="pill warn">
              {failed.length > 0 ? failed.map(([k]) => t.checks[k]).join(' · ') : t.notFeasible}
            </span>
          )}
        </span>
        <span className={open ? 'chev open' : 'chev'} aria-hidden="true">›</span>
      </button>

      {item.feasible && (
        <div className="bar-row" aria-hidden="true">
          <div className="bar"><div className="bar-fill" style={{ width: `${barWidth}%` }} /></div>
        </div>
      )}

      {open && (
        <div className="strategy-body">
          <CheckChips constraints={item.constraints} t={t} compact />
          <dl className="facts">
            <div><dt>{t.cost}</dt><dd>{inr(item.total_cost)}</dd></div>
            <div><dt>{t.revenue}</dt><dd>{inr(item.expected_revenue)}</dd></div>
            <div><dt>{t.profit}</dt><dd className={item.expected_profit < 0 ? 'neg' : ''}>{inr(item.expected_profit)}</dd></div>
            <div><dt>{t.returnOnCost}</dt><dd>{roiOf(item)}</dd></div>
            <div><dt>{t.riskLabel}</dt><dd><RiskMeter score={item.risk_score} t={t} /></dd></div>
            <div><dt>{t.score}</dt><dd>{item.score}</dd></div>
          </dl>
          {item.issues?.length > 0 ? (
            <div className="why-not">
              <strong>{t.whyNot}</strong>
              <ul>{item.issues.map((msg) => <li key={msg}>{msg}</li>)}</ul>
            </div>
          ) : (
            <p className="reason">{item.reason}</p>
          )}
          {item.explanation && <Explanation ex={item.explanation} t={t} />}
          <p className="estimate-note">{t.estimateNote}</p>
        </div>
      )}
    </article>
  )
}

function ResultView({ data, t }) {
  const strategies = Array.isArray(data?.strategies) ? data.strategies : []
  const feasibleCount = strategies.filter((s) => s.feasible).length
  const best = strategies.find((s) => s.crop === data.recommended_crop)
  const maxProfit = Math.max(0, ...strategies.filter((s) => s.feasible).map((s) => s.expected_profit))

  return (
    <section className="results" aria-live="polite" aria-label={t.resultEyebrow}>
      {best ? (
        <div className="winner">
          <div className="winner-main">
            <p className="eyebrow light">{t.best}</p>
            <h2>
              <span aria-hidden="true">{CROP_EMOJI[best.crop] || '🌱'}</span> {best.crop}
            </h2>
            <p className="winner-sub">{best.strategy}</p>
            <CheckChips constraints={best.constraints} t={t} compact />
          </div>
          <div className="winner-score">
            <ScoreRing value={data.overall_score} label={t.score} />
            <span>{t.score}</span>
          </div>
          <dl className="winner-stats">
            <div><dt>{t.profit}</dt><dd>{compactInr(best.expected_profit)}</dd></div>
            <div><dt>{t.cost}</dt><dd>{compactInr(best.total_cost)}</dd></div>
            <div><dt>{t.returnOnCost}</dt><dd>{roiOf(best)}</dd></div>
            <div><dt>{t.riskLabel}</dt><dd><RiskMeter score={best.risk_score} t={t} /></dd></div>
          </dl>
        </div>
      ) : (
        <div className="none-card">
          <span className="none-icon" aria-hidden="true">🌧️</span>
          <div>
            <h2>{t.noneTitle}</h2>
            <p>{t.noneText}</p>
          </div>
        </div>
      )}

      <div className="ranking-head">
        <div>
          <h3>{t.rankingTitle}</h3>
          <p>{t.rankingHint}</p>
        </div>
        <span className="pill ok">{feasibleCount} / {strategies.length} {t.feasible.toLowerCase()}</span>
      </div>

      <div className="strategy-list">
        {strategies.map((item, i) => (
          <StrategyCard key={item.crop} item={item} t={t} maxProfit={maxProfit} defaultOpen={i === 0 && (item.feasible || feasibleCount === 0)} />
        ))}
      </div>
    </section>
  )
}

function Skeleton() {
  return (
    <section className="results" aria-busy="true" aria-live="polite">
      <div className="skeleton winner-skel" />
      <div className="skeleton row-skel" />
      <div className="skeleton row-skel" />
      <div className="skeleton row-skel" />
    </section>
  )
}

/* ------------------------------------------------------------------- app */
export default function App() {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('agritwin-lang') || 'en' } catch { return 'en' }
  })
  const t = T[lang]
  const [form, setForm] = useState(DEFAULTS)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const resultsRef = useRef(null)

  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en'
    try { localStorage.setItem('agritwin-lang', lang) } catch { /* ignore */ }
  }, [lang])

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setFieldErrors((e) => ({ ...e, [name]: undefined }))
    setError('')
  }
  const onNumber = (e) => {
    const { name, value } = e.target
    setField(name, value === '' ? '' : Number(value))
  }

  const activePreset = useMemo(
    () => Object.keys(PRESETS).find((k) => JSON.stringify(PRESETS[k]) === JSON.stringify(form)),
    [form],
  )
  const perAcre = form.land_area_acres > 0 && form.budget !== '' ? Math.round(form.budget / form.land_area_acres) : null

  const analyze = async (e) => {
    e?.preventDefault()
    const errs = {}
    if (form.land_area_acres === '' || form.land_area_acres <= 0) errs.land_area_acres = t.landError
    if (form.budget === '' || form.budget < 0) errs.budget = t.budgetError
    setFieldErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(Object.keys(errs)[0])?.focus()
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const isJson = (res.headers.get('content-type') || '').includes('application/json')
      const body = isJson ? await res.json() : await res.text()
      if (!res.ok) {
        if (body?.details?.length) throw new Error(body.details.map((d) => `${d.field}: ${d.message}`).join(' | '))
        throw new Error(body?.error || body?.detail || body?.message || `HTTP ${res.status}`)
      }
      setResult(body)
      setTimeout(() => {
        if (window.matchMedia('(max-width: 900px)').matches) {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 60)
    } catch (err) {
      setError(err instanceof TypeError ? t.offline : err.message || t.offline)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setForm(DEFAULTS)
    setResult(null)
    setError('')
    setFieldErrors({})
  }

  return (
    <div className="app">
      <a className="skip" href="#results">{t.skip}</a>

      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">🌱</div>
            <div><strong>AgriTwin</strong><span>{t.tagline}</span></div>
          </div>
          <button type="button" className="lang-btn" onClick={() => setLang(lang === 'en' ? 'hi' : 'en')} lang={lang === 'en' ? 'hi' : 'en'}>
            {t.lang}
          </button>
        </div>
      </header>

      <main className="page">
        <section className="hero">
          <p className="hero-kicker">{t.heroKicker}</p>
          <h1>{t.heroTitle}</h1>
          <p>{t.heroText}</p>
        </section>

        <div className="workspace">
          <form className="card form-card" onSubmit={analyze} noValidate>
            <div className="card-head">
              <div>
                <h2>{t.formTitle}</h2>
                <p>{t.formHint}</p>
              </div>
              <button type="button" className="link-btn" onClick={reset}>{t.reset}</button>
            </div>

            <div className="presets" role="group" aria-label={t.presetsLabel}>
              <span>{t.presetsLabel}</span>
              {Object.keys(PRESETS).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={activePreset === k ? 'chip active' : 'chip'}
                  aria-pressed={activePreset === k}
                  onClick={() => { setForm(PRESETS[k]); setFieldErrors({}); setError('') }}
                >
                  {t.presets[k]}
                </button>
              ))}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="land_area_acres"><span className="field-icon" aria-hidden="true">🌍</span>{t.land}</label>
              <div className={fieldErrors.land_area_acres ? 'input-wrap invalid' : 'input-wrap'}>
                <button type="button" className="step" aria-label="−" onClick={() => setField('land_area_acres', Math.max(0.5, Number(form.land_area_acres || 0) - 0.5))}>−</button>
                <input id="land_area_acres" name="land_area_acres" type="number" inputMode="decimal" min="0.01" step="0.5"
                  value={form.land_area_acres} onChange={onNumber}
                  aria-invalid={!!fieldErrors.land_area_acres} aria-describedby={fieldErrors.land_area_acres ? 'land-err' : undefined} />
                <span className="unit">{t.landUnit}</span>
                <button type="button" className="step" aria-label="+" onClick={() => setField('land_area_acres', Number(form.land_area_acres || 0) + 0.5)}>+</button>
              </div>
              {fieldErrors.land_area_acres && <p className="err" id="land-err">{fieldErrors.land_area_acres}</p>}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="budget"><span className="field-icon" aria-hidden="true">💰</span>{t.budget}</label>
              <div className={fieldErrors.budget ? 'input-wrap invalid' : 'input-wrap'}>
                <span className="unit prefix">₹</span>
                <input id="budget" name="budget" type="number" inputMode="numeric" min="0" step="1000"
                  value={form.budget} onChange={onNumber}
                  aria-invalid={!!fieldErrors.budget} aria-describedby="budget-help" />
              </div>
              <div className="quick-add" aria-label="Quick budget">
                {BUDGET_STEPS.map((n) => (
                  <button key={n} type="button" className="chip small" onClick={() => setField('budget', Number(form.budget || 0) + n)}>
                    +{compactInr(n)}
                  </button>
                ))}
              </div>
              <p className="field-help" id="budget-help">
                {t.budgetHint}{perAcre != null && <> · <strong>{inr(perAcre)}</strong> {t.perAcre}</>}
              </p>
              {fieldErrors.budget && <p className="err">{fieldErrors.budget}</p>}
            </div>

            <Segmented id="water_availability" label={t.water} icon={FIELD_ICON.water} value={form.water_availability}
              options={LEVEL_OPTIONS} labels={t.levels} onChange={setField} />
            <Segmented id="labour_availability" label={t.labour} icon={FIELD_ICON.labour} value={form.labour_availability}
              options={LEVEL_OPTIONS} labels={t.levels} onChange={setField} />
            <Segmented id="machinery_availability" label={t.machinery} icon={FIELD_ICON.machinery} value={form.machinery_availability}
              options={MACHINERY_OPTIONS} labels={t.machineryLevels} onChange={setField} />
            <Segmented id="risk_preference" label={t.risk} icon={FIELD_ICON.risk} value={form.risk_preference}
              options={LEVEL_OPTIONS} labels={t.levels} onChange={setField} help={t.riskHelp[form.risk_preference]} />

            {error && (
              <div className="error-box" role="alert">
                <span>{error}</span>
                <button type="button" className="link-btn" onClick={analyze}>{t.retry}</button>
              </div>
            )}

            <div className="submit-bar">
              <button className="primary" type="submit" disabled={loading}>
                {loading && <span className="spinner" aria-hidden="true" />}
                {loading ? t.analyzing : t.analyze}
                {!loading && <span aria-hidden="true"> →</span>}
              </button>
            </div>
          </form>

          <div className="results-col" id="results" ref={resultsRef} tabIndex={-1}>
            {loading && !result ? (
              <Skeleton />
            ) : result ? (
              <div className={loading ? 'dim' : ''}><ResultView data={result} t={t} /></div>
            ) : (
              <section className="card empty">
                <div className="empty-art" aria-hidden="true">🌾</div>
                <h2>{t.emptyTitle}</h2>
                <p>{t.emptyText}</p>
                <ul className="checks">
                  {Object.keys(CHECK_ICON).map((k) => (
                    <li key={k} className="check"><span aria-hidden="true">{CHECK_ICON[k]}</span><span>{t.checks[k]}</span></li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>

      <footer className="footer">{t.footer}</footer>
    </div>
  )
}
