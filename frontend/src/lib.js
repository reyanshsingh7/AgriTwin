export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '')

export const DEFAULTS = {
  land_area_acres: 5,
  budget: 80000,
  water_availability: 'Medium',
  labour_availability: 'Medium',
  machinery_availability: 'Available',
  risk_preference: 'Medium',
}

export const PRESETS = {
  small: { land_area_acres: 2, budget: 40000, water_availability: 'Low', labour_availability: 'Low', machinery_availability: 'None', risk_preference: 'Low' },
  typical: DEFAULTS,
  large: { land_area_acres: 15, budget: 500000, water_availability: 'High', labour_availability: 'High', machinery_availability: 'Available', risk_preference: 'High' },
}

export const LEVEL_OPTIONS = ['Low', 'Medium', 'High']
export const MACHINERY_OPTIONS = ['None', 'Limited', 'Available']
export const BUDGET_STEPS = [25000, 50000, 100000, 250000]

/* Icon names used by components/Icon.jsx */
export const FIELD_ICON = { land: 'land', budget: 'rupee', water: 'water', labour: 'people', machinery: 'cog', risk: 'scale' }
export const CHECK_ICON = { budget: 'rupee', water: 'water', labour: 'people', machinery: 'cog' }

/* Optional real photos: drop files into frontend/public/images/ (see the README there).
   Missing files are handled gracefully, nothing breaks if a photo is absent. */
export const IMAGES = {
  hero: '/images/hero.jpg',
  crop: (name) => `/images/crops/${String(name).toLowerCase()}.jpg`,
}

export const inr = (v) => (v == null ? '—' : `₹${Math.round(Number(v)).toLocaleString('en-IN')}`)

export const compactInr = (v) => {
  if (v == null) return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2).replace(/\.?0+$/, '')} Cr`
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2).replace(/\.?0+$/, '')} L`
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`
}

// ROI comes from the backend (roi_pct, null when undefined)
export const roiOf = (item) => {
  const v = 'roi_pct' in item ? item.roi_pct : item.total_cost > 0 ? (item.expected_profit / item.total_cost) * 100 : null
  return v == null ? '—' : `${Math.round(v)}%`
}

export const riskBand = (score) => (score >= 40 ? 'High' : score >= 20 ? 'Medium' : 'Low')

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* ---- session persistence (device only; nothing is sent anywhere) ---- */
const KEY = 'agritwin-session'
export const loadSession = () => {
  try { return JSON.parse(sessionStorage.getItem(KEY)) || {} } catch { return {} }
}
export const saveSession = (data) => {
  try { sessionStorage.setItem(KEY, JSON.stringify(data)) } catch { /* ignore */ }
}

/* ---- API ---- */
export async function requestAnalysis(form) {
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
  return body
}
