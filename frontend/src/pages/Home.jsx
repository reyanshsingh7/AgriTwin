import { CHECK_ICON, IMAGES } from '../lib.js'
import Icon from '../components/Icon.jsx'
import { OptionalPhoto } from '../components/Photo.jsx'
import Wizard from '../components/Wizard.jsx'

export default function Home({ t, wizardProps }) {
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const startNow = () => {
    scrollTo('plan')
    setTimeout(() => document.querySelector('#plan input, #plan h2')?.focus({ preventScroll: true }), 350)
  }

  return (
    <>
      <div className="home-top">
        <div className="home-left">
          <section className="hero" aria-labelledby="hero-title">
            <p className="hero-kicker">{t.heroKicker}</p>
            <h1 id="hero-title">{t.heroTitle}</h1>
            <p className="hero-text">{t.heroText}</p>
            <div className="hero-cta">
              <button type="button" className="primary cta" onClick={startNow}>{t.ctaStart}</button>
              <button type="button" className="link-btn" onClick={() => scrollTo('how')}>{t.ctaHow}</button>
            </div>
            <p className="hero-note">{t.heroNote}</p>
          </section>
          {/* Real photo: add frontend/public/images/hero.jpg. If it is missing this simply disappears. */}
          <OptionalPhoto src={IMAGES.hero} alt={t.photoAlt} className="hero-img" />
        </div>

        <section className="plan-section" id="plan" aria-label={t.formTitle}>
          <Wizard t={t} {...wizardProps} />
        </section>
      </div>

      <section className="info" id="how" aria-labelledby="how-title">
        <h2 id="how-title">{t.howTitle}</h2>
        <ol className="how-list">
          {t.howSteps.map(([title, text], i) => (
            <li key={title}>
              <span className="how-num">{i + 1}</span>
              <div><h3>{title}</h3><p>{text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="info" aria-labelledby="check-title">
        <h2 id="check-title">{t.checkTitle}</h2>
        <ul className="check-list">
          {Object.entries(t.checkItems).map(([key, [name, text]]) => (
            <li key={key}>
              <Icon name={CHECK_ICON[key]} size={22} />
              <div><strong>{name}</strong><span>{text}</span></div>
            </li>
          ))}
        </ul>
      </section>

      <section className="info about" aria-labelledby="about-title">
        <h2 id="about-title">{t.aboutTitle}</h2>
        <p>{t.aboutText}</p>
      </section>
    </>
  )
}
