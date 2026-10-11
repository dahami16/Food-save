import { Link, useLocation } from 'react-router-dom'
import { ReceiptText, Search, UserRound, Utensils } from 'lucide-react'
import './BottomNavigation.css'

/**
 * BottomNavigation — reusable primary bottom navigation bar.
 *
 * Matches the supplied bottom-navigation Figma sample: four evenly
 * distributed items (icon above label) on a white 88px bar with a
 * subtle top shadow. The black iPhone home-indicator strip from the
 * reference SVG is device UI and is deliberately NOT recreated.
 *
 * Functional items (React Router navigation, active-route aware):
 *   Search -> /food     active when pathname === "/food"
 *   Profile -> /account active when pathname === "/account"
 *
 * Presentation-only items (no routes exist yet, no navigation):
 *   Home (Utensils icon — food style, per the Figma sample)
 *   Orders (ReceiptText icon)
 * They still respond to hover/focus colours but use cursor: default.
 *
 * Colours: default #868686, hover/focus/active #EEA734 (see CSS).
 *
 * This is our own reusable component (lucide-react icons). The
 * project's compulsory 21st.dev component is the Scroll Area and is
 * unrelated to this component.
 */
const cx = (...classes) => classes.filter(Boolean).join(' ')

function BottomNavigation() {
  const { pathname } = useLocation()

  // Active-route detection: state reflects the current URL, never a
  // transient hover. Search owns the food/search area, Profile the
  // account area.
  const isSearchActive = pathname === '/food'
  const isProfileActive = pathname === '/account'

  return (
    <nav className="bottom-navigation" aria-label="Primary">
      {/* Home — presentation-only until the Home tab exists */}
      <div className="bottom-navigation__item bottom-navigation__item--static">
        <Utensils size={22} strokeWidth={1.5} aria-hidden="true" />
        <span className="bottom-navigation__label">Home</span>
      </div>

      {/* Search — functional: navigates to /food */}
      <Link
        to="/food"
        className={cx(
          'bottom-navigation__item',
          isSearchActive && 'bottom-navigation__item--active'
        )}
        aria-label="Search"
        aria-current={isSearchActive ? 'page' : undefined}
      >
        <Search size={22} strokeWidth={1.5} aria-hidden="true" />
        <span className="bottom-navigation__label">Search</span>
      </Link>

      {/* Orders — presentation-only until the Orders tab exists */}
      <div className="bottom-navigation__item bottom-navigation__item--static">
        <ReceiptText size={22} strokeWidth={1.5} aria-hidden="true" />
        <span className="bottom-navigation__label">Orders</span>
      </div>

      {/* Profile — functional: navigates to /account */}
      <Link
        to="/account"
        className={cx(
          'bottom-navigation__item',
          isProfileActive && 'bottom-navigation__item--active'
        )}
        aria-label="Profile"
        aria-current={isProfileActive ? 'page' : undefined}
      >
        <UserRound size={22} strokeWidth={1.5} aria-hidden="true" />
        <span className="bottom-navigation__label">Profile</span>
      </Link>
    </nav>
  )
}

export default BottomNavigation
