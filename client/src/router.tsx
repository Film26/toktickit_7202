import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import ProtectedRoute from './auth/ProtectedRoute'
import NavBar from './components/NavBar'
import LoginPage from './pages/LoginPage'
import FirstPasswordChangePage from './pages/FirstPasswordChangePage'
import RequesterDashboardPage from './pages/RequesterDashboardPage'
import CreateTicketPage from './pages/CreateTicketPage'
import RequesterTicketDetailPage from './pages/RequesterTicketDetailPage'
import ItStaffDashboardPage from './pages/ItStaffDashboardPage'
import ItStaffTicketDetailPage from './pages/ItStaffTicketDetailPage'
import UserManagementPage from './pages/UserManagementPage'
import ReferenceDataManagementPage from './pages/ReferenceDataManagementPage'
import AccessDeniedPage from './pages/AccessDeniedPage'
import NotFoundPage from './pages/NotFoundPage'
import App from './App'

function DashboardPage() {
  const { user } = useAuth()
  return user?.role === 'REQUESTER' ? <RequesterDashboardPage /> : <ItStaffDashboardPage />
}

function TicketDetailPage() {
  const { user } = useAuth()
  return user?.role === 'REQUESTER' ? <RequesterTicketDetailPage /> : <ItStaffTicketDetailPage />
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
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/new"
          element={
            <ProtectedRoute roles={['REQUESTER']}>
              <CreateTicketPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tickets/:id"
          element={
            <ProtectedRoute>
              <TicketDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['ADMINISTRATOR']}>
              <UserManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reference-data"
          element={
            <ProtectedRoute roles={['ADMINISTRATOR']}>
              <ReferenceDataManagementPage />
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
