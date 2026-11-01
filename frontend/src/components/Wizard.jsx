import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BUDGET_STEPS, FIELD_ICON, LEVEL_OPTIONS, MACHINERY_OPTIONS, PRESETS, compactInr, inr,
} from '../lib.js'
import { Segmented } from './Parts.jsx'

const RISK_ICON = { Low: '🛡️', Medium: '⚖️', High: '🚀' }

/* Three short steps instead of one long form: land & budget -> resources -> risk + review. */
export default function Wizard({ t, form, setForm, step, setStep, onSubmit, onReset, loading, error }) {
  const [fieldErrors, setFieldErrors] = useState({})
  const headingRef = useRef(null)
  const mounted = useRef(false)
  const total = t.steps.length

  useEffect(() => {
    if (mounted.current) headingRef.current?.focus({ preventScroll: true })
    mounted.current = true
  }, [step])

  const setField = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    setFieldErrors((e) => ({ ...e, [name]: undefined }))
  }
  const onNumber = (e) => setField(e.target.name, e.target.value === '' ? '' : Number(e.target.value))

  const activePreset = useMemo(
    () => Object.keys(PRESETS).find((k) => JSON.stringify(PRESETS[k]) === JSON.stringify(form)),
    [form],
  )
  const perAcre = form.land_area_acres > 0 && form.budget !== '' ? Math.round(form.budget / form.land_area_acres) : null

  const validateLandBudget = () => {
    const errs = {}
    if (form.land_area_acres === '' || form.land_area_acres <= 0) errs.land_area_acres = t.landError
    if (form.budget === '' || form.budget < 0) errs.budget = t.budgetError
    setFieldErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(Object.keys(errs)[0])?.focus()
      return false
    }
    return true
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (loading) return
    if (step === 0) { if (validateLandBudget()) setStep(1) } else if (step === 1) setStep(2)
    else if (validateLandBudget()) onSubmit()
    else setStep(0)
  }

  const reviewRows = [
    [t.land, `${form.land_area_acres} ${t.landUnit}`, 0],
    [t.budget, inr(form.budget), 0],
    [t.water, t.levels[form.water_availability], 1],
    [t.labour, t.levels[form.labour_availability], 1],
    [t.machinery, t.machineryLevels[form.machinery_availability], 1],
  ]

  return (
    <form className="card wizard" onSubmit={handleSubmit} noValidate>
      <div className="wizard-top">
        <p className="wizard-step" aria-live="polite">{t.stepOf(step + 1, total)}</p>
        <button type="button" className="link-btn" onClick={() => { setFieldErrors({}); onReset() }}>{t.reset}</button>
      </div>

      <ol className="stepper" aria-label={t.formTitle}>
        {t.steps.map((label, i) => (
          <li key={label} className={i === step ? 'active' : i < step ? 'done' : ''}>
            <button type="button" disabled={i > step} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
              <span className="dot">{i < step ? '✓' : i + 1}</span>
              <span className="step-label">{label}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="progress" aria-hidden="true"><span style={{ width: `${((step + 1) / total) * 100}%` }} /></div>

      <div className="wizard-body" key={step}>
        <h2 ref={headingRef} tabIndex={-1}>{step === 0 ? t.formTitle : t.steps[step]}</h2>

        {step === 0 && (
          <>
            <div className="presets" role="group" aria-label={t.presetsLabel}>
              <span>{t.presetsLabel}</span>
              {Object.keys(PRESETS).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={activePreset === k ? 'chip active' : 'chip'}
                  aria-pressed={activePreset === k}
                  onClick={() => { setForm(PRESETS[k]); setFieldErrors({}) }}
                >
                  {t.presets[k]}
                </button>
              ))}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="land_area_acres"><span className="field-icon" aria-hidden="true">🌍</span>{t.land}</label>
              <div className={fieldErrors.land_area_acres ? 'input-wrap invalid' : 'input-wrap'}>
                <button type="button" className="step-btn" aria-label="−" onClick={() => setField('land_area_acres', Math.max(0.5, Number(form.land_area_acres || 0) - 0.5))}>−</button>
                <input id="land_area_acres" name="land_area_acres" type="number" inputMode="decimal" min="0.01" step="0.5"
                  value={form.land_area_acres} onChange={onNumber}
                  aria-invalid={!!fieldErrors.land_area_acres} aria-describedby={fieldErrors.land_area_acres ? 'land-err' : undefined} />
                <span className="unit">{t.landUnit}</span>
                <button type="button" className="step-btn" aria-label="+" onClick={() => setField('land_area_acres', Number(form.land_area_acres || 0) + 0.5)}>+</button>
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
          </>
        )}

        {step === 1 && (
          <>
            <p className="step-hint">{t.resourcesHint}</p>
            <Segmented id="water_availability" label={t.water} icon={FIELD_ICON.water} value={form.water_availability}
              options={LEVEL_OPTIONS} labels={t.levels} onChange={setField} />
            <Segmented id="labour_availability" label={t.labour} icon={FIELD_ICON.labour} value={form.labour_availability}
              options={LEVEL_OPTIONS} labels={t.levels} onChange={setField} />
            <Segmented id="machinery_availability" label={t.machinery} icon={FIELD_ICON.machinery} value={form.machinery_availability}
              options={MACHINERY_OPTIONS} labels={t.machineryLevels} onChange={setField} />
          </>
        )}

        {step === 2 && (
          <>
            <div className="field" role="radiogroup" aria-labelledby="risk-label">
              <div className="field-label" id="risk-label"><span className="field-icon" aria-hidden="true">{FIELD_ICON.risk}</span>{t.risk}</div>
              <div className="risk-cards">
                {LEVEL_OPTIONS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    role="radio"
                    aria-checked={form.risk_preference === lvl}
                    className={form.risk_preference === lvl ? 'risk-card active' : 'risk-card'}
                    onClick={() => setField('risk_preference', lvl)}
                  >
                    <span className="risk-card-icon" aria-hidden="true">{RISK_ICON[lvl]}</span>
                    <span>
                      <strong>{t.riskCards[lvl][0]}</strong>
                      <small>{t.riskCards[lvl][1]}</small>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="review">
              <p className="review-title">{t.reviewTitle}</p>
              <ul>
                {reviewRows.map(([label, value, target]) => (
                  <li key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <button type="button" className="link-btn" onClick={() => setStep(target)}>{t.edit}</button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="error-box" role="alert">
          <span>{error}</span>
          <button type="button" className="link-btn" onClick={onSubmit}>{t.retry}</button>
        </div>
      )}

      <div className="wizard-nav">
        {step > 0 && (
          <button type="button" className="ghost" onClick={() => setStep(step - 1)}>
            <span aria-hidden="true">←</span> {t.back}
          </button>
        )}
        <button className="primary" type="submit" disabled={loading}>
          {loading && <span className="spinner" aria-hidden="true" />}
          {step < total - 1 ? t.next : loading ? t.analyzing : t.analyze}
          {!loading && <span aria-hidden="true"> →</span>}
        </button>
      </div>
    </form>
  )
}
