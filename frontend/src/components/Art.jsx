import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib.js'

/* Fades/slides content in when it scrolls into view. */
export function Reveal({ as: Tag = 'div', className = '', delay = 0, children, ...rest }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
      setShown(true)
      return undefined
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setShown(true); io.disconnect() }
    }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <Tag ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`} style={{ '--d': `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  )
}

/* Counts from 0 up to `target` once (instant if the user prefers reduced motion). */
export function useCountUp(target, duration = 900) {
  const goal = Math.round((Number(target) || 0) * 10) / 10
  const [value, setValue] = useState(prefersReducedMotion() ? goal : 0)
  useEffect(() => {
    if (prefersReducedMotion()) { setValue(goal); return undefined }
    let raf
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - p) ** 3
      setValue(Math.round(goal * eased * 10) / 10)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [goal, duration])
  return value
}

/* Hero illustration: sun, clouds, hills and swaying wheat. Pure SVG + CSS, no image files. */
export function HeroArt() {
  const stalks = [38, 70, 102, 134, 166, 198, 230, 262, 294, 326, 358, 390, 422]
  return (
    <svg className="hero-art" viewBox="0 0 480 360" role="img" aria-label="Sunny farmland with wheat" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff4c9" />
          <stop offset="1" stopColor="#e6f4e3" />
        </linearGradient>
        <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc17a" />
          <stop offset="1" stopColor="#4f9a57" />
        </linearGradient>
      </defs>
      <rect width="480" height="360" fill="url(#sky)" />

      <g className="art-sun" transform="translate(372 86)">
        <g className="art-rays">
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x="-3" y="-58" width="6" height="16" rx="3" fill="#ffd35a" transform={`rotate(${i * 30})`} />
          ))}
        </g>
        <circle r="30" fill="#ffd35a" />
        <circle r="30" fill="url(#sky)" opacity=".18" />
      </g>

      <g className="art-cloud art-cloud-a" fill="#fff" opacity=".95">
        <ellipse cx="90" cy="70" rx="38" ry="15" /><ellipse cx="116" cy="62" rx="26" ry="16" /><ellipse cx="68" cy="64" rx="22" ry="13" />
      </g>
      <g className="art-cloud art-cloud-b" fill="#fff" opacity=".8">
        <ellipse cx="250" cy="120" rx="30" ry="11" /><ellipse cx="272" cy="113" rx="20" ry="12" />
      </g>

      <path d="M0 215 Q70 160 150 205 T300 190 T480 200 V360 H0 Z" fill="#cfe8cc" />
      <path d="M0 245 Q90 200 190 238 T370 226 T480 240 V360 H0 Z" fill="#a8d5a6" />
      <path d="M0 275 Q120 245 240 270 T480 262 V360 H0 Z" fill="url(#field)" />
      {[292, 312, 332].map((y, i) => (
        <path key={y} d={`M0 ${y} Q120 ${y - 18 + i * 3} 240 ${y - 2} T480 ${y - 8}`} fill="none" stroke="#3f8a4a" strokeWidth="2" opacity=".35" />
      ))}

      {stalks.map((x, i) => {
        const h = 62 + ((i * 17) % 28)
        const y = 345
        return (
          <g key={x} transform={`translate(${x} ${y})`}>
            <g className="art-stalk" style={{ animationDelay: `${(i % 5) * 0.35}s` }}>
              <line x1="0" y1="0" x2="0" y2={-h} stroke="#c9a227" strokeWidth="3" strokeLinecap="round" />
              {[0, 1, 2, 3, 4].map((k) => (
                <g key={k}>
                  <ellipse cx="-5" cy={-h + k * 8} rx="3.4" ry="7" fill="#e4bd3a" transform={`rotate(-24 -5 ${-h + k * 8})`} />
                  <ellipse cx="5" cy={-h + k * 8} rx="3.4" ry="7" fill="#e4bd3a" transform={`rotate(24 5 ${-h + k * 8})`} />
                </g>
              ))}
              <ellipse cx="0" cy={-h - 8} rx="3.4" ry="8" fill="#e4bd3a" />
            </g>
          </g>
        )
      })}
    </svg>
  )
}
