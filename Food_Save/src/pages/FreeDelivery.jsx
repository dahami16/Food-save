import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PrimaryButton from '../components/PrimaryButton'
import logo from '../assets/Logo.svg'
import deliveryIllustration from '../assets/Illustrations_2.svg'
import './FreeDelivery.css'

/**
 * Onboarding offers shown under the fixed "Free delivery offers"
 * heading. Page-local UI data — not shared app state.
 */
const offers = [
  {
    id: 1,
    description:
      'Free delivery for new customers via Apple Pay and others payment methods.',
  },
  {
    id: 2,
    description:
      'Enjoy special discounts on selected meals from nearby restaurants.',
  },
  {
    id: 3,
    description:
      'Discover more food-saving offers and help reduce food waste.',
  },
]

/**
 * FreeDelivery — onboarding screen (/delivery).
 *
 * Visual order: Logo + "Food Save" brand group → delivery
 * illustration → "Free delivery offers" heading → one offer
 * description at a time → three clickable indicator dots →
 * GET STARTED (PrimaryButton) → /signin.
 *
 * activeOffer is page-local useState (0 | 1 | 2); clicking a dot
 * switches the visible description and moves the green active
 * indicator. No automatic rotation in the MVP.
 */
function FreeDelivery() {
  const navigate = useNavigate()
  const [activeOffer, setActiveOffer] = useState(0)

  const handleGetStarted = () => {
    navigate('/signin')
  }

  return (
    <main className="free-delivery-page">
      <section className="free-delivery-page__brand">
        <img className="free-delivery-page__logo" src={logo} alt="Food Save" />
        <span className="free-delivery-page__brand-name">Food Save</span>
      </section>

      <img
        className="free-delivery-page__illustration"
        src={deliveryIllustration}
        alt="Food delivery scooter illustration"
      />

      <section className="free-delivery-page__content">
        <h1 className="free-delivery-page__heading">Free delivery offers</h1>

        <p className="free-delivery-page__description">
          {offers[activeOffer].description}
        </p>

        <div className="free-delivery-page__indicators">
          {offers.map((offer, index) => (
            <button
              key={offer.id}
              type="button"
              className={`free-delivery-page__dot${
                index === activeOffer ? ' free-delivery-page__dot--active' : ''
              }`}
              onClick={() => setActiveOffer(index)}
              aria-label={`Show offer ${offer.id}`}
              aria-current={index === activeOffer ? 'true' : undefined}
            />
          ))}
        </div>

        <PrimaryButton onClick={handleGetStarted}>Get Started</PrimaryButton>
      </section>
    </main>
  )
}

export default FreeDelivery