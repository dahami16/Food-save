import './Alert.css'

/**
 * Alert — adapted from the 21st.dev Alert component (its canonical
 * icon + title + description structure) to JavaScript + plain CSS
 * for the Food Save project.
 *
 * Adaptations from the original:
 *   - TypeScript types and forwardRef removed (plain JS function
 *     components; React 19 passes refs through {...props})
 *   - class-variance-authority / cn / Tailwind classes replaced
 *     with plain CSS classes in Alert.css
 *   - the shadcn Button dependency is NOT used; the small
 *     AlertAction helper below provides the success action
 *   - colours follow Food Save tokens (#FFFFFF, #010F07,
 *     #868686, #EEA734 accent) via Alert.css
 *
 * Exports (same names as the original component):
 *   Alert            — root container, keeps role="alert"
 *   AlertTitle       — heading
 *   AlertDescription — supporting text
 *   AlertAction      — optional action button (Food Save addition)
 *
 * Styling uses the plain food-alert BEM classes in Alert.css
 * (no Tailwind, no class-variance-authority). Expected composition:
 *
 *   <Alert>
 *     <div className="food-alert__row">
 *       <CircleCheck className="food-alert__icon" aria-hidden="true" />
 *       <div className="food-alert__content">
 *         <AlertTitle>…</AlertTitle>
 *         <AlertDescription>…</AlertDescription>
 *       </div>
 *     </div>
 *     <AlertAction>…</AlertAction>   (or any action element)
 *   </Alert>
 */
function Alert({ className = '', children, ...props }) {
  const classes = ['food-alert', 'food-alert--success']
  if (className) classes.push(className)

  return (
    <div role="alert" className={classes.join(' ')} {...props}>
      {children}
    </div>
  )
}

function AlertTitle({ className = '', children, ...props }) {
  const classes = ['food-alert__title']
  if (className) classes.push(className)

  return (
    <h5 className={classes.join(' ')} {...props}>
      {children}
    </h5>
  )
}

function AlertDescription({ className = '', children, ...props }) {
  const classes = ['food-alert__description']
  if (className) classes.push(className)

  return (
    <div className={classes.join(' ')} {...props}>
      {children}
    </div>
  )
}

function AlertAction({ className = '', children, ...props }) {
  const classes = ['food-alert__action']
  if (className) classes.push(className)

  return (
    <button type="button" className={classes.join(' ')} {...props}>
      {children}
    </button>
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }