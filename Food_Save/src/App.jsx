import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AuthProvider } from './context/AuthContext'
import PlaceholderPage from './components/dev/PlaceholderPage'
import ProtectedRoute from './components/routing/ProtectedRoute'
import Welcome from './pages/Welcome'
import FreeDelivery from './pages/FreeDelivery'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import FindRestaurants from './pages/FindRestaurants'
import FoodList from './pages/FoodList'
import Filters from './pages/Filters'
import AccountSettings from './pages/AccountSettings'
import AdminHome from './pages/admin/AdminHome'
import AddFood from './pages/admin/AddFood'
import ExpiryAlarm from './pages/admin/ExpiryAlarm'

/**
 * Stage 1 route table.
 *
 * Every route currently renders the temporary PlaceholderPage.
 * Real pages will be built one by one in later stages, each at
 * its own file location, and will replace its placeholder here.
 */
function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Welcome />} />
      <Route path="/delivery" element={<FreeDelivery />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Customer routes */}
      <Route path="/restaurants" element={<FindRestaurants />} />
      <Route path="/food" element={<FoodList />} />
      <Route path="/filters" element={<Filters />} />
      <Route path="/account" element={<AccountSettings />} />

      {/* Hotel Admin only — demo-protected, redirects to /signin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/add-food"
        element={
          <ProtectedRoute>
            <AddFood />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/food-success"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Food Added Successfully (Hotel Admin)" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/expiry-alarm"
        element={
          <ProtectedRoute>
            <ExpiryAlarm />
          </ProtectedRoute>
        }
      />

      {/* Unknown routes fall back to Welcome */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AppProvider>
      {/* AuthProvider must sit inside AppProvider (it mirrors the
          trusted profile into AppContext role/isSignedIn state). */}
      <AuthProvider>
        <BrowserRouter>
          {/*
            Single responsive mobile shell. Max-width (430px) and
            desktop centring live HERE only — never inside pages.
          */}
          <div className="app-shell">
            <AppRoutes />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </AppProvider>
  )
}