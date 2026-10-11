import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CircleCheck, ImagePlus } from 'lucide-react'
import PageHeader from '../../components/PageHeader'
import FormField from '../../components/FormField'
import PrimaryButton from '../../components/PrimaryButton'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert'
import { useAuth } from '../../context/AuthContext'
import {
  FoodApiError,
  adminListFood,
  createFood,
  getCatalogOptions,
  updateFood,
} from '../../services/foodApi'
import './AddFood.css'

/**
 * AddFood — Hotel Admin "Add Food" (/admin/add-food) and "Edit Food"
 * (/admin/add-food?edit=<id>) screens, integrated with the FastAPI
 * backend (Stage 3C).
 *
 * Create: POST /api/admin/food as multipart/form-data with the exact
 * backend field names — image (required), name, category_id,
 * location_id, dietary_id, price, expiry_date and reminder_enabled.
 * Category / location / dietary selects load from
 * GET /api/catalog/options (real IDs, never hard-coded).
 *
 * Edit: PATCH /api/admin/food/{id} sending ONLY the fields the admin
 * actually changed, plus an optional replacement image — ordinary
 * edits never require a new file.
 *
 * Image rules (client-side; the backend re-validates authoritatively):
 * JPEG / PNG / WebP only, max 5 MB, previewed with
 * URL.createObjectURL (current session only). FormData is submitted
 * WITHOUT a manual Content-Type header so fetch sets the multipart
 * boundary itself, and the Supabase access token rides along in the
 * Authorization header via foodApi.
 *
 * The existing success flow is preserved: the adapted 21st.dev Alert
 * appears as a portal overlay; navigation to /admin happens only when
 * the admin presses BACK TO ADMIN HOME. The overlay now shows the
 * saved record's uploaded image_url. Duplicate submissions are
 * blocked while a request is in flight.
 */

/** Client-side image constraints (mirroring the backend contract). */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ACCEPTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

/** Returns a display-safe validation message, or null when valid. */
function validateImageFile(file) {
  const extension = file.name.includes('.')
    ? file.name.split('.').pop().toLowerCase()
    : ''
  if (
    !ACCEPTED_IMAGE_TYPES.includes(file.type) ||
    !ACCEPTED_IMAGE_EXTENSIONS.includes(extension)
  ) {
    return 'Only JPEG, PNG and WebP images are supported.'
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Image must be 5 MB or smaller.'
  }
  return null
}

/** Today's date as yyyy-mm-dd in the local timezone (for min). */
function getTodayIso() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function AddFood() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const isEdit = Boolean(editId)

  const todayIso = getTodayIso()
  const expiryInputId = useId()
  const expiryErrorId = `${expiryInputId}-error`

  // Catalog options (GET /api/catalog/options) for the three selects.
  const [options, setOptions] = useState(null)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState(null)

  // Edit mode: the record being edited (also the change baseline).
  const [existingItem, setExistingItem] = useState(null)
  const [itemLoading, setItemLoading] = useState(isEdit)
  const [itemError, setItemError] = useState(null)

  // Form state.
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null) // object URL of a new pick
  const [productName, setProductName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [dietaryId, setDietaryId] = useState('')
  const [price, setPrice] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(true)

  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savedItem, setSavedItem] = useState(null)
  const [showSuccessAlert, setShowSuccessAlert] = useState(false)

  // Tracks the current object URL so it can be revoked when the
  // image is replaced or on unmount.
  const previewUrlRef = useRef(null)

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    },
    []
  )

  // ---- Catalog options (create + edit selects) --------------------------
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
  }, [loadOptions])

  // ---- Edit mode: load the existing record ------------------------------
  useEffect(() => {
    if (!editId) return undefined
    let cancelled = false
    setItemLoading(true)
    setItemError(null)
    adminListFood()
      .then((data) => {
        const found = (data.items ?? []).find((item) => item.id === editId)
        if (!found) {
          throw new FoodApiError('This food item could not be found.', 404)
        }
        if (cancelled) return
        setExistingItem(found)
        setProductName(found.name)
        setCategoryId(found.category?.id ?? '')
        setLocationId(found.location?.id ?? '')
        setDietaryId(found.dietary?.id ?? '')
        setPrice(String(found.price))
        setExpiryDate(found.expiry_date)
        setReminderEnabled(found.reminder_enabled !== false)
      })
      .catch((error) => {
        if (cancelled) return
        if (error instanceof FoodApiError && error.status === 401) {
          logout()
          return
        }
        setItemError(
          error instanceof FoodApiError
            ? error.message
            : 'Something went wrong. Please try again.'
        )
      })
      .finally(() => {
        if (!cancelled) setItemLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [editId, logout])

  // ---- Field handlers ----------------------------------------------------
  function handleImageChange(event) {
    const file = event.target.files && event.target.files[0]
    if (!file) return

    const imageError = validateImageFile(file)
    if (imageError) {
      // Invalid pick: keep the previous preview, show the message.
      setErrors((prev) => ({ ...prev, image: imageError }))
      event.target.value = '' // allow re-picking the same file name
      return
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    const url = URL.createObjectURL(file)
    previewUrlRef.current = url

    setImageFile(file)
    setImagePreview(url)
    setErrors((prev) => ({ ...prev, image: undefined }))
  }

  function handleNameChange(event) {
    setProductName(event.target.value)
    setErrors((prev) => ({ ...prev, name: undefined }))
  }

  function handlePriceChange(event) {
    setPrice(event.target.value)
    setErrors((prev) => ({ ...prev, price: undefined }))
  }

  function handleDateChange(event) {
    setExpiryDate(event.target.value)
    setErrors((prev) => ({ ...prev, expiryDate: undefined }))
  }

  function handleCategoryChange(event) {
    setCategoryId(event.target.value)
    setErrors((prev) => ({ ...prev, categoryId: undefined }))
  }

  function handleLocationChange(event) {
    setLocationId(event.target.value)
    setErrors((prev) => ({ ...prev, locationId: undefined }))
  }

  function handleDietaryChange(event) {
    setDietaryId(event.target.value)
    setErrors((prev) => ({ ...prev, dietaryId: undefined }))
  }


  // ---- Validation + submit ------------------------------------------------
  function validate() {
    const nameTrimmed = productName.trim()
    const priceNumber = Number(price)
    const nextErrors = {
      // The image is required to create; optional when editing.
      image: imageFile ? validateImageFile(imageFile) || undefined : null,
      name:
        nameTrimmed.length >= 2 && nameTrimmed.length <= 200
          ? undefined
          : 'Product name must be between 2 and 200 characters.',
      categoryId: categoryId ? undefined : 'Please select a category.',
      locationId: locationId ? undefined : 'Please select a location.',
      dietaryId: dietaryId ? undefined : 'Please select a dietary option.',
      price:
        price.trim() !== '' && Number.isFinite(priceNumber) && priceNumber >= 0
          ? undefined
          : 'Please enter a valid price of 0 or more.',
      expiryDate: undefined,
    }

    const expiryChanged = isEdit && expiryDate !== existingItem?.expiry_date
    if (!expiryDate) {
      nextErrors.expiryDate = 'Please select an expiry date.'
    } else if ((!isEdit || expiryChanged) && expiryDate < todayIso) {
      // Create (or a changed edit) cannot set a past date; an
      // unchanged past expiry on an old record never blocks edits.
      nextErrors.expiryDate = 'Expiry date cannot be in the past.'
    }

    if (!isEdit && !imageFile) {
      nextErrors.image = 'Please select a product image.'
    }

    return nextErrors
  }

  /**
   * Builds the multipart body. Create mode always sends every field;
   * edit mode sends ONLY the changed fields (plus the image when a
   * replacement was picked). No Content-Type header — fetch sets it.
   */
  function buildFormData() {
    const formData = new FormData()

    if (isEdit) {
      if (productName.trim() !== existingItem.name) {
        formData.append('name', productName.trim())
      }
      if (categoryId !== (existingItem.category?.id ?? '')) {
        formData.append('category_id', categoryId)
      }
      if (locationId !== (existingItem.location?.id ?? '')) {
        formData.append('location_id', locationId)
      }
      if (dietaryId !== (existingItem.dietary?.id ?? '')) {
        formData.append('dietary_id', dietaryId)
      }
      if (Number(price) !== Number(existingItem.price)) {
        formData.append('price', price.trim())
      }
      if (expiryDate !== existingItem.expiry_date) {
        formData.append('expiry_date', expiryDate)
      }
      if (reminderEnabled !== (existingItem.reminder_enabled !== false)) {
        formData.append('reminder_enabled', String(reminderEnabled))
      }
      if (imageFile) {
        formData.append('image', imageFile)
      }
      return formData
    }

    formData.append('image', imageFile)
    formData.append('name', productName.trim())
    formData.append('category_id', categoryId)
    formData.append('location_id', locationId)
    formData.append('dietary_id', dietaryId)
    formData.append('price', price.trim())
    formData.append('expiry_date', expiryDate)
    formData.append('reminder_enabled', String(reminderEnabled))
    return formData
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) return // never submit twice in parallel

    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    const formData = buildFormData()
    if (isEdit && formData.entries().next().done) {
      setSubmitError('No changes to save.')
      return
    }

    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const saved = isEdit
        ? await updateFood(editId, formData)
        : await createFood(formData)
      // The saved record's image_url (Supabase public URL) now owns
      // the image — revoke the local preview and show the success
      // overlay with the uploaded picture.
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
      setImagePreview(null)
      setImageFile(null)
      setSavedItem(saved)
      setShowSuccessAlert(true)
    } catch (error) {
      if (error instanceof FoodApiError && error.status === 401) {
        logout() // follow existing auth behaviour -> redirected to /signin
        return
      }
      setSubmitError(
        error instanceof FoodApiError
          ? error.message
          : 'Something went wrong. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  /** Alert action: close the notification, then go to Admin Home. */
  function handleSuccessDismiss() {
    setShowSuccessAlert(false)
    navigate('/admin')
  }


  // Current preview: a newly picked file first, else the record's
  // existing Supabase image (edit mode).
  const previewSource =
    imagePreview ?? (isEdit ? existingItem?.image_url : null)

  const categoryOptions = options?.categories ?? []
  const locationOptions = options?.locations ?? []
  const dietaryOptions = options?.dietary_options ?? []

  if (itemLoading) {
    return (
      <main className="add-food-page">
        <PageHeader title="Edit Food" onBack={() => navigate('/admin')} />
        <p className="add-food-page__status" role="status">
          Loading product…
        </p>
      </main>
    )
  }

  if (itemError) {
    return (
      <main className="add-food-page">
        <PageHeader title="Edit Food" onBack={() => navigate('/admin')} />
        <div className="add-food-page__status add-food-page__status--error">
          <p role="alert">{itemError}</p>
          <PrimaryButton onClick={() => navigate('/admin')}>
            Back to Admin Home
          </PrimaryButton>
        </div>
      </main>
    )
  }

  return (
    <main className="add-food-page">
      <PageHeader
        title={isEdit ? 'Edit Food' : 'Add Food'}
        onBack={() => navigate('/admin')}
      />

      <form
        className="add-food-page__content"
        onSubmit={handleSubmit}
        noValidate
      >
        <section className="add-food-page__intro">
          <h2 className="add-food-page__title">
            {isEdit ? 'Edit Food Item' : 'Add Food Item'}
          </h2>
          <p className="add-food-page__description">
            {isEdit
              ? 'Update the product details below. Choose a new image only if you want to replace the current one.'
              : 'Upload a food image, enter the product details and set its expiry date.'}
          </p>
        </section>

        {optionsError && (
          <div className="add-food-page__banner add-food-page__banner--error">
            <p>{optionsError}</p>
            <button
              type="button"
              className="add-food-page__banner-retry"
              onClick={loadOptions}
            >
              Try Again
            </button>
          </div>
        )}

        {submitError && (
          <div
            className="add-food-page__banner add-food-page__banner--error"
            role="alert"
          >
            <p>{submitError}</p>
          </div>
        )}

        {/* ---- 1. Product image (JPEG/PNG/WebP, max 5 MB) ---- */}
        <div className="add-food-page__field">
          <label
            className={`add-food-page__upload${
              previewSource ? ' add-food-page__upload--filled' : ''
            }${errors.image ? ' add-food-page__upload--error' : ''}`}
          >
            <input
              className="add-food-page__file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              aria-label="Product image"
            />
            {previewSource ? (
              <>
                <img
                  className="add-food-page__preview"
                  src={previewSource}
                  alt={
                    imagePreview
                      ? 'Selected product image'
                      : 'Current product image'
                  }
                />
                <span className="add-food-page__replace-hint">
                  Tap to replace
                </span>
              </>
            ) : (
              <span className="add-food-page__upload-placeholder">
                <ImagePlus
                  className="add-food-page__upload-icon"
                  aria-hidden="true"
                />
                <span className="add-food-page__upload-text">
                  {isEdit ? 'Add new product image' : 'Add product image'}
                </span>
                <span className="add-food-page__upload-hint">
                  JPEG, PNG or WebP · max 5 MB
                </span>
              </span>
            )}
          </label>
          {errors.image && (
            <p className="add-food-page__error" role="alert">
              {errors.image}
            </p>
          )}
        </div>


        {/* ---- 2. Product name ---- */}
        <FormField
          label="Product Name"
          name="productName"
          type="text"
          value={productName}
          onChange={handleNameChange}
          error={errors.name}
          required
        />

        {/* ---- 3. Category / Location / Dietary (catalog IDs) ---- */}
        <div className="add-food-page__field">
          <label
            className="add-food-page__date-label"
            htmlFor="add-food-category"
          >
            Category
          </label>
          <div
            className={`add-food-page__select-wrapper${
              errors.categoryId ? ' add-food-page__select-wrapper--error' : ''
            }`}
          >
            <select
              id="add-food-category"
              name="categoryId"
              className="add-food-page__select"
              value={categoryId}
              onChange={handleCategoryChange}
              disabled={optionsLoading}
              required
            >
              <option value="">
                {optionsLoading ? 'Loading…' : 'Select a category'}
              </option>
              {categoryOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          {errors.categoryId && (
            <p className="add-food-page__error" role="alert">
              {errors.categoryId}
            </p>
          )}
        </div>

        <div className="add-food-page__field">
          <label
            className="add-food-page__date-label"
            htmlFor="add-food-location"
          >
            Location
          </label>
          <div
            className={`add-food-page__select-wrapper${
              errors.locationId ? ' add-food-page__select-wrapper--error' : ''
            }`}
          >
            <select
              id="add-food-location"
              name="locationId"
              className="add-food-page__select"
              value={locationId}
              onChange={handleLocationChange}
              disabled={optionsLoading}
              required
            >
              <option value="">
                {optionsLoading ? 'Loading…' : 'Select a location'}
              </option>
              {locationOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.address}
                </option>
              ))}
            </select>
          </div>
          {errors.locationId && (
            <p className="add-food-page__error" role="alert">
              {errors.locationId}
            </p>
          )}
        </div>

        <div className="add-food-page__field">
          <label
            className="add-food-page__date-label"
            htmlFor="add-food-dietary"
          >
            Dietary Option
          </label>
          <div
            className={`add-food-page__select-wrapper${
              errors.dietaryId ? ' add-food-page__select-wrapper--error' : ''
            }`}
          >
            <select
              id="add-food-dietary"
              name="dietaryId"
              className="add-food-page__select"
              value={dietaryId}
              onChange={handleDietaryChange}
              disabled={optionsLoading}
              required
            >
              <option value="">
                {optionsLoading ? 'Loading…' : 'Select a dietary option'}
              </option>
              {dietaryOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          {errors.dietaryId && (
            <p className="add-food-page__error" role="alert">
              {errors.dietaryId}
            </p>
          )}
        </div>

        {/* ---- 4. Price (AUD) ---- */}
        <FormField
          label="Price (AUD)"
          name="price"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 12.50"
          value={price}
          onChange={handlePriceChange}
          error={errors.price}
          required
        />


        {/* ---- 5. Expiry date (real date input) ---- */}
        <div className="add-food-page__field">
          <label
            className="add-food-page__date-label"
            htmlFor={expiryInputId}
          >
            Expiry Date
          </label>
          <div
            className={`add-food-page__date-wrapper${
              errors.expiryDate ? ' add-food-page__date-wrapper--error' : ''
            }`}
          >
            <input
              id={expiryInputId}
              name="expiryDate"
              className="add-food-page__date-input"
              type="date"
              min={isEdit ? undefined : todayIso}
              value={expiryDate}
              onChange={handleDateChange}
              required
              aria-invalid={errors.expiryDate ? true : undefined}
              aria-describedby={errors.expiryDate ? expiryErrorId : undefined}
            />
          </div>
          {errors.expiryDate && (
            <p className="add-food-page__error" id={expiryErrorId} role="alert">
              {errors.expiryDate}
            </p>
          )}
        </div>

        {/* ---- 6. Expiry reminder ---- */}
        <label className="add-food-page__checkbox">
          <input
            type="checkbox"
            name="reminderEnabled"
            checked={reminderEnabled}
            onChange={(event) => setReminderEnabled(event.target.checked)}
          />
          <span className="add-food-page__checkbox-label">
            Enable expiry reminder
          </span>
        </label>

        {/* ---- 7. Submit (disabled while a request is in flight) ---- */}
        <PrimaryButton
          type="submit"
          fullWidth
          className="add-food-page__submit"
          disabled={isSubmitting || optionsLoading || optionsError !== null}
        >
          {isSubmitting
            ? isEdit
              ? 'Saving…'
              : 'Adding…'
            : isEdit
              ? 'Save Changes'
              : 'Add Product'}
        </PrimaryButton>
      </form>


      {/* ---- Success notification (adapted 21st.dev Alert) ----
          Rendered through a portal to document.body so the overlay
          always covers the real viewport. The description and
          thumbnail come from the saved record returned by the API
          (including its uploaded image_url). */}
      {showSuccessAlert &&
        savedItem &&
        createPortal(
          <div className="food-alert-overlay">
            <Alert>
              <div className="food-alert__row">
                <CircleCheck
                  className="food-alert__icon"
                  aria-hidden="true"
                />
                <div className="food-alert__content">
                  <AlertTitle>
                    {isEdit
                      ? 'Food updated successfully'
                      : 'Food added successfully'}
                  </AlertTitle>
                  <AlertDescription>
                    {isEdit
                      ? `“${savedItem.name}” has been updated.`
                      : `“${savedItem.name}” has been added with its expiry date.`}
                  </AlertDescription>
                </div>
              </div>
              {savedItem.image_url && (
                <img
                  className="add-food-page__success-image"
                  src={savedItem.image_url}
                  alt={savedItem.name}
                />
              )}
              <div className="food-alert__action">
                <PrimaryButton fullWidth onClick={handleSuccessDismiss}>
                  Back to Admin Home
                </PrimaryButton>
              </div>
            </Alert>
          </div>,
          document.body
        )}
    </main>
  )
}

export default AddFood

