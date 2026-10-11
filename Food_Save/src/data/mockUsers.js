/**
 * Hard-coded demo accounts for frontend-only mock authentication.
 *
 * The Sign In page (built later) matches the entered credentials
 * against this list and calls signIn(user.role) from AppContext:
 *   customer@foodsave.com / 123456 -> role "customer" -> /restaurants
 *   admin@foodsave.com    / 123456 -> role "admin"    -> /admin/add-food
 *
 * No backend, no database, no real authentication — demo only.
 * Create Account (built later) demos a Customer account only.
 */
export const mockUsers = [
  {
    email: 'customer@foodsave.com',
    password: '123456',
    role: 'customer',
  },
  {
    email: 'admin@foodsave.com',
    password: '123456',
    role: 'admin',
  },
]

/**
 * Returns the matching demo user, or null when the credentials
 * do not match. Email comparison is case-insensitive and
 * surrounding whitespace is ignored.
 */
export function findMockUser(email, password) {
  const normalizedEmail = String(email).trim().toLowerCase()
  return (
    mockUsers.find(
      (user) => user.email === normalizedEmail && user.password === password
    ) ?? null
  )
}