import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImageOff } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../context/AuthContext'
import {
  FoodApiError,
  adminListFood,
  updateFood,
} from '../../services/foodApi'
import { formatExpiryDate } from '../../data/adminProducts'
import { isExpiredIsoDate } from '../../utils/format'
import './ExpiryAlarm.css'

/**
 * ExpiryAlarm — Hotel Admin screen (/admin/expiry-alarm), integrated
 * with GET /api/admin/food (Stage 3C).
 *
 * Lists the LIVE backend records (expired included) with an
 * independent reminder toggle per item. Toggling PATCHes
 * /api/admin/food/{id} with ONLY reminder_enabled (multipart, Bearer
 * token) and rolls back locally if the backend rejects the change.
 * Loading, error (with retry), empty and expired states are handled;
 * 401 signs out via AuthContext, 403 shows an access-denied message.
 */
function ExpiryAlarm() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null) // { status, message }
  const [status, setStatus] = useState(null) // { tone, text }
  const [busyIds, setBusyIds] = useState(() => new Set())

  const loadItems = useCallback(async (signal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminListFood()
      if (!signal?.aborted) setItems(data.items ?? [])
    } catch (apiError) {
      if (signal?.aborted) return
      if (apiError instanceof FoodApiError && apiError.status === 401) {
        logout()
        return
      }
      setItems([])
      setError({
        status: apiError instanceof FoodApiError ? apiError.status : null,
        message:
          apiError instanceof FoodApiError
            ? apiError.message
            : 'Something went wrong. Please try again.',
      })
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    const controller = new AbortController()
    loadItems(controller.signal)
    return () => controller.abort()
  }, [loadItems])

  /** Optimistic flip; PATCH only reminder_enabled, rollback on failure. */
  async function handleToggleReminder(item) {
    if (busyIds.has(item.id)) return
    const nextValue = !(item.reminder_enabled !== false)

    setBusyIds((prev) => new Set(prev).add(item.id))
    setStatus(null)
    setItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id
          ? { ...entry, reminder_enabled: nextValue }
          : entry
      )
    )

    try {
      const formData = new FormData()
      formData.append('reminder_enabled', String(nextValue))
      const saved = await updateFood(item.id, formData)
      setItems((prev) =>
        prev.map((entry) => (entry.id === item.id ? saved : entry))
      )
    } catch (apiError) {
      // Roll the toggle back to the server's known state.
      setItems((prev) =>
        prev.map((entry) =>
          entry.id === item.id
            ? { ...entry, reminder_enabled: !nextValue }
            : entry
        )
      )
      if (apiError instanceof FoodApiError && apiError.status === 401) {
        logout()
        return
      }
      setStatus({
        tone: 'error',
        text:
          apiError instanceof FoodApiError
            ? apiError.message
            : 'Something went wrong. Please try again.',
      })
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }
  }

  return (
    <main className="expiry-alarm-page">
      <PageHeader title="Expiry Alarm" onBack={() => navigate('/admin')} />

      <div className="expiry-alarm-page__content">
        <section className="expiry-alarm-page__intro">
          <h2 className="expiry-alarm-page__title">Expiry Reminders</h2>
          <p className="expiry-alarm-page__description">
            Manage expiry alerts for your uploaded food items.
          </p>
        </section>

        {status && (
          <div
            className={`expiry-alarm-page__banner expiry-alarm-page__banner--${status.tone}`}
            role="alert"
          >
            {status.text}
          </div>
        )}

        {loading && (
          <p className="expiry-alarm-page__state" role="status">
            Loading products…
          </p>
        )}

        {!loading && error && (
          <div className="expiry-alarm-page__state expiry-alarm-page__state--error">
            <p>
              {error.status === 403
                ? 'You do not have permission to manage expiry reminders.'
                : error.message}
            </p>
            {error.status !== 403 && (
              <button
                type="button"
                className="expiry-alarm-page__retry"
                onClick={() => loadItems(undefined)}
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="expiry-alarm-page__empty">
            No expiry reminders yet.
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="expiry-alarm-page__list">
            {items.map((item) => {
              const reminderOn = item.reminder_enabled !== false
              const expired = isExpiredIsoDate(item.expiry_date)
              return (
                <article key={item.id} className="reminder-card">
                  {item.image_url ? (
                    <img
                      className="reminder-card__image"
                      src={item.image_url}
                      alt={item.name}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="reminder-card__image reminder-card__image--fallback"
                      aria-label="No image available"
                    >
                      <ImageOff
                        size={24}
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </div>
                  )}

                  <div className="reminder-card__text">
                    <h3 className="reminder-card__name">{item.name}</h3>
                    <p className="reminder-card__expiry">
                      <span className="reminder-card__expiry-label">
                        Expires on{' '}
                      </span>
                      <span className="reminder-card__expiry-date">
                        {formatExpiryDate(item.expiry_date)}
                      </span>
                      {expired && (
                        <span className="reminder-card__expired-badge">
                          Expired
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={reminderOn}
                    aria-label={`${item.name} expiry reminder`}
                    className="reminder-card__toggle"
                    disabled={busyIds.has(item.id)}
                    onClick={() => handleToggleReminder(item)}
                  >
                    <span className="reminder-card__toggle-thumb" />
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

export default ExpiryAlarm

