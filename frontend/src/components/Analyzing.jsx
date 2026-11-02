import { useEffect, useState } from 'react'

/* Simple waiting screen. Appears after a short delay (CSS) so quick replies never flash it. */
export default function Analyzing({ t }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1100)
    return () => clearInterval(id)
  }, [])
  const active = Math.min(tick, t.loadingSteps.length - 1)

  return (
    <div className="analyzing" role="status" aria-live="polite">
      <div className="analyzing-box">
        <span className="spinner big" aria-hidden="true" />
        <h2>{t.analyzing}</h2>
        <ul className="loading-steps">
          {t.loadingSteps.map((label, i) => (
            <li key={label} className={i < active ? 'done' : i === active ? 'now' : ''}>
              <span className="tick" aria-hidden="true">{i < active ? '✓' : ''}</span>
              {label}
            </li>
          ))}
        </ul>
        {tick >= 7 && <p className="wakeup">{t.wakeup}</p>}
      </div>
    </div>
  )
}
