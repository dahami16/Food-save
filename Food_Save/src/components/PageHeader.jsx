import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import './PageHeader.css'

/**
 * PageHeader — the single reusable top header for Food Save.
 * One component serves all screens (Sign In, Create Account,
 * Filters, Account Settings, Add Food, Expiry Alarm, ...) —
 * no page-specific header variants.
 *
 * Layout: back arrow (left) · centred title · optional right
 * action. The title stays centred relative to the full header
 * width at 375 / 390 / 430px and inside the shared app shell
 * on desktop (no fixed positioning, no viewport-wide styles).
 *
 * Props:
 *   title       — page title text (required; never hard-coded)
 *   showBack    — show the back button (default true)
 *   onBack      — optional custom back handler; when omitted the
 *                 header navigates to the previous history entry
 *                 via navigate(-1)
 *   rightAction — optional React element rendered in the right
 *                 slot; when omitted, equal empty space keeps the
 *                 title perfectly centred
 *   className   — extra classes from the parent page
 *
 * Examples:
 *   <PageHeader title="Sign In" />
 *   <PageHeader title="Account" showBack={false} />
 *   <PageHeader title="Filters" onBack={() => navigate('/food')} />
 */
function PageHeader({
  title,
  showBack = true,
  onBack,
  rightAction = null,
  className = '',
}) {
  const navigate = useNavigate()

  // Custom handler wins; otherwise go back one history entry.
  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      navigate(-1)
    }
  }

  const rootClasses = ['page-header']
  if (className) rootClasses.push(className)

  return (
    <header className={rootClasses.join(' ')}>
      <div className="page-header__left">
        {showBack && (
          <button
            type="button"
            className="page-header__back-button"
            onClick={handleBack}
            aria-label="Go back"
          >
            <ArrowLeft size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      <h1 className="page-header__title">{title}</h1>

      <div className="page-header__right">{rightAction}</div>
    </header>
  )
}

export default PageHeader