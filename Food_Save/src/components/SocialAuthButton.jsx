import facebookIcon from '../assets/facebook.svg'
import googleIcon from '../assets/google.svg'
import './SocialAuthButton.css'

/**
 * Provider configuration — one small map drives everything that
 * differs between the two buttons: default label, brand icon and
 * CSS modifier. One shared JSX structure renders both variants.
 */
const providerConfig = {
  facebook: {
    label: 'Connect with Facebook', // rendered uppercase via CSS
    icon: facebookIcon,
    className: 'social-auth-button--facebook',
  },
  google: {
    label: 'Connect with Google',
    icon: googleIcon,
    className: 'social-auth-button--google',
  },
}

/**
 * SocialAuthButton — the single reusable social sign-in button for
 * Food Save (Sign In + Create Account pages later).
 *
 * Frontend-only MVP UI: no OAuth, no Facebook/Google APIs, no API
 * keys, no backend, no external login pages. The parent decides
 * what a click does via onClick.
 *
 * Props:
 *   provider  — "facebook" | "google" (required): selects
 *               background colour, brand icon and default label
 *   onClick   — parent-provided click handler
 *   label     — optional label override (e.g. "Continue with Google");
 *               rendered uppercase via CSS
 *   type      — "button" (default) | "submit" | "reset"
 *   disabled  — disables the button (default false)
 *   className — extra classes from the parent page
 *
 * Examples:
 *   <SocialAuthButton provider="facebook" onClick={handleFacebookLogin} />
 *   <SocialAuthButton provider="google" onClick={handleGoogleLogin} />
 *   <SocialAuthButton provider="google" label="Continue with Google" />
 */
function SocialAuthButton({
  provider,
  onClick,
  label,
  type = 'button',
  disabled = false,
  className = '',
}) {
  const config = providerConfig[provider]

  // Unknown/missing provider: render nothing rather than a broken button.
  if (!config) return null

  const classes = ['social-auth-button', config.className]
  if (className) classes.push(className)

  return (
    <button
      type={type}
      className={classes.join(' ')}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="social-auth-button__icon-wrapper">
        {/* Decorative — the label text identifies the provider */}
        <img
          className="social-auth-button__icon"
          src={config.icon}
          alt=""
        />
      </span>
      <span className="social-auth-button__label">{label ?? config.label}</span>
    </button>
  )
}

export default SocialAuthButton