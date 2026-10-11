import { useId, useState } from 'react'
import { Check, Eye, EyeOff } from 'lucide-react'
import './FormField.css'

/**
 * FormField — the single reusable underline-style input for
 * Food Save. One component covers text, email, password, tel
 * and date inputs through props (no per-field components).
 *
 * Controlled component: the parent owns the value via
 * `value` + `onChange`. The ONLY local state FormField keeps
 * is the password show/hide toggle.
 *
 * The parent owns all validation: it decides when to pass
 * `error` (hides the success icon) or `showSuccess` (shows the
 * primary-coloured Check). FormField contains no page-specific
 * validation logic.
 *
 * Props:
 *   label        — label text above the input (rendered uppercase via CSS)
 *   name         — input name attribute
 *   value        — controlled value (parent state)
 *   onChange     — change handler, receives the input event
 *   placeholder  — optional placeholder (none if omitted)
 *   type         — "text" (default) | "email" | "password" | "tel" | "date"
 *   error        — error message; shows error text + red underline,
 *                  hides the success icon
 *   helperText   — optional neutral helper text under the underline
 *   required     — passed to the input (semantic)
 *   disabled     — disables the input
 *   autoComplete — browser autocomplete hint (e.g. "email", "new-password")
 *   inputMode    — mobile keyboard hint (e.g. "numeric")
 *   showSuccess  — true: show the Check success icon (non-password
 *                  fields only, hidden while an error exists)
 *   className    — extra classes from the parent page
 *
 * Password behaviour (type="password"):
 *   - starts hidden, effective type "password"
 *   - EyeOff shown while hidden, Eye while visible
 *   - toggle is a real <button type="button"> (never submits forms)
 *   - the password VALUE stays controlled by the parent
 */
function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = 'text',
  error = '',
  helperText = '',
  required = false,
  disabled = false,
  autoComplete,
  inputMode,
  showSuccess = false,
  className = '',
}) {
  // Only local state allowed inside FormField: password visibility.
  const [showPassword, setShowPassword] = useState(false)

  const inputId = useId()
  const errorId = `${inputId}-error`
  const helperId = `${inputId}-helper`

  const isPassword = type === 'password'
  const effectiveType = isPassword && showPassword ? 'text' : type

  // Right-side icon: the password toggle has priority over the
  // success Check so the two can never overlap.
  let rightIcon = null
  if (isPassword) {
    rightIcon = (
      <button
        type="button"
        className="form-field__password-toggle"
        onClick={() => setShowPassword((visible) => !visible)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        aria-pressed={showPassword}
      >
        {showPassword ? (
          <Eye size={20} strokeWidth={2} aria-hidden="true" />
        ) : (
          <EyeOff size={20} strokeWidth={2} aria-hidden="true" />
        )}
      </button>
    )
  } else if (showSuccess && !error && !disabled) {
    rightIcon = (
      <Check
        className="form-field__icon form-field__success-icon"
        size={20}
        strokeWidth={2.5}
        aria-hidden="true"
      />
    )
  }

  const rootClasses = ['form-field']
  if (error) rootClasses.push('form-field--error')
  if (className) rootClasses.push(className)

  const describedBy = error ? errorId : helperText ? helperId : undefined

  return (
    <div className={rootClasses.join(' ')}>
      <label className="form-field__label" htmlFor={inputId}>
        {label}
      </label>

      <div className="form-field__input-wrapper">
        <input
          id={inputId}
          name={name}
          className="form-field__input"
          type={effectiveType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {rightIcon}
      </div>

      {error ? (
        <p className="form-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : (
        helperText && (
          <p className="form-field__helper" id={helperId}>
            {helperText}
          </p>
        )
      )}
    </div>
  )
}

export default FormField