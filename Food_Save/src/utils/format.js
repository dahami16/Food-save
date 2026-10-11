/**
 * Small display-only formatting helpers shared by the customer food
 * listing and the admin pages. No API calls, no state, no side effects.
 */

/** AUD currency formatting for the Australian-dollar interface. */
const audFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
})

/** Formats a numeric price as Australian dollars, e.g. 12.5 -> "A$12.50". */
export function formatAudPrice(value) {
  const price = Number(value)
  if (!Number.isFinite(price)) return ''
  return audFormatter.format(price)
}

/** Today's date as a local-timezone yyyy-mm-dd string. */
export function todayIsoDate() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Display-only expiry check for the ADMIN list (which intentionally
 * includes expired items). Pure ISO-date string comparison — this never
 * filters the public catalog, the backend owns that rule.
 */
export function isExpiredIsoDate(isoDate) {
  return Boolean(isoDate) && isoDate < todayIsoDate()
}