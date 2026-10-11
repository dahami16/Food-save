import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import PrimaryButton from '../components/PrimaryButton'
import ScrollArea from '../components/ui/ScrollArea'
import { useApp } from '../context/AppContext'
import { FoodApiError, getCatalogOptions } from '../services/foodApi'
import './Filters.css'

/**
 * Filters — customer filter screen (/filters), integrated with the
 * FastAPI catalog API (Stage 3C).
 *
 * Flow: /restaurants (location selected) → /filters → APPLY FILTERS → /food
 *
 * Categories, dietary options and price ranges come from
 * GET /api/catalog/options — selections store the REAL IDs (single
 * selection as a one-element array, price as the full option object
 * with label + min_price/max_price), so the Food List page can send
 * category_id / dietary_id / min_price / max_price directly. "All" /
 * "Any" pseudo-options simply clear that section.
 *
 * Local temporary state while editing; nothing is written to
 * AppContext until APPLY FILTERS is pressed (existing behaviour).
 * The section design (option grid + price circles) is unchanged.
 */

/** Builds the shared option-button class list (categories & dietary). */
function optionClass(selected, option) {
  return selected === option
    ? 'filter-option filter-option--selected'
    : 'filter-option'
}

/** Builds the price-circle class list. */
function priceClass(selected, price) {
  return selected === price
    ? 'filter-price-circle filter-price-circle--selected'
    : 'filter-price-circle'
}

function Filters() {
  const navigate = useNavigate()
  const { activeFilters, setActiveFilters } = useApp()

  // Catalog options from GET /api/catalog/options (loading/error below).
  const [options, setOptions] = useState(null)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState(null)

  // Local editing state, initialized from previously applied filters so
  // returning to this page shows the user's earlier selections.
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    activeFilters.categories[0] ?? null
  )
  const [selectedDietaryId, setSelectedDietaryId] = useState(
    activeFilters.dietary[0] ?? null
  )
  const [selectedPrice, setSelectedPrice] = useState(
    activeFilters.priceRange ?? null
  )
  // Location is chosen on the /restaurants screen (which writes
  // activeFilters.locationId); we keep a local mirror so the shared value
  // is committed back on APPLY, and can be cleared here via "All Locations".
  const [selectedLocationId, setSelectedLocationId] = useState(
    activeFilters.locationId ?? null
  )

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true)
    setOptionsError(null)
    try {
      const data = await getCatalogOptions()
      setOptions(data)
    } catch (error) {
      setOptions(null)
      setOptionsError(
        error instanceof FoodApiError
          ? error.message
          : 'Something went wrong. Please try again.'
      )
    } finally {
      setOptionsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOptions()
    // loadOptions is a stable callback; the session-cached catalog
    // never changes between page visits, so this runs once per mount.
  }, [loadOptions])

  const categoryOptions = options?.categories ?? []
  const dietaryOptions = options?.dietary_options ?? []
  const priceOptions = options?.price_options ?? []
  const locationOptions = options?.locations ?? []

  const canApply = !optionsLoading && optionsError === null

  // Human-readable label for the currently chosen location (for the button).
  const selectedLocationLabel =
    locationOptions.find((option) => option.id === selectedLocationId)
      ?.address ?? 'All Locations'

  /** Commit selections (real IDs) to AppContext, then continue to /food. */
  function handleApplyFilters() {
    if (!canApply) return
    setActiveFilters({
      ...activeFilters,
      categories: selectedCategoryId ? [selectedCategoryId] : [],
      dietary: selectedDietaryId ? [selectedDietaryId] : [],
      priceRange: selectedPrice,
      locationId: selectedLocationId,
    })
    navigate('/food')
  }

  return (
    <main className="filters-page">
      <PageHeader title="Filters" onBack={() => navigate('/restaurants')} />

      <div className="filters-page__content">
        {optionsError && (
          <div className="filters-page__status filters-page__status--error">
            <p>{optionsError}</p>
            <button
              type="button"
              className="filters-page__retry"
              onClick={loadOptions}
            >
              Try Again
            </button>
          </div>
        )}

        {optionsLoading && (
          <p className="filters-page__status" role="status">
            Loading filter options…
          </p>
        )}

        {/* ---- Location (chosen on the /restaurants screen) ---- */}
        {!optionsLoading && !optionsError && (
          <section className="filter-section" aria-label="Location">
            <div className="filter-section__header">
              <h2 className="filter-section__title">Location</h2>
              <button
                type="button"
                className="filter-section__clear"
                onClick={() => setSelectedLocationId(null)}
              >
                Clear All
              </button>
            </div>
            <button
              type="button"
              className="filters-page__location-button"
              onClick={() => navigate('/restaurants')}
            >
              <MapPin size={18} strokeWidth={2} aria-hidden="true" />
              <span className="filters-page__location-button-label">
                {selectedLocationId ? selectedLocationLabel : 'Choose Location'}
              </span>
            </button>
            <p className="filters-page__location-hint">
              {selectedLocationId
                ? 'Tap Choose Location to change, or Clear All for every location.'
                : 'Showing food from all locations until you pick one.'}
            </p>
          </section>
        )}

        {/* ---- Categories (single select, real catalog IDs) ---- */}
        {!optionsLoading && !optionsError && (
          <section className="filter-section" aria-label="Categories">
            <div className="filter-section__header">
              <h2 className="filter-section__title">Categories</h2>
              <button
                type="button"
                className="filter-section__clear"
                onClick={() => setSelectedCategoryId(null)}
              >
                Clear All
              </button>
            </div>
            <div className="filter-section__options-grid">
              <button
                type="button"
                className={optionClass(selectedCategoryId, null)}
                aria-pressed={selectedCategoryId === null}
                onClick={() => setSelectedCategoryId(null)}
              >
                All
              </button>
              {categoryOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={optionClass(selectedCategoryId, option.id)}
                  aria-pressed={selectedCategoryId === option.id}
                  onClick={() => setSelectedCategoryId(option.id)}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---- Dietary (single select, real catalog IDs) ---- */}
        {!optionsLoading && !optionsError && (
          <section className="filter-section" aria-label="Dietary">
            <div className="filter-section__header">
              <h2 className="filter-section__title">Dietary</h2>
              <button
                type="button"
                className="filter-section__clear"
                onClick={() => setSelectedDietaryId(null)}
              >
                Clear All
              </button>
            </div>
            <div className="filter-section__options-grid">
              <button
                type="button"
                className={optionClass(selectedDietaryId, null)}
                aria-pressed={selectedDietaryId === null}
                onClick={() => setSelectedDietaryId(null)}
              >
                Any
              </button>
              {dietaryOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={optionClass(selectedDietaryId, option.id)}
                  aria-pressed={selectedDietaryId === option.id}
                  onClick={() => setSelectedDietaryId(option.id)}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---- Price Range (single select, catalog price options) ---- */}
        {!optionsLoading && !optionsError && (
          <section className="filter-section" aria-label="Price Range">
            <div className="filter-section__header">
              <h2 className="filter-section__title">Price Range</h2>
              <button
                type="button"
                className="filter-section__clear"
                onClick={() => setSelectedPrice(null)}
              >
                Clear All
              </button>
            </div>
            <ScrollArea
              orientation="horizontal"
              className="filters-page__price-scroll"
            >
              <div className="filters-page__price-options">
                <button
                  type="button"
                  className={priceClass(selectedPrice, null)}
                  aria-pressed={selectedPrice === null}
                  onClick={() => setSelectedPrice(null)}
                >
                  Any Price
                </button>
                {priceOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={priceClass(selectedPrice?.id, option.id)}
                    aria-pressed={selectedPrice?.id === option.id}
                    aria-label={`From ${option.min_price} dollars${
                      option.max_price != null
                        ? ` to ${option.max_price} dollars`
                        : ' and up'
                    }`}
                    onClick={() => setSelectedPrice(option)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </section>
        )}
      </div>

      <div className="filters-page__apply">
        <PrimaryButton type="button" onClick={handleApplyFilters} disabled={!canApply}>
          Apply Filters
        </PrimaryButton>
      </div>
    </main>
  )
}

export default Filters
