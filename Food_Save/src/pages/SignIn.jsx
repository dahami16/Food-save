import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import FormField from '../components/FormField'
import PrimaryButton from '../components/PrimaryButton'
import SocialAuthButton from '../components/SocialAuthButton'
import { useAuth } from '../context/AuthContext'
import './SignIn.css'

/**
 * Simple frontend-only email validation.
 * Required + basic format — MVP-level, not enterprise validation.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(value) {
  if (!value.trim()) return 'Email address is required.'
  if (!EMAIL_PATTERN.test(value.trim())) {
    return 'Please enter a valid email address.'
  }
  return ''
}

function validatePassword(value) {
  if (!value) return 'Password is required.'
  if (value.length < 6) return 'Password must be at least 6 characters.'
  return ''
}

/**
 * SignIn — onboarding auth screen (/signin).
 *
 * Reuses PageHeader, FormField, PrimaryButton and SocialAuthButton.
 * Stage 3A: real authentication through the FastAPI backend
 * (POST /api/auth/login, then GET /api/auth/me to load the trusted
 * profile). Navigation uses the trusted profile role:
 *   customer -> /restaurants
 *   admin    -> /admin
 * Incorrect credentials / network failures show a compact page-level
 * error. Mock demo credentials are NOT used as a fallback.
 */
function SignIn() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [authError, setAuthError] = useState('')
  const [forgotMessage, setForgotMessage] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const emailIsValid = validateEmail(email) === ''

  // Clear a field's error as the user corrects it.
  const handleEmailChange = (event) => {
    setEmail(event.target.value)
    setErrors((prev) => ({ ...prev, email: undefined }))
    setAuthError('')
  }

  const handlePasswordChange = (event) => {
    setPassword(event.target.value)
    setErrors((prev) => ({ ...prev, password: undefined }))
    setAuthError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    // Prevent duplicate submissions while a request is in flight.
    if (submitting) return

    const nextErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    }

    if (nextErrors.email || nextErrors.password) {
      setErrors(nextErrors)
      setAuthError('')
      return
    }

    setSubmitting(true)
    setAuthError('')
    try {
      // Real backend auth: login -> store token -> load /me profile.
      const profile = await login(email.trim(), password)
      // Role comes only from the trusted /me profile.
      navigate(profile.role === 'admin' ? '/admin' : '/restaurants')
    } catch (error) {
      setAuthError(
        (error && error.message) || 'Unable to sign in. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Social sign-in is not wired up in this stage: show an honest,
  // non-authenticating notice instead of a fake session.
  function handleSocialSignIn() {
    setAuthError('Social sign-in is not available yet. Please use your email and password.')
  }

  return (
    <main className="sign-in-page">
      <PageHeader
        title="Sign In"
        onBack={() => navigate('/delivery')}
      />

      <section className="sign-in-page__content">
        <h1 className="sign-in-page__title">Food Save</h1>

        <p className="sign-in-page__description">
          Enter your Phone number or Email address for sign in. Enjoy your
          food :)
        </p>

        <form className="sign-in-page__form" onSubmit={handleSubmit} noValidate>
          <FormField
            label="Email Address"
            name="email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            error={errors.email}
            showSuccess={emailIsValid}
            autoComplete="email"
          />

          <FormField
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            error={errors.password}
            autoComplete="current-password"
          />

          <button
            type="button"
            className="sign-in-page__forgot"
            onClick={() => setForgotMessage(true)}
          >
            Forget Password?
          </button>

          {forgotMessage && (
            <p className="sign-in-page__forgot-note" role="status">
              Password recovery is not available in this MVP.
            </p>
          )}

          {authError && (
            <p className="sign-in-page__auth-error" role="alert">
              {authError}
            </p>
          )}

          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? 'Signing In…' : 'Sign In'}
          </PrimaryButton>
        </form>

        <p className="sign-in-page__create-row">
          Don’t have account?{' '}
          <button
            type="button"
            className="sign-in-page__create-link"
            onClick={() => navigate('/signup')}
          >
            Create new account.
          </button>
        </p>

        <p className="sign-in-page__divider">Or</p>

        <div className="sign-in-page__social">
          <SocialAuthButton
            provider="facebook"
            onClick={handleSocialSignIn}
          />
          <SocialAuthButton
            provider="google"
            onClick={handleSocialSignIn}
          />
        </div>
      </section>
    </main>
  )
}

export default SignIn