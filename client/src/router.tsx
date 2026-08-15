import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import ProtectedRoute from './auth/ProtectedRoute'
import NavBar from './components/NavBar'
import LoginPage from './pages/LoginPage'
import FirstPasswordChangePage from './pages/FirstPasswordChangePage'
import AccessDeniedPage from './pages/AccessDeniedPage'
import NotFoundPage from './pages/NotFoundPage'
import App from './App'

function DashboardPlaceholder() {
  const { user } = useAuth()
  return (
    <div className="container py-4">
      <h1>Welcome, {user?.fullName}</h1>
      <p className="text-muted">Role: {user?.role}</p>
    </div>
  )
}

function AppRouter() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/first-password-change"
          element={
            <ProtectedRoute>
              <FirstPasswordChangePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPlaceholder />
            </ProtectedRoute>
          }
        />
        <Route path="/system-status" element={<App />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  )
}

export default AppRouter
