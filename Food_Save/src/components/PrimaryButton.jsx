import './PrimaryButton.css'

/**
 * PrimaryButton — the main reusable action button for Food Save.
 *
 * Reused across screens (Welcome, Free Delivery, Sign In, Create
 * Account, Filters, Add Food, Food Added Successfully, ...).
 *
 * Reusability rules:
 *   - Button text comes from the parent via `children` (rendered
 *     uppercase automatically through CSS — parents write normal text).
 *   - No React Router navigation, route names, page-specific text,
 *     page-specific business logic or hard-coded click actions.
 *     The parent provides onClick (and/or type="submit").
 *
 * Props:
 *   children   — button label/content (required)
 *   onClick    — click handler (optional)
 *   type       — "button" (default) | "submit" | "reset"
 *   disabled   — disables the button (default false)
 *   fullWidth  — true: fill the parent width instead of the
 *                335px Figma max-width; never overflows the parent
 *   className  — extra classes from the parent page (optional)
 *
 * Example:
 *   <PrimaryButton onClick={handleGetStarted}>Get Started</PrimaryButton>
 *   <PrimaryButton type="submit">Sign In</PrimaryButton>
 */
function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  fullWidth = false,
  className = '',
}) {
  const classes = ['primary-button']
  if (fullWidth) classes.push('primary-button--full-width')
  if (className) classes.push(className)

  return (
    <button
      type={type}
      className={classes.join(' ')}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export default PrimaryButton