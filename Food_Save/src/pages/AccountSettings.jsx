import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserRound,
  LockKeyhole,
  CreditCard,
  MapPin,
  Share2,
  Bell,
  Star,
  BookOpen,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { FaFacebookF } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import ScrollArea from '../components/ui/ScrollArea'
import BottomNavigation from '../components/BottomNavigation'
import './AccountSettings.css'

/**
 * Account Settings (Profile) page — route /account
 * Reference: design-reference/07-account-settings.png
 *
 * Structure:
 *   Account Settings title + description
 *   → account rows (Profile Information … Refer to Friends)
 *   → NOTIFICATIONS section (3 independent toggles)
 *   → MORE section (Rate Us, FAQ, Logout)
 *   → BottomNavigation (outside the ScrollArea)
 *
 * Logout reuses the AuthContext logout() action (clears the stored
 * access token and the current user — single auth implementation),
 * then navigates to /signin. No server-side session revocation is
 * claimed: this stage has no backend logout endpoint.
 */

const NOTIFICATION_SUBTITLE = 'For daily update you will get it'

const ACCOUNT_SETTING_ROWS = [
  {
    id: 'profile-information',
    icon: UserRound,
    title: 'Profile Information',
    subtitle: 'Change your account information',
  },
  {
    id: 'change-password',
    icon: LockKeyhole,
    title: 'Change Password',
    subtitle: 'Change your password',
  },
  {
    id: 'payment-methods',
    icon: CreditCard,
    title: 'Payment Methods',
    subtitle: 'Add your credit & debit cards',
  },
  {
    id: 'locations',
    icon: MapPin,
    title: 'Locations',
    subtitle: 'Add or remove your delivery locations',
  },
  {
    id: 'add-social-account',
    icon: FaFacebookF,
    title: 'Add Social Account',
    subtitle: 'Add Facebook, Twitter etc',
  },
  {
    id: 'refer-to-friends',
    icon: Share2,
    title: 'Refer to Friends',
    subtitle: 'Get $10 for reffering friends',
  },
]

/**
 * One settings row: icon + title (+ optional subtitle) + optional
 * chevron. Rows with onClick render as a real <button>; rows whose
 * destination pages do not exist yet render as non-interactive
 * <div> rows (visually identical, no fake routes).
 */
function SettingsRow({ icon: Icon, iconClassName = '', title, subtitle = null, showChevron = false, onClick }) {
  const body = (
    <>
      <Icon className={`settings-row__icon ${iconClassName}`.trim()} aria-hidden="true" />
      <span className="settings-row__text">
        <span className="settings-row__title">{title}</span>
        {subtitle ? <span className="settings-row__subtitle">{subtitle}</span> : null}
      </span>
      {showChevron ? <ChevronRight className="settings-row__chevron" aria-hidden="true" /> : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="settings-row" onClick={onClick}>
        {body}
      </button>
    )
  }
  return <div className="settings-row">{body}</div>
}

/**
 * Notification row with an accessible toggle switch. Each row owns
 * its own checked state passed in from the page — toggles are fully
 * independent of each other.
 */
function NotificationRow({ title, checked, onChange }) {
  return (
    <div className="settings-row">
      <Bell className="settings-row__icon" aria-hidden="true" />
      <span className="settings-row__text">
        <span className="settings-row__title">{title}</span>
        <span className="settings-row__subtitle">{NOTIFICATION_SUBTITLE}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        className="notification-toggle"
        onClick={onChange}
      >
        <span className="notification-toggle__thumb" />
      </button>
    </div>
  )
}

export default function AccountSettings() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  // Local toggle state (initial states match the reference design)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(false)
  const [promotionalNotifications, setPromotionalNotifications] = useState(true)

  function handleLogout() {
    // Clears the stored access token + current user (AuthContext),
    // which also resets the legacy AppContext session state, then
    // returns to Sign In. No reload, no window.location.
    logout()
    navigate('/signin', { replace: true })
  }

  return (
    <main className="account-settings-page">
      {/* 21st.dev ScrollArea — flex:1 so it always fills the space
          above BottomNavigation (no fixed pixel height). */}
      <ScrollArea orientation="vertical" className="account-settings-page__scroll">
        <div className="account-settings-page__content">
          <header className="account-settings-page__intro">
            <h1 className="account-settings-page__title">Account Settings</h1>
            <p className="account-settings-page__description">
              Update your settings like notifications, payments, profile edit etc.
            </p>
          </header>

          <section className="settings-section settings-section--main" aria-label="Account settings">
            {ACCOUNT_SETTING_ROWS.map((row) => (
              <SettingsRow
                key={row.id}
                icon={row.icon}
                title={row.title}
                subtitle={row.subtitle}
                showChevron
              />
            ))}
          </section>

          <section className="settings-section" aria-labelledby="notifications-heading">
            <h2 id="notifications-heading" className="settings-section__heading">
              NOTIFICATIONS
            </h2>
            <NotificationRow
              title="Push Notifications"
              checked={pushNotifications}
              onChange={() => setPushNotifications((value) => !value)}
            />
            <NotificationRow
              title="SMS Notifications"
              checked={smsNotifications}
              onChange={() => setSmsNotifications((value) => !value)}
            />
            <NotificationRow
              title="Promotional Notifications"
              checked={promotionalNotifications}
              onChange={() => setPromotionalNotifications((value) => !value)}
            />
          </section>

          <section className="settings-section" aria-labelledby="more-heading">
            <h2 id="more-heading" className="settings-section__heading">
              MORE
            </h2>
            <SettingsRow
              icon={Star}
              iconClassName="settings-row__icon--star"
              title="Rate Us"
              subtitle="Rate us playstore, appstor"
              showChevron
            />
            <SettingsRow
              icon={BookOpen}
              title="FAQ"
              subtitle="Frequently asked questions"
              showChevron
            />
            <SettingsRow icon={LogOut} title="Logout" showChevron onClick={handleLogout} />
          </section>
        </div>
      </ScrollArea>

      {/* Outside the ScrollArea — Profile item auto-activates on /account */}
      <BottomNavigation />
    </main>
  )
}