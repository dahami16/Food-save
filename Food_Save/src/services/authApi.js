/**
 * authApi — the single HTTP layer between the Food Save frontend and
 * the FastAPI backend authentication endpoints.
 *
 * Endpoints (exact schemas from backend/app/schemas.py):
 *   POST /api/auth/signup  { full_name, email, password }
 *        -> 201 { user: { id, email, full_name, role },
 *                 session: { access_token, refresh_token } | null }
 *   POST /api/auth/login   { email, password }
 *        -> 200 { user: {...}, session: {...} } (or 401)
 *   GET  /api/auth/me      Authorization: Bearer <access_token>
 *        -> 200 { id, email, full_name, role }
 *
 * Rules:
 *   - Native fetch only — no Supabase SDK in the frontend.
 *   - Never logs passwords, tokens, keys or env values (no console use).
 *   - Every failure becomes an AuthApiError with a safe, displayable
 *     message so forms never see raw/network errors.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/** Safe, user-facing message per HTTP status (fallback only). */
const STATUS_FALLBACK_MESSAGES = {
  401: 'Incorrect email or password.',
  403: 'You do not have permission to perform this action.',
  422: 'Please check your details and try again.',
  429: 'Too many attempts. Please wait and try again.',
}

/** Display-safe error carrying the HTTP status (when known). */
export class AuthApiError extends Error {
  constructor(message, status = null) {
    super(message)
    this.name = 'AuthApiError'
    this.status = status
  }
}

function fallbackMessageFor(status) {
  if (STATUS_FALLBACK_MESSAGES[status]) return STATUS_FALLBACK_MESSAGES[status]
  if (status >= 500) {
    return 'Authentication is temporarily unavailable. Please try again later.'
  }
  return 'Something went wrong. Please try again.'
}

/**
 * Perform one JSON request against the backend.
 *
 * Resolves with the parsed JSON body on 2xx responses (already
 * validated as an object). Rejects with AuthApiError on network
 * failures, non-2xx statuses and malformed bodies — never throws
 * raw fetch/JSON errors into the UI.
 */
async function request(path, { method = 'GET', body = null, token = null } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== null) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
    })
  } catch {
    // Network failure — never surface URLs, tokens or low-level detail.
    throw new AuthApiError(
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
    // Backend error details are display-safe strings by design;
    // arrays/objects (e.g. FastAPI 422 validation) fall back to a
    // friendly message instead of raw validation dumps.
    const detail =
      data && typeof data.detail === 'string' ? data.detail : null
    throw new AuthApiError(detail || fallbackMessageFor(response.status), response.status)
  }

  if (data === null || typeof data !== 'object') {
    throw new AuthApiError(
      'Received an unexpected response from the server. Please try again.'
    )
  }
  return data
}

/** POST /api/auth/signup — register a customer account. */
export function signup(fullName, email, password) {
  return request('/api/auth/signup', {
    method: 'POST',
    body: { full_name: fullName, email, password },
  })
}

/** POST /api/auth/login — password sign-in. */
export function login(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

/** GET /api/auth/me — trusted profile for a Bearer token. */
export function getCurrentUser(accessToken) {
  if (!accessToken) {
    return Promise.reject(new AuthApiError('You are not signed in.'))
  }
  return request('/api/auth/me', { token: accessToken })
}