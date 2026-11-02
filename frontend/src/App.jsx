import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { T } from './i18n.js'
import { DEFAULTS, IMAGES, loadSession, requestAnalysis, saveSession } from './lib.js'
import Analyzing from './components/Analyzing.jsx'
import { LogoMark } from './components/Photo.jsx'
import Home from './pages/Home.jsx'
import Results from './pages/Results.jsx'

/* Two "pages" on the same site, switched with the URL hash so the browser Back button works:
   #/         -> landing page + step-by-step form
   #/results  -> results page (only when a result exists) */
const parseRoute = () => (window.location.hash.startsWith('#/results') ? 'results' : 'home')
const goHome = () => { window.location.hash = '#/' }
const goResults = () => { window.location.hash = '#/results' }

export default function App() {
  const session = useMemo(loadSession, [])
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('agritwin-lang') || 'en' } catch { return 'en' }
  })
  const t = T[lang]
  const [route, setRoute] = useState(parseRoute)
  const [form, setForm] = useState(session.form || DEFAULTS)
  const [result, setResult] = useState(session.result || null)
  const [step, setStep] = useState(session.result ? 2 : 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const mainRef = useRef(null)
  const afterNav = useRef(null)

  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en'
    try { localStorage.setItem('agritwin-lang', lang) } catch { /* ignore */ }
  }, [lang])

  useEffect(() => {
    const onHash = () => setRoute(parseRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Results page needs a result (e.g. someone opened the link directly): send them home.
  const page = route === 'results' && result ? 'results' : 'home'
  useEffect(() => {
    if (route === 'results' && !result) window.history.replaceState(null, '', '#/')
    if (route === 'results' && !result) setRoute('home')
  }, [route, result])

  useEffect(() => {
    document.title = page === 'results' ? `${t.yourFarm} · AgriTwin` : `AgriTwin · ${t.heroTitle}`
    window.scrollTo(0, 0)
    if (afterNav.current) {
      const id = afterNav.current
      afterNav.current = null
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }))
    }
  }, [page, t.yourFarm, t.heroTitle])

  const analyze = async () => {
    setLoading(true)
    setError('')
    try {
      const body = await requestAnalysis(form)
      setResult(body)
      saveSession({ form, result: body })
      goResults()
    } catch (err) {
      setError(err instanceof TypeError ? t.offline : err.message || t.offline)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setForm(DEFAULTS)
    setResult(null)
    setStep(0)
    setError('')
    saveSession({})
  }
  const editFarm = () => { setStep(2); afterNav.current = 'plan'; goHome() }
  const newFarm = () => { reset(); afterNav.current = 'plan'; goHome() }
  const toggleLang = () => setLang(lang === 'en' ? 'hi' : 'en')

  const wizardProps = { form, setForm, step, setStep, onSubmit: analyze, onReset: reset, loading, error }

  return (
    <div className="app">
      <button type="button" className="skip" onClick={() => mainRef.current?.focus()}>{t.skip}</button>

      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand" onClick={goHome} aria-label="AgriTwin">
            <LogoMark size={38} />
            <span className="brand-text"><strong>AgriTwin</strong><span>{t.tagline}</span></span>
          </button>
          <button type="button" className="lang-btn" onClick={toggleLang} lang={lang === 'en' ? 'hi' : 'en'}>{t.lang}</button>
        </div>
      </header>

      <main className="page" id="main" ref={mainRef} tabIndex={-1}>
        <div className="route" key={page}>
          {page === 'results'
            ? <Results data={result} t={t} lang={lang} onEdit={editFarm} onNew={newFarm} />
            : <Home t={t} wizardProps={wizardProps} />}
        </div>
      </main>

      <footer className="footer">
        <p>{t.footerNote}</p>
        <p className="footer-line">
          <span>{t.footerBuilt}</span>
        </p>
      </footer>

      {loading && <Analyzing t={t} />}
    </div>
  )
}
