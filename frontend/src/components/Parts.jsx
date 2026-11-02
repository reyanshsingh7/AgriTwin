import { useState } from 'react'
import { CHECK_ICON, compactInr, inr, riskBand, roiOf } from '../lib.js'
import { CROP_NAMES_HI } from '../i18n.js'
import Icon from './Icon.jsx'
import { CropThumb } from './Photo.jsx'

export const cropName = (crop, lang) => (lang === 'hi' ? CROP_NAMES_HI[crop] || crop : crop)

export function Segmented({ id, label, icon, value, options, labels, onChange, help }) {
  return (
    <div className="field" role="radiogroup" aria-labelledby={`${id}-label`}>
      <div className="field-label" id={`${id}-label`}>
        {icon && <Icon name={icon} className="field-icon" />}
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

export function CheckChips({ constraints, t, compact }) {
  return (
    <ul className={compact ? 'checks compact' : 'checks'} aria-label="Constraint checks">
      {Object.entries(constraints).map(([key, val]) => {
        const ok = val === 'Pass'
        return (
          <li key={key} className={ok ? 'check pass' : 'check fail'}>
            <Icon name={CHECK_ICON[key]} size={15} />
            <span>{t.checks[key] || key}</span>
            <span className="check-mark" aria-hidden="true">{ok ? '✓' : '✕'}</span>
            <span className="sr-only">{ok ? t.pass : t.fail}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function Score({ value, label }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className="score" role="img" aria-label={`${label}: ${pct} / 100`}>
      <strong>{pct.toFixed(1)}</strong>
      <small>/ 100</small>
    </div>
  )
}

export function RiskMeter({ score, t }) {
  const band = riskBand(score)
  return (
    <span className={`risk risk-${band.toLowerCase()}`}>
      <span className="risk-bars" aria-hidden="true"><i /><i /><i /></span>
      {t.levels[band]}
    </span>
  )
}

export function ExplainList({ title, items, tone }) {
  if (!items || items.length === 0) return null
  return (
    <div className={tone ? `explain-block ${tone}` : 'explain-block'}>
      <strong>{title}</strong>
      <ul>{items.map((m, i) => <li key={`${i}-${m}`}>{m}</li>)}</ul>
    </div>
  )
}

export function Explanation({ ex, t }) {
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

export function StrategyCard({ item, t, lang, maxProfit, defaultOpen, index = 0 }) {
  const [open, setOpen] = useState(defaultOpen)
  const barWidth = maxProfit > 0 ? Math.max(4, (Math.max(item.expected_profit ?? 0, 0) / maxProfit) * 100) : 4
  const failed = Object.entries(item.constraints).filter(([, v]) => v !== 'Pass')

  return (
    <article className={`strategy ${item.feasible ? '' : 'is-infeasible'}`} style={{ '--i': index }}>
      <button type="button" className="strategy-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="rank">{item.rank}</span>
        <CropThumb crop={item.crop} label={cropName(item.crop, lang)} size={40} />
        <span className="strategy-name">
          <strong>{cropName(item.crop, lang)}</strong>
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
