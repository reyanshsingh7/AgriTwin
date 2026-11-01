import { CHECK_ICON } from '../lib.js'
import { HeroArt, Reveal } from '../components/Art.jsx'
import Wizard from '../components/Wizard.jsx'

const TRUST_ICON = ['🧭', '🔍', '📊', '🔒']

export default function Home({ t, wizardProps }) {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <>
      <section className="hero2" aria-labelledby="hero-title">
        <div className="hero2-copy">
          <p className="hero-kicker" style={{ '--n': 0 }}>{t.heroKicker}</p>
          <h1 id="hero-title" style={{ '--n': 1 }}>{t.heroTitle}</h1>
          <p className="hero-text" style={{ '--n': 2 }}>{t.heroText}</p>
          <div className="hero-cta" style={{ '--n': 3 }}>
            <button type="button" className="primary cta" onClick={() => scrollTo('plan')}>{t.ctaStart} <span aria-hidden="true">→</span></button>
            <button type="button" className="ghost" onClick={() => scrollTo('how')}>{t.ctaHow}</button>
          </div>
          <ul className="trust-chips" style={{ '--n': 4 }}>
            {t.trustChips.map((c) => <li key={c}><span aria-hidden="true">✓</span> {c}</li>)}
          </ul>
        </div>

        <div className="hero2-visual" aria-hidden="true">
          <HeroArt />
          <span className="float-badge fb-1">💰 {t.checks.budget} ✓</span>
          <span className="float-badge fb-2">💧 {t.checks.water} ✓</span>
          <span className="float-badge fb-3">🚜 {t.checks.machinery} ✓</span>
        </div>
      </section>

      <section className="plan-section" id="plan" aria-label={t.formTitle}>
        <Reveal className="plan-wrap">
          <Wizard t={t} {...wizardProps} />
        </Reveal>
      </section>

      <section className="section" id="how" aria-labelledby="how-title">
        <Reveal as="h2" id="how-title" className="section-title">{t.howTitle}</Reveal>
        <ol className="how-grid">
          {t.howSteps.map(([title, text], i) => (
            <Reveal as="li" key={title} className="how-card" delay={i * 110}>
              <span className="how-num">{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="check-title">
        <Reveal as="h2" id="check-title" className="section-title">{t.checkTitle}</Reveal>
        <ul className="check-grid">
          {Object.entries(t.checkItems).map(([key, [name, text]], i) => (
            <Reveal as="li" key={key} className="check-tile" delay={i * 90}>
              <span className="check-tile-icon" aria-hidden="true">{CHECK_ICON[key]}</span>
              <strong>{name}</strong>
              <span>{text}</span>
            </Reveal>
          ))}
        </ul>
      </section>

      <section className="section trust" aria-labelledby="trust-title">
        <Reveal as="h2" id="trust-title" className="section-title">{t.trustTitle}</Reveal>
        <ul className="trust-grid">
          {t.trustItems.map(([title, text], i) => (
            <Reveal as="li" key={title} className="trust-card" delay={i * 90}>
              <span className="trust-icon" aria-hidden="true">{TRUST_ICON[i]}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
        <Reveal as="p" className="coverage">{t.coverage}</Reveal>
      </section>

      <Reveal as="section" className="cta-band">
        <div>
          <h2>{t.ctaBandTitle}</h2>
          <p>{t.ctaBandText}</p>
        </div>
        <button type="button" className="primary cta light" onClick={() => scrollTo('plan')}>{t.ctaStart} <span aria-hidden="true">→</span></button>
      </Reveal>
    </>
  )
}
