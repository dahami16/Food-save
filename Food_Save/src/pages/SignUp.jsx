import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import FormField from '../components/FormField'
import PrimaryButton from '../components/PrimaryButton'
import SocialAuthButton from '../components/SocialAuthButton'
import { Alert, AlertTitle, AlertDescription, AlertAction } from '../components/ui/Alert'
import { useAuth } from '../context/AuthContext'
import './SignUp.css'

/**
 * Simple frontend-only validation — MVP-level.
 * Password minimum matches the backend SignupRequest schema (8 chars).
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateFullName(value) {
  if (!value.trim()) return 'Full name is required.'
  if (value.trim().length < 2) return 'Please enter a valid full name.'
  return ''
}

function validateEmail(value) {
  if (!value.trim()) return 'Email address is required.'
  if (!EMAIL_PATTERN.test(value.trim())) {
    return 'Please enter a valid email address.'
  }
  return ''
}

function validatePassword(value) {
  if (!value) return 'Password is required.'
  if (value.length < 8) return 'Password must be at least 8 characters.'
  return ''
}

/**
 * SignUp — Create Account screen (/signup).
 *
 * Reuses PageHeader, FormField, PrimaryButton, SocialAuthButton and
 * the shared Alert for the confirmation state.
 * Stage 3A: real signup through POST /api/auth/signup with
 * full_name / email / password. The client can never choose a role.
 * When the backend returns session: null, email confirmation may be
 * required — the page shows a success message and the user is NOT
 * treated as authenticated. A returned session is validated through
 * GET /api/auth/me before the user is signed in.
 */
function SignUp() {
  const navigate = useNavigate()
  const { signup } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const fullNameIsValid = validateFullName(fullName) === ''
  const emailIsValid = validateEmail(email) === ''

  // Clear a field's error as the user corrects it.
  const handleFullNameChange = (event) => {
    setFullName(event.target.value)
    setErrors((prev) => ({ ...prev, fullName: undefined }))
    setAuthError('')
  }

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
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      password: validatePassword(password),
    }

    if (nextErrors.fullName || nextErrors.email || nextErrors.password) {
      setErrors(nextErrors)
      setAuthError('')
      return
    }

    setSubmitting(true)
    setAuthError('')
    try {
      const result = await signup(fullName.trim(), email.trim(), password)

      if (result.requiresConfirmation) {
        // session: null — no authenticated session was created.
        setSuccessMessage(
          'Your account was created! Check your email to confirm your address, then sign in.'
        )
        return
      }

      // A real session was returned AND /me validated the profile.
      const profile = result.user
      navigate(profile && profile.role === 'admin' ? '/admin' : '/restaurants')
    } catch (error) {
      setAuthError(
        (error && error.message) || 'Unable to create your account. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Social sign-up is not wired up in this stage: show an honest,
  // non-authenticating notice instead of a fake session.
  function handleSocialSignUp() {
    setAuthError('Social sign-up is not available yet. Please use the form above.')
  }

  return (
    <main className="sign-up-page">
      <PageHeader
        title="Sign Up"
        onBack={() => navigate('/signin')}
      />

      <section className="sign-up-page__content">
        <h1 className="sign-up-page__heading">Create Account</h1>

        <p className="sign-up-page__intro">
          <span className="sign-up-page__intro-text">
            Enter your Name, Email and Password for sign up.
          </span>{' '}
          <button
            type="button"
            className="sign-up-page__signin-link"
            onClick={() => navigate('/signin')}
          >
            Already have account?
          </button>
        </p>

        {successMessage ? (
          /* No session was returned: confirm account creation and let
             the user continue to Sign In (they are NOT logged in). */
          <Alert className="sign-up-page__success">
            <AlertTitle>Account created</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
            <AlertAction onClick={() => navigate('/signin')}>
              Go to Sign In
            </AlertAction>
          </Alert>
        ) : (
          <>
            <form
              className="sign-up-page__form"
              onSubmit={handleSubmit}
              noValidate
            >
              <FormField
                label="Full Name"
                name="fullName"
                type="text"
                value={fullName}
                onChange={handleFullNameChange}
                error={errors.fullName}
                showSuccess={fullNameIsValid}
                autoComplete="name"
              />

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
                autoComplete="new-password"
              />

              {authError && (
                <p className="sign-up-page__auth-error" role="alert">
                  {authError}
                </p>
              )}

              <PrimaryButton type="submit" disabled={submitting}>
                {submitting ? 'Creating Account…' : 'Sign Up'}
              </PrimaryButton>
            </form>

            <p className="sign-up-page__terms">
              By Signing up you agree to our Terms Conditions & Privacy
              Policy.
            </p>

            <p className="sign-up-page__or">Or</p>

            <div className="sign-up-page__social">
              <SocialAuthButton
                provider="facebook"
                onClick={handleSocialSignUp}
              />
              <SocialAuthButton
                provider="google"
                onClick={handleSocialSignUp}
              />
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default SignUp