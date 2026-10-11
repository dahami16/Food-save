import { createContext, useContext, useState } from 'react'

import { initialAdminProducts } from '../data/adminProducts'

/**
 * App-wide shared state for the Food Save MVP.
 *
 * React Context + useState only. Authentication is owned by
 * AuthContext (Stage 3A); this provider still mirrors the trusted
 * role into the legacy `role` / `isSignedIn` flags.
 *
 * role supports: null | "customer" | "admin"
 */
const AppContext = createContext(null)

/**
 * Shared customer filter state — the single source of filter truth
 * between the Filters page (writes) and the Food List page (reads).
 * Values are the real IDs returned by GET /api/catalog/options so the
 * same selection drives GET /api/food query parameters directly:
 *   categories[0] -> category_id   dietary[0] -> dietary_id
 *   priceRange    -> min_price / max_price (option object kept whole
 *                    for the label)        locationId -> location_id
 */
const INITIAL_FILTERS = {
  categories: [],
  dietary: [],
  priceRange: null, // { id, label, min_price, max_price } | null
  locationId: null,
  search: '', // committed search term (preserved across /food <-> /filters)
  sortBy: 'recommended',
}

export function AppProvider({ children }) {
  // ---- Session / role ---------------------------------------------
  const [role, setRole] = useState(null) // null | "customer" | "admin"
  const [isSignedIn, setIsSignedIn] = useState(false)

  // ---- Customer discovery ------------------------------------------
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [activeFilters, setActiveFilters] = useState(INITIAL_FILTERS)

  // ---- Food items (mock list + admin-added items) -------------------
  const [foodItems, setFoodItems] = useState([])
  const [lastAddedFood, setLastAddedFood] = useState(null)

  // ---- Expiry alarm (Hotel Admin) ------------------------------------
  const [expiryAlarm, setExpiryAlarm] = useState({
    enabled: false,
    datetime: null,
  })

  // ---- Admin products (Hotel Admin /admin flow) ----------------------
  // Shared list rendered by Admin Home (Uploaded Products) and the
  // Expiry Alarm page. Starts from the mock data; products added on
  // Add Food are appended here for the current React session only.
  const [adminProducts, setAdminProducts] = useState(initialAdminProducts)

  /**
   * Mock sign-in (frontend only).
   *
   * The Sign In page (built later) will match the entered
   * credentials against src/data/mockUsers.js and call
   * signIn(user.role):
   *   customer@foodsave.com / 123456 -> role "customer"
   *   admin@foodsave.com    / 123456 -> role "admin"
   */
  function signIn(newRole) {
    setRole(newRole)
    setIsSignedIn(true)
  }

  /** Mock sign-out: clears the temporary session state. */
  function signOut() {
    setRole(null)
    setIsSignedIn(false)
    setSelectedLocation(null)
    setActiveFilters(INITIAL_FILTERS)
    setLastAddedFood(null)
    setExpiryAlarm({ enabled: false, datetime: null })
    setAdminProducts(initialAdminProducts)
  }

  /**
   * Admin adds a food item. Appends it to the in-memory list and
   * keeps it as lastAddedFood for the "Food Added Successfully"
   * screen summary (built later).
   */
  function addFood(item) {
    setFoodItems((prevItems) => [...prevItems, item])
    setLastAddedFood(item)
  }

  /**
   * Hotel Admin adds a product on the Add Food page. Appends it to
   * the shared admin list rendered by Admin Home and Expiry Alarm.
   */
  function addAdminProduct(product) {
    setAdminProducts((prevProducts) => [...prevProducts, product])
  }

  /** Flips one product's Expiry Alarm reminder toggle. */
  function toggleProductReminder(productId) {
    setAdminProducts((prevProducts) =>
      prevProducts.map((product) =>
        product.id === productId
          ? { ...product, reminderEnabled: !product.reminderEnabled }
          : product
      )
    )
  }

  const value = {
    // state
    role,
    isSignedIn,
    selectedLocation,
    activeFilters,
    foodItems,
    lastAddedFood,
    expiryAlarm,
    adminProducts,
    // actions
    signIn,
    signOut,
    setSelectedLocation,
    setActiveFilters,
    addFood,
    setExpiryAlarm,
    addAdminProduct,
    toggleProductReminder,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

/** Hook for consuming the shared app state. */
export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used inside an <AppProvider>')
  }
  return context
}