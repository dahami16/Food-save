import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImageOff, Search, SlidersHorizontal, X } from 'lucide-react'
import BottomNavigation from '../components/BottomNavigation'
import { FoodApiError, getCatalogOptions, listFood } from '../services/foodApi'
import { useApp } from '../context/AppContext'
import { formatAudPrice } from '../utils/format'
import { formatExpiryDate } from '../data/adminProducts'
import './FoodList.css'

/**
 * FoodList — customer food listing (/food), Stage 3C + 3C.1.
 *
 * Compact search field, a clearly visible Filters button that opens the
 * existing /filters screen, active-filter chips reflecting the shared
 * filter state, and an "Available Food" responsive grid of real listings
 * from GET /api/food. The old static category-image grid and placeholder
 * copy are removed; every card is a real backend record. Filters/search
 * are the single source of truth in AppContext (activeFilters).
 */
function FoodList() {
  const navigate = useNavigate()
  const { activeFilters, setActiveFilters } = useApp()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null) // display-safe message

  // Responsive search input; committed to shared state on a short debounce
  // so the value survives /food <-> /filters navigation.
  const [searchInput, setSearchInput] = useState(activeFilters.search)

  // Catalog lookup tables for readable filter-chip labels (session-cached).
  const [options, setOptions] = useState(null)

  const categoryId = activeFilters.categories[0] ?? undefined
  const dietaryId = activeFilters.dietary[0] ?? undefined
  const locationId = activeFilters.locationId ?? undefined
  const priceRange = activeFilters.priceRange
  const search = activeFilters.search

  // ---- Catalog options (cached) for chip labels only ----
  useEffect(() => {
    let cancelled = false
    getCatalogOptions()
      .then((data) => {
        if (!cancelled) setOptions(data)
      })
      .catch(() => {
        /* Chips fall back to generic labels; the listing still works. */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ---- Debounce the search box into shared filter state ----
  useEffect(() => {
    if (searchInput === activeFilters.search) return undefined
    const timer = setTimeout(() => {
      setActiveFilters((prev) => ({ ...prev, search: searchInput }))
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, activeFilters.search, setActiveFilters])

  // ---- Fetch food with the exact backend query parameter names ----
  const loadFood = useCallback(
    async (signal) => {
      setLoading(true)
      setError(null)
      try {
        const data = await listFood({
          search: search.trim(),
          categoryId,
          dietaryId,
          locationId,
          minPrice: priceRange?.min_price,
          maxPrice: priceRange?.max_price,
        })
        if (!signal?.aborted) setItems(data.items ?? [])
      } catch (apiError) {
        if (signal?.aborted) return
        setItems([])
        setError(
          apiError instanceof FoodApiError
            ? apiError.message
            : 'Something went wrong. Please try again.'
        )
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [search, categoryId, dietaryId, locationId, priceRange]
  )

  useEffect(() => {
    const controller = new AbortController()
    loadFood(controller.signal)
    return () => controller.abort()
  }, [loadFood])

  // ---- ID -> display-name lookups for chips ----
  const categoryNameById = useMemo(() => {
    const map = new Map()
    for (const option of options?.categories ?? []) map.set(option.id, option.name)
    return map
  }, [options])

  const dietaryNameById = useMemo(() => {
    const map = new Map()
    for (const option of options?.dietary_options ?? [])
      map.set(option.id, option.name)
    return map
  }, [options])

  const locationAddressById = useMemo(() => {
    const map = new Map()
    for (const option of options?.locations ?? [])
      map.set(option.id, option.address)
    return map
  }, [options])

  const chips = useMemo(() => {
    const list = []
    const trimmedSearch = search.trim()
    if (trimmedSearch) list.push({ key: 'search', label: `"${trimmedSearch}"` })
    if (categoryId)
      list.push({
        key: 'category',
        label: categoryNameById.get(categoryId) ?? 'Category',
      })
    if (dietaryId)
      list.push({
        key: 'dietary',
        label: dietaryNameById.get(dietaryId) ?? 'Dietary',
      })
    if (locationId)
      list.push({
        key: 'location',
        label: locationAddressById.get(locationId) ?? 'Location',
      })
    if (priceRange) list.push({ key: 'price', label: priceRange.label })
    return list
  }, [
    search,
    categoryId,
    dietaryId,
    locationId,
    priceRange,
    categoryNameById,
    dietaryNameById,
    locationAddressById,
  ])

  // Removing one chip clears only that restriction; others stay applied.
  function handleClearFilter(key) {
    if (key === 'search') setSearchInput('')
    setActiveFilters((prev) => {
      const next = { ...prev }
      if (key === 'category') next.categories = []
      if (key === 'dietary') next.dietary = []
      if (key === 'location') next.locationId = null
      if (key === 'price') next.priceRange = null
      if (key === 'search') next.search = ''
      return next
    })
  }

  return (
    <main className="food-list-page">
      <div className="food-list-page__content">
        {/* ---- Search + Filters (same horizontal row) ---- */}
        <div className="food-list-page__search-header">
          <Search
            className="food-list-page__search-icon"
            size={22}
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            className="food-list-page__search-input"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search food"
            aria-label="Search food"
            autoComplete="off"
          />
          <button
            type="button"
            className="food-list-page__filters-button"
            onClick={() => navigate('/filters')}
          >
            <SlidersHorizontal size={16} strokeWidth={2} aria-hidden="true" />
            Filters
          </button>
        </div>

        {/* ---- Active filter chips ---- */}
        {chips.length > 0 && (
          <div className="food-list-page__chips">
            {chips.map((chip) => (
              <span key={chip.key} className="food-filter-chip">
                {chip.label}
                <button
                  type="button"
                  className="food-filter-chip__remove"
                  onClick={() => handleClearFilter(chip.key)}
                  aria-label={`Remove ${chip.label} filter`}
                >
                  <X size={12} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        <h2 className="food-list-page__food-title">Available Food</h2>

        {/* ---- Loading / error / empty states ---- */}
        {loading && (
          <p className="food-list-page__status" role="status">
            Loading food…
          </p>
        )}

        {!loading && error && (
          <div className="food-list-page__status food-list-page__status--error">
            <p>{error}</p>
            <button
              type="button"
              className="food-list-page__retry"
              onClick={() => loadFood(undefined)}
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="food-list-page__status">
            No food matches your filters. Try adjusting your search.
          </p>
        )}

        {/* ---- Responsive food grid ---- */}
        {!loading && !error && items.length > 0 && (
          <div className="food-list-page__food-grid">
            {items.map((item) => (
              <article key={item.id} className="food-item-card">
                {item.image_url ? (
                  <img
                    className="food-item-card__image"
                    src={item.image_url}
                    alt={item.name}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="food-item-card__image food-item-card__image-fallback"
                    aria-label="No image available"
                  >
                    <ImageOff size={24} strokeWidth={1.5} aria-hidden="true" />
                  </div>
                )}
                <div className="food-item-card__body">
                  <div className="food-item-card__header">
                    <h3 className="food-item-card__name">{item.name}</h3>
                    <span className="food-item-card__price">
                      {formatAudPrice(item.price)}
                    </span>
                  </div>
                  <p className="food-item-card__expiry">
                    <span className="food-item-card__expiry-label">
                      Expires{' '}
                    </span>
                    <span className="food-item-card__expiry-date">
                      {formatExpiryDate(item.expiry_date)}
                    </span>
                  </p>
                  <ul className="food-item-card__tags">
                    {item.category?.name && (
                      <li className="food-item-card__tag">
                        {item.category.name}
                      </li>
                    )}
                    {item.dietary?.name && (
                      <li className="food-item-card__tag">{item.dietary.name}</li>
                    )}
                    {item.location?.address && (
                      <li className="food-item-card__tag food-item-card__tag--location">
                        {item.location.address}
                      </li>
                    )}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <BottomNavigation />
    </main>
  )
}

export default FoodList

