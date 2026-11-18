import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
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
import Agenda from '@/pages/agenda/Agenda'
import Companies from '@/pages/companies/Companies'
import Resources from '@/pages/resources/Resources'
import Tasks from '@/pages/tasks/Tasks'
import Help from '@/pages/help/Help'
import PublicEvents from '@/pages/public/PublicEvents'
import OrderStatus from '@/pages/public/OrderStatus'
import { can } from '@/utils/permissions'

function ProtectedRoute({ children }) {
  const { user, initializing } = useAuthStore()
  if (initializing) return null // aguarda /auth/me antes de decidir
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Página restrita a alguns papéis: quem não pode é levado ao painel.
function RoleRoute({ permission, children }) {
  const user = useAuthStore((s) => s.user)
  if (!can(user, permission)) return <Navigate to="/" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, initializing } = useAuthStore()
  if (initializing) return null
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const initFromStorage = useAuthStore((s) => s.initFromStorage)
  useEffect(() => { initFromStorage() }, [])

  return (
    // reducedMotion="user": respeita a preferência "reduzir movimento" do sistema
    <MotionConfig reducedMotion="user">
    <BrowserRouter>
      <Routes>
        {/* Venda online (fase 8): aberta ao público, com ou sem login */}
        <Route path="/ingressos" element={<PublicEvents />} />
        <Route path="/ingressos/pedido/:id" element={<OrderStatus />} />
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
          <Route path="agenda" element={<PageTransition><Agenda /></PageTransition>} />
          <Route path="tasks" element={<PageTransition><Tasks /></PageTransition>} />
          <Route path="resources" element={<PageTransition><Resources /></PageTransition>} />
          <Route path="companies" element={<PageTransition><Companies /></PageTransition>} />
          <Route path="cast" element={<RoleRoute permission="PEOPLE_DIRECTORY"><PageTransition><Cast /></PageTransition></RoleRoute>} />
          <Route path="finance" element={<RoleRoute permission="FINANCE_GLOBAL"><PageTransition><Finance /></PageTransition></RoleRoute>} />
          <Route path="tickets" element={<RoleRoute permission="TICKETS_CHECKIN"><PageTransition><Tickets /></PageTransition></RoleRoute>} />
          <Route path="insights" element={<RoleRoute permission="INSIGHTS"><PageTransition><Insights /></PageTransition></RoleRoute>} />
          <Route path="settings" element={<PageTransition><Settings /></PageTransition>} />
          <Route path="ajuda" element={<PageTransition><Help /></PageTransition>} />
        </Route>
      </Routes>
    </BrowserRouter>
    </MotionConfig>
  )
}
