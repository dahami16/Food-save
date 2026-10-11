import pizza1Image from '../assets/images/pizza1.jpg'
import burgerImage from '../assets/images/burger.jpg'
import noodleImage from '../assets/images/noodle.jpg'

/**
 * Initial Hotel Admin products shared by Admin Home (Uploaded
 * Products) and Expiry Alarm (reminder list).
 *
 * expiryDate uses the ISO yyyy-mm-dd format produced/consumed by
 * the native <input type="date"> element. reminderEnabled drives
 * the per-product Expiry Alarm toggle. New products added on the
 * Add Food page are appended to this list in AppContext for the
 * current React session only (no persistence by design).
 */
export const initialAdminProducts = [
  {
    id: 'pizza-combo',
    name: 'Pizza Combo',
    image: pizza1Image,
    expiryDate: '2026-09-20',
    reminderEnabled: true,
  },
  {
    id: 'chicken-burger',
    name: 'Chicken Burger',
    image: burgerImage,
    expiryDate: '2026-09-25',
    reminderEnabled: true,
  },
  {
    id: 'noodle-box',
    name: 'Noodle Box',
    image: noodleImage,
    expiryDate: '2026-10-02',
    reminderEnabled: false,
  },
]

/**
 * Formats an ISO date (yyyy-mm-dd) as a compact display string,
 * e.g. '2026-08-30' -> '30 Aug 2026'. The T00:00:00 suffix keeps
 * the date from shifting a day across time zones.
 */
export function formatExpiryDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}