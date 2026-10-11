import { useNavigate } from 'react-router-dom'
import PrimaryButton from '../components/PrimaryButton'
import logo from '../assets/Logo.svg'
import circleBackground from '../assets/Circle_Background.svg'
import illustration from '../assets/Illustration_1.svg'
import './Welcome.css'

/**
 * Welcome — root screen (/).
 *
 * Visual order: decorative circle background (behind, upper-left,
 * 10% opacity) → Logo + "Food Save" brand group → main
 * illustration → Welcome heading → description → GET STARTED.
 *
 * Figma reference 375×812 (design-reference/01-welcome.png).
 * Layout is responsive flow (flex + margins + vh clamps) that
 * reproduces the 375px targets without pixel-locked positioning.
 */
function Welcome() {
  const navigate = useNavigate()

  // Navigation lives in the page, not inside PrimaryButton.
  const handleGetStarted = () => {
    navigate('/delivery')
  }

  return (
    <main className="welcome-page">
      {/* Decorative artwork — cropped toward the upper-left, never interactive */}
      <img
        className="welcome-page__circle"
        src={circleBackground}
        alt=""
        aria-hidden="true"
      />

      <section className="welcome-page__brand">
        <img className="welcome-page__logo" src={logo} alt="Food Save" />
        <span className="welcome-page__brand-name">Food Save</span>
      </section>

      <img
        className="welcome-page__illustration"
        src={illustration}
        alt="Food Save welcome illustration"
      />

      <section className="welcome-page__content">
        <h1 className="welcome-page__heading">Welcome</h1>
        <p className="welcome-page__description">
          It’s a pleasure to meet you. We are excited that you’re here so
          let’s get started!
        </p>
        <PrimaryButton onClick={handleGetStarted}>Get Started</PrimaryButton>
      </section>
    </main>
  )
}

export default Welcome