import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImageOff, LogOut, X } from 'lucide-react'
import PrimaryButton from '../../components/PrimaryButton'
import { useAuth } from '../../context/AuthContext'
import {
  FoodApiError,
  adminListFood,
  deleteFood,
} from '../../services/foodApi'
import { formatExpiryDate } from '../../data/adminProducts'
import { formatAudPrice, isExpiredIsoDate } from '../../utils/format'
import './AdminHome.css'

/**
 * AdminHome — Hotel Admin landing screen (/admin), integrated with
 * GET /api/admin/food (Stage 3C).
 *
 * White admin page: no BottomNavigation. Actions navigate deeper
 * into the admin flow:
 *   ADD FOOD          -> /admin/add-food
 *   WATCH EXPIRE FOOD -> /admin/expiry-alarm
 *
 * Uploaded Products now renders the LIVE backend records (expired
 * items included, as administration requires) with image, name,
 * price, expiry, category, location and dietary option. Management
 * controls (Edit / Delete) render only for the trusted admin profile;
 * the backend stays authoritative (Bearer token on every request,
 * 401 signs out via AuthContext, 403 shows access denied).
 *
 * Deletion requires an inline confirmation and the UI updates only
 * after the API confirms — and the returned image_cleanup status is
 * reported honestly ('failed' never claims the image was removed).
 */
function AdminHome() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null) // { status, message }
  const [status, setStatus] = useState(null) // { tone, text } banner
  const [confirmingId, setConfirmingId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const canManage = user?.role === 'admin'

  const loadItems = useCallback(async (signal) => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminListFood()
      if (!signal?.aborted) setItems(data.items ?? [])
    } catch (apiError) {
      if (signal?.aborted) return
      if (apiError instanceof FoodApiError && apiError.status === 401) {
        // Expired/invalid token: follow the existing auth behaviour
        // (AuthContext discards the session -> ProtectedRoute redirects).
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

  /**
   * DELETE with confirmation. The list is updated only after the
   * backend confirms; image_cleanup is reported honestly.
   */
  async function handleConfirmDelete(item) {
    if (deleting) return
    setDeleting(true)
    setStatus(null)
    try {
      const result = await deleteFood(item.id)
      if (result.image_cleanup === 'failed') {
        setStatus({
          tone: 'warning',
          text: `"${item.name}" was deleted, but its image could not be removed from storage.`,
        })
      } else if (result.image_cleanup === 'completed') {
        setStatus({
          tone: 'success',
          text: `"${item.name}" and its image were deleted.`,
        })
      } else {
        setStatus({ tone: 'success', text: `"${item.name}" was deleted.` })
      }
      setItems((prev) => prev.filter((entry) => entry.id !== item.id))
    } catch (apiError) {
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
      setDeleting(false)
      setConfirmingId(null)
    }
  }

  // Logout reuses the existing AuthContext action (clears the stored
  // access token + current user, which also resets AppContext session
  // state), then returns to Sign In — identical to Account Settings.
  function handleLogout() {
    logout()
    navigate('/signin', { replace: true })
  }

  return (
    <main className="admin-home-page">
      <header className="page-header">
        <div className="page-header__left">
          <button
            type="button"
            className="admin-home-page__logout-button"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <h1 className="page-header__title">Admin Home</h1>

        <div className="page-header__right" />
      </header>

      <div className="admin-home-page__content">
        <section className="admin-home-page__intro">
          <h2 className="admin-home-page__title">Manage Food Listings</h2>
          <p className="admin-home-page__description">
            Manage your uploaded food items and monitor expiry reminders.
          </p>
        </section>

        <div className="admin-home-page__actions">
          <PrimaryButton fullWidth onClick={() => navigate('/admin/add-food')}>
            Add Food
          </PrimaryButton>

          <button
            type="button"
            className="admin-home-page__secondary-button"
            onClick={() => navigate('/admin/expiry-alarm')}
          >
            Watch Expire Food
          </button>
        </div>

        {/* ---- Status banner (delete results, errors) ---- */}
        {status && (
          <div
            className={`admin-home-page__banner admin-home-page__banner--${status.tone}`}
            role={status.tone === 'error' ? 'alert' : 'status'}
          >
            <p className="admin-home-page__banner-text">{status.text}</p>
            <button
              type="button"
              className="admin-home-page__banner-dismiss"
              onClick={() => setStatus(null)}
              aria-label="Dismiss message"
            >
              <X size={14} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        )}

        <section className="admin-home-page__products">
          <h3 className="admin-home-page__section-title">Uploaded Products</h3>

          {loading && (
            <p className="admin-home-page__state" role="status">
              Loading products…
            </p>
          )}

          {!loading && error && (
            <div className="admin-home-page__state admin-home-page__state--error">
              <p>
                {error.status === 403
                  ? 'You do not have permission to view admin food records.'
                  : error.message}
              </p>
              {error.status !== 403 && (
                <button
                  type="button"
                  className="admin-home-page__retry"
                  onClick={() => loadItems(undefined)}
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="admin-home-page__list">
              {items.map((item) => {
                const expired = isExpiredIsoDate(item.expiry_date)
                const confirming = confirmingId === item.id
                return (
                  <article key={item.id} className="product-card">
                    {item.image_url ? (
                      <img
                        className="product-card__image"
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="product-card__image product-card__image--fallback"
                        aria-label="No image available"
                      >
                        <ImageOff size={28} strokeWidth={1.5} aria-hidden="true" />
                      </div>
                    )}
                    <div className="product-card__body">
                      <div className="product-card__header">
                        <h4 className="product-card__name">{item.name}</h4>
                        <span className="product-card__price">
                          {formatAudPrice(item.price)}
                        </span>
                      </div>
                      <p className="product-card__expiry">
                        <span className="product-card__expiry-label">
                          Expires:{' '}
                        </span>
                        <span className="product-card__expiry-date">
                          {formatExpiryDate(item.expiry_date)}
                        </span>
                        {expired && (
                          <span className="product-card__expired-badge">
                            Expired
                          </span>
                        )}
                      </p>
                      <ul className="product-card__tags">
                        <li className="product-card__tag">
                          {item.category?.name}
                        </li>
                        <li className="product-card__tag">
                          {item.dietary?.name}
                        </li>
                        <li className="product-card__tag product-card__tag--location">
                          {item.location?.address}
                        </li>
                      </ul>

                      {/* Management controls: trusted admin profile only
                          (the backend re-checks on every request). */}
                      {canManage && (
                        <div className="product-card__actions">
                          {confirming ? (
                            <>
                              <span className="product-card__confirm-text">
                                Delete this item?
                              </span>
                              <button
                                type="button"
                                className="product-card__action product-card__action--danger"
                                onClick={() => handleConfirmDelete(item)}
                                disabled={deleting}
                              >
                                {deleting ? 'Deleting…' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                className="product-card__action"
                                onClick={() => setConfirmingId(null)}
                                disabled={deleting}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="product-card__action"
                                onClick={() =>
                                  navigate(
                                    `/admin/add-food?edit=${encodeURIComponent(item.id)}`
                                  )
                                }
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="product-card__action product-card__action--danger"
                                onClick={() => setConfirmingId(item.id)}
                                disabled={deleting}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <p className="admin-home-page__state">
              No food items yet. Add your first product to get started.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

export default AdminHome
