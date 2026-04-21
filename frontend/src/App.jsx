import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import AppShell from '@/components/layout/AppShell'
import PageTransition from '@/components/layout/PageTransition'
import Login from '@/pages/auth/Login'
import Dashboard from '@/pages/dashboard/Dashboard'
import Productions from '@/pages/productions/Productions'
import ProductionDetail from '@/pages/productions/ProductionDetail'
import Cast from '@/pages/cast/Cast'
import Finance from '@/pages/finance/Finance'
import Tickets from '@/pages/tickets/Tickets'
import Insights from '@/pages/insights/Insights'
import Settings from '@/pages/settings/Settings'

function ProtectedRoute({ children }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user } = useAuthStore()
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const initFromStorage = useAuthStore((s) => s.initFromStorage)
  useEffect(() => { initFromStorage() }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<PageTransition><Dashboard /></PageTransition>} />
          <Route path="productions" element={<PageTransition><Productions /></PageTransition>} />
          <Route path="productions/:id" element={<PageTransition><ProductionDetail /></PageTransition>} />
          <Route path="cast" element={<PageTransition><Cast /></PageTransition>} />
          <Route path="finance" element={<PageTransition><Finance /></PageTransition>} />
          <Route path="tickets" element={<PageTransition><Tickets /></PageTransition>} />
          <Route path="insights"  element={<PageTransition><Insights /></PageTransition>} />
          <Route path="settings" element={<PageTransition><Settings /></PageTransition>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
