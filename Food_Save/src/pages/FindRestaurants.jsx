import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, MapPin, Navigation, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import ScrollArea from '../components/ui/ScrollArea'
import { FoodApiError, getCatalogOptions } from '../services/foodApi'
import './FindRestaurants.css'

/**
 * FindRestaurants — location search screen (/restaurants).
 *
 * First customer page after sign-in / sign-up. Stage 3C: the location
 * list now comes from GET /api/catalog/options (real IDs), keeping the
 * existing Figma layout — heading, description, search bar and the
 * 21st.dev ScrollArea results list are unchanged.
 *
 * Behaviour:
 *   - X (top-left)  -> navigate(-1) back to /signin or /signup
 *   - typing        -> case-insensitive partial filter over the
 *                      catalog addresses (empty search shows ALL)
 *   - results list  -> rendered inside the ScrollArea
 *   - picking a row -> setSelectedLocation() in AppContext AND
 *                      locationId on the shared activeFilters (so
 *                      /food can send location_id), then
 *                      navigate('/filters')
 */

/** Lowercase + strip everything except a-z / 0-9 for loose matching. */
function normalize(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function FindRestaurants() {
  const navigate = useNavigate()
  const { activeFilters, setSelectedLocation, setActiveFilters } = useApp()

  const [query, setQuery] = useState('')
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getCatalogOptions()
      .then((data) => {
        if (cancelled) return
        setLocations(data.locations ?? [])
        setLoading(false)
      })
      .catch((apiError) => {
        if (cancelled) return
        setError(
          apiError instanceof FoodApiError
            ? apiError.message
            : 'Something went wrong. Please try again.'
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const results = useMemo(() => {
    const normalizedQuery = normalize(query)
    if (!normalizedQuery) return locations
    return locations.filter((location) =>
      normalize(location.address).includes(normalizedQuery)
    )
  }, [locations, query])

  const handleClose = () => {
    navigate(-1)
  }

  const handleClear = () => {
    setQuery('')
  }

  const handleSelectLocation = (location) => {
    // Shared customer state: later screens (Filters, Food List) read
    // selectedLocation / activeFilters.locationId from AppContext, and
    // FoodList sends the real ID as the location_id query parameter.
    setSelectedLocation(location)
    setActiveFilters((prev) => ({ ...prev, locationId: location.id }))
    navigate('/filters')
  }

  // "All Locations" clears only the location restriction — every other
  // active filter (category, dietary, price, search) is preserved — and
  // omits location_id entirely from the food request.
  const handleSelectAllLocations = () => {
    setSelectedLocation(null)
    setActiveFilters((prev) => ({ ...prev, locationId: null }))
    navigate('/filters')
  }

  return (
    <main className="find-restaurants-page">
      <button
        type="button"
        className="find-restaurants-page__close"
        onClick={handleClose}
        aria-label="Close and go back"
      >
        <X size={24} strokeWidth={2} aria-hidden="true" />
      </button>

      <section className="find-restaurants-page__content">
        <h1 className="find-restaurants-page__heading">
          Find restaurants near you
        </h1>

        <p className="find-restaurants-page__description">
          Please enter your location or allow access to your location to find
          restaurants near you.
        </p>

        <div className="find-restaurants-page__search">
          <MapPin
            className="find-restaurants-page__search-icon"
            size={20}
            strokeWidth={1.5}
            fill="currentColor"
            aria-hidden="true"
          />
          <input
            className="find-restaurants-page__search-input"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Enter your location"
            aria-label="Search location"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              className="find-restaurants-page__clear"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Results live inside the 21st.dev ScrollArea (Base UI
            primitives) — only this region scrolls; heading, description
            and search bar stay outside and remain visible. */}
        <ScrollArea
          orientation="vertical"
          className="find-restaurants-page__scroll-area"
        >
          {loading && (
            <p className="find-restaurants-page__empty" role="status">
              Loading locations…
            </p>
          )}

          {error && (
            <div className="find-restaurants-page__empty">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <ul className="find-restaurants-page__results">
              <li>
                <button
                  type="button"
                  className={`find-restaurants-page__result${
                    activeFilters.locationId
                      ? ''
                      : ' find-restaurants-page__result--selected'
                  }`}
                  onClick={handleSelectAllLocations}
                  aria-pressed={activeFilters.locationId ? 'false' : 'true'}
                >
                  <Globe
                    className="find-restaurants-page__result-icon"
                    size={20}
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className="find-restaurants-page__result-text">
                    <span className="find-restaurants-page__result-title">
                      All Locations
                    </span>
                  </span>
                </button>
              </li>
              {results.map((location) => (
                <li key={location.id}>
                  <button
                    type="button"
                    className={`find-restaurants-page__result${
                      activeFilters.locationId === location.id
                        ? ' find-restaurants-page__result--selected'
                        : ''
                    }`}
                    onClick={() => handleSelectLocation(location)}
                    aria-pressed={
                      activeFilters.locationId === location.id ? 'true' : 'false'
                    }
                  >
                    <Navigation
                      className="find-restaurants-page__result-icon"
                      size={20}
                      strokeWidth={1.5}
                      fill="currentColor"
                      aria-hidden="true"
                    />
                    <span className="find-restaurants-page__result-text">
                      <span className="find-restaurants-page__result-title">
                        {location.address}
                      </span>
                    </span>
                  </button>
                </li>
              ))}

              {results.length === 0 && (
                <li className="find-restaurants-page__empty">
                  No locations found. Try a different search.
                </li>
              )}
            </ul>
          )}
        </ScrollArea>
      </section>
    </main>
  )
}

export default FindRestaurants
