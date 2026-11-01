import { useEffect, useRef, useState } from 'react'
import { CHECK_ICON, CROP_EMOJI, compactInr, inr, roiOf } from '../lib.js'
import { Reveal } from '../components/Art.jsx'
import { CheckChips, RiskMeter, ScoreRing, StrategyCard, cropName } from '../components/Parts.jsx'

const uniq = (arr) => [...new Set(arr.filter(Boolean))]

function InsightList({ title, items, tone }) {
  if (!items.length) return null
  return (
    <div className={`insight ${tone}`}>
      <h3>{title}</h3>
      <ul>{items.map((m) => <li key={m}>{m}</li>)}</ul>
    </div>
  )
}

function BestPanel({ data, t, lang, best, others, onCompare }) {
  if (!best) {
    return (
      <div className="panel">
        <div className="none-card">
          <span className="none-icon" aria-hidden="true">🌧️</span>
          <div>
            <h2>{t.noneTitle}</h2>
            <p>{data.message}</p>
            <p>{t.noneText}</p>
          </div>
        </div>
        <h3 className="panel-sub">{t.helpTitle}</h3>
        <div className="help-grid">
          {(data.best_alternatives || []).map((alt) => (
            <Reveal key={alt.crop} className="help-card">
              <h4><span aria-hidden="true">{CROP_EMOJI[alt.crop] || '🌱'}</span> {cropName(alt.crop, lang)}</h4>
              <ul>{(alt.required_changes || []).map((c) => <li key={c}>{c}</li>)}</ul>
            </Reveal>
          ))}
        </div>
        <button type="button" className="ghost wide" onClick={onCompare}>{t.seeAll} →</button>
      </div>
    )
  }

  const ex = best.explanation || {}
  const why = uniq([...(ex.ranking_reasons || []).slice(0, 2), ...(ex.financial_strengths || []).slice(0, 2)])
  const tight = Object.values(best.constraint_details || {})
    .filter((d) => d.hard && d.status === 'tight')
    .map((d) => d.message)
  const risky = (ex.risk_observations || []).filter((s) => /conflict|not the safest/i.test(s))
  const watch = uniq([...tight, ...(ex.financial_weaknesses || []).slice(0, 2), ...risky])

  return (
    <div className="panel">
      <div className="winner">
        <div className="winner-main">
          <p className="eyebrow light">{t.best}</p>
          <h2><span aria-hidden="true">{CROP_EMOJI[best.crop] || '🌱'}</span> {cropName(best.crop, lang)}</h2>
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

      <div className="insights">
        <InsightList title={t.whyTitle} items={why} tone="good" />
        <InsightList title={t.watchTitle} items={watch} tone="warn" />
      </div>
      <p className="estimate-note">{t.estimateNote}</p>

      <h3 className="panel-sub">{t.otherTitle}</h3>
      {others.length === 0 ? (
        <p className="muted">{t.noOthers}</p>
      ) : (
        <div className="others">
          {others.map((s, i) => (
            <button key={s.crop} type="button" className="other-card" style={{ '--i': i }} onClick={onCompare}>
              <span className="other-emoji" aria-hidden="true">{CROP_EMOJI[s.crop] || '🌱'}</span>
              <span className="other-main">
                <strong>{cropName(s.crop, lang)}</strong>
                <small>{t.score}: {s.score}</small>
              </span>
              <span className="other-profit">{compactInr(s.expected_profit)}</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className="ghost wide" onClick={onCompare}>{t.seeAll} →</button>
    </div>
  )
}

function ComparePanel({ strategies, t, lang }) {
  const can = strategies.filter((s) => s.feasible)
  const not = strategies.filter((s) => !s.feasible)
  const [view, setView] = useState(can.length ? 'can' : 'not')
  const list = view === 'can' ? can : not
  const maxProfit = Math.max(0, ...can.map((s) => s.expected_profit ?? 0))

  return (
    <div className="panel">
      <p className="muted">{t.rankingHint}</p>
      <div className="seg-switch" role="tablist" aria-label={t.tabs.compare}>
        <button type="button" role="tab" aria-selected={view === 'can'} className={view === 'can' ? 'active' : ''} onClick={() => setView('can')}>{t.canGrow(can.length)}</button>
        <button type="button" role="tab" aria-selected={view === 'not'} className={view === 'not' ? 'active' : ''} onClick={() => setView('not')}>{t.notYet(not.length)}</button>
      </div>
      <div className="strategy-list" key={view}>
        {list.map((item, i) => (
          <StrategyCard key={item.crop} item={item} t={t} lang={lang} maxProfit={maxProfit} defaultOpen={i === 0} index={i} />
        ))}
      </div>
    </div>
  )
}

function HowPanel({ data, t }) {
  const weights = data.scoring?.weights || {}
  const order = ['suitability', 'feasibility', 'financial', 'risk']
  return (
    <div className="panel">
      <p className="lead">{t.howDecidedIntro}</p>
      <h3 className="panel-sub">{t.hardTitle}</h3>
      <ul className="limit-list">
        {Object.entries(t.checkItems).map(([key, [name, text]]) => (
          <li key={key}>
            <span className="check-tile-icon" aria-hidden="true">{CHECK_ICON[key]}</span>
            <div><strong>{name}</strong><span>{text}</span></div>
          </li>
        ))}
      </ul>
      <h3 className="panel-sub">{t.scoreTitle}</h3>
      <ul className="weight-list">
        {order.filter((k) => weights[k] != null).map((k) => (
          <li key={k}>
            <div className="weight-head">
              <strong>{t.comp[k][0]}</strong>
              <span>{Math.round(weights[k] * 100)}%</span>
            </div>
            <div className="wbar"><span style={{ width: `${weights[k] * 100 * 2.5}%` }} /></div>
            <small>{t.comp[k][1]}</small>
          </li>
        ))}
      </ul>
      <p className="estimate-note">{t.estimateNote} {data.disclaimer}</p>
    </div>
  )
}

export default function Results({ data, t, lang, onEdit, onNew }) {
  const [tab, setTab] = useState('best')
  const headRef = useRef(null)
  const strategies = Array.isArray(data?.strategies) ? data.strategies : []
  const best = strategies.find((s) => s.crop === data.recommended_crop && s.feasible)
  const others = strategies.filter((s) => s.feasible && s !== best).slice(0, 3)
  const inp = data.inputs || {}

  useEffect(() => { headRef.current?.focus({ preventScroll: true }) }, [])

  const chips = [
    t.summary.land(inp.land_area_acres),
    t.summary.budget(inr(inp.budget)),
    t.summary.water(t.levels[inp.water_availability]),
    t.summary.labour(t.levels[inp.labour_availability]),
    t.summary.machinery(t.machineryLevels[inp.machinery_availability]),
    t.summary.risk(t.levels[inp.risk_preference]),
  ]

  const tabs = ['best', 'compare', 'how']
  const onTabKey = (e) => {
    const i = tabs.indexOf(tab)
    if (e.key === 'ArrowRight') setTab(tabs[(i + 1) % tabs.length])
    if (e.key === 'ArrowLeft') setTab(tabs[(i + tabs.length - 1) % tabs.length])
  }

  return (
    <div className="results-page">
      <div className="results-head">
        <button type="button" className="back-btn" onClick={onEdit}><span aria-hidden="true">←</span> {t.editFarm}</button>
        <button type="button" className="link-btn" onClick={onNew}>{t.newFarm}</button>
      </div>

      <h1 className="results-title" ref={headRef} tabIndex={-1}>{t.yourFarm}</h1>
      <ul className="sum-chips" aria-label={t.yourFarm}>
        {chips.map((c) => <li key={c}>{c}</li>)}
      </ul>

      <div className="tabs" role="tablist" aria-label={t.yourFarm} onKeyDown={onTabKey}>
        {tabs.map((k) => (
          <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls={`panel-${k}`}
            tabIndex={tab === k ? 0 : -1} onClick={() => setTab(k)}>
            {t.tabs[k]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} key={tab}>
        {tab === 'best' && <BestPanel data={data} t={t} lang={lang} best={best} others={others} onCompare={() => setTab('compare')} />}
        {tab === 'compare' && <ComparePanel strategies={strategies} t={t} lang={lang} />}
        {tab === 'how' && <HowPanel data={data} t={t} />}
      </div>
    </div>
  )
}
