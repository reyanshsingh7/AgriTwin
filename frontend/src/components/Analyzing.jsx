import { useEffect, useState } from 'react'

/* Full-screen progress while the backend works. Appears after a short delay (CSS) so quick replies never flash it. */
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
        <svg className="sprout" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="56" fill="rgba(255,255,255,.08)" />
          <path className="sprout-stem" d="M60 98 V52" stroke="#9be08f" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path className="sprout-leaf l1" d="M60 62 C40 62 30 48 30 36 C46 36 60 46 60 62 Z" fill="#7cc97a" />
          <path className="sprout-leaf l2" d="M60 52 C80 52 90 38 90 26 C74 26 60 36 60 52 Z" fill="#a9e6a2" />
          <ellipse cx="60" cy="100" rx="22" ry="5" fill="rgba(0,0,0,.25)" />
        </svg>
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
