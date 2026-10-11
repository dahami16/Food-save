/**
 * foodApi — the single HTTP layer between the Food Save frontend and
 * the FastAPI catalog / food management endpoints (Stage 3B contract).
 *
 * Endpoints (exact schemas from backend/app/schemas.py + routers/food.py):
 *   GET   /api/catalog/options
 *         -> { categories: [{ id, name, slug, display_order }],
 *              dietary_options: [{ id, name, display_order }],
 *              locations: [{ id, address }],
 *              price_options: [{ id, label, min_price, max_price, sort_order }] }
 *   GET   /api/food?search=&category_id=&dietary_id=&location_id=
 *              &min_price=&max_price=   -> { items: [FoodItemPublic] }
 *   GET   /api/admin/food      Authorization: Bearer <access_token>
 *         -> { items: [FoodItemAdmin] }  (expired items included)
 *   POST  /api/admin/food      multipart/form-data (admin only)
 *         fields: image, name, category_id, location_id, dietary_id,
 *                 price, expiry_date, reminder_enabled?
 *         -> 201 FoodItemAdmin
 *   PATCH /api/admin/food/{id} multipart/form-data (all fields optional)
 *         -> FoodItemAdmin
 *   DEL   /api/admin/food/{id} -> { status: "deleted",
 *                                   image_cleanup: "completed"|"failed"|"not_applicable" }
 *
 * Rules:
 *   - Native fetch only — no new API client dependency, no Supabase SDK.
 *   - The Supabase access token is read from the SAME sessionStorage key
 *     AuthContext owns ('foodsave.accessToken') — never a second auth
 *     system, never a hard-coded token.
 *   - FormData requests never set Content-Type manually (the browser
 *     adds the multipart boundary itself).
 *   - Never logs tokens, credentials or env values (no console use).
 *   - Every failure becomes a FoodApiError with a safe, displayable
 *     message; raw/network errors never reach the UI.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/** Same key AuthContext uses — token handling is never duplicated. */
const TOKEN_STORAGE_KEY = 'foodsave.accessToken'

/** Safe, user-facing message per HTTP status (fallback only). */
const STATUS_FALLBACK_MESSAGES = {
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to manage food items.',
  404: 'The requested food item was not found.',
  429: 'Too many requests. Please wait and try again.',
}

/** Display-safe error carrying the HTTP status (when known). */
export class FoodApiError extends Error {
  constructor(message, status = null) {
    super(message)
    this.name = 'FoodApiError'
    this.status = status
  }
}

function fallbackMessageFor(status) {
  if (STATUS_FALLBACK_MESSAGES[status]) return STATUS_FALLBACK_MESSAGES[status]
  if (status >= 500) {
    return 'The service is temporarily unavailable. Please try again later.'
  }
  return 'Something went wrong. Please try again.'
}

/** Reads the existing Supabase access token (null when absent). */
function readAccessToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Token for admin requests; 401-style error when the user is signed out. */
function requireToken() {
  const token = readAccessToken()
  if (!token) {
    throw new FoodApiError(STATUS_FALLBACK_MESSAGES[401], 401)
  }
  return token
}

/**
 * Perform one request against the backend.
 *
 * Resolves with the parsed JSON body on 2xx responses. Rejects with
 * FoodApiError on network failures, non-2xx statuses and malformed
 * bodies. Backend `detail` strings are display-safe by design; array
 * bodies (FastAPI 422 validation dumps) fall back to a friendly
 * message instead of raw validation output.
 */
async function request(
  path,
  { method = 'GET', token = null, formData = null, query = null } = {}
) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  // NOTE: never set Content-Type for FormData — fetch must add the
  // multipart boundary itself.

  let url = `${API_BASE_URL}${path}`
  if (query) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue
      params.append(key, String(value))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }

  let response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: formData ?? undefined,
    })
  } catch {
    // Network failure — never surface URLs, tokens or low-level detail.
    throw new FoodApiError(
      'Unable to reach the server. Please check your connection and try again.'
    )
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null // empty or malformed body — handled below
  }

  if (!response.ok) {
    const detail =
      data && typeof data.detail === 'string' ? data.detail : null
    throw new FoodApiError(
      detail || fallbackMessageFor(response.status),
      response.status
    )
  }

  if (data === null || typeof data !== 'object') {
    throw new FoodApiError(
      'Received an unexpected response from the server. Please try again.'
    )
  }
  return data
}

// ---- Catalog ---------------------------------------------------------------

/**
 * GET /api/catalog/options — categories, dietary options, locations
 * and price options. The successful response is cached for the current
 * session (reference data is stable); failures are never cached so a
 * retry always refetches.
 */
let catalogPromise = null

export function getCatalogOptions() {
  if (!catalogPromise) {
    catalogPromise = request('/api/catalog/options').catch((error) => {
      catalogPromise = null
      throw error
    })
  }
  return catalogPromise
}

// ---- Public listings -------------------------------------------------------

/**
 * GET /api/food — non-expired public listings with optional filters.
 *
 * filters: { search, categoryId, dietaryId, locationId, minPrice, maxPrice }
 * Empty values are omitted from the query string entirely.
 */
export function listFood(filters = {}) {
  return request('/api/food', {
    query: {
      search: filters.search,
      category_id: filters.categoryId,
      dietary_id: filters.dietaryId,
      location_id: filters.locationId,
      min_price: filters.minPrice,
      max_price: filters.maxPrice,
    },
  })
}

// ---- Administrator management (Bearer token required) ----------------------

/** GET /api/admin/food — every listing, expired items included. */
export function adminListFood() {
  return request('/api/admin/food', { token: requireToken() })
}

/** POST /api/admin/food — create a listing (multipart: image + fields). */
export function createFood(formData) {
  return request('/api/admin/food', {
    method: 'POST',
    token: requireToken(),
    formData,
  })
}

/** PATCH /api/admin/food/{id} — partial update (multipart, image optional). */
export function updateFood(foodId, formData) {
  return request(`/api/admin/food/${foodId}`, {
    method: 'PATCH',
    token: requireToken(),
    formData,
  })
}

/**
 * DELETE /api/admin/food/{id} — delete a listing.
 * Resolves to { status, image_cleanup }; callers must report a
 * 'failed' image_cleanup honestly and never claim Storage deletion.
 */
export function deleteFood(foodId) {
  return request(`/api/admin/food/${foodId}`, {
    method: 'DELETE',
    token: requireToken(),
  })
}