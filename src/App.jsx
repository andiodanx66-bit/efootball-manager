import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/layout/Layout'
import LoginPage      from './pages/LoginPage'
import RegisterPage   from './pages/RegisterPage'
import DashboardPage  from './pages/DashboardPage'
import SeasonsPage    from './pages/SeasonsPage'
import SeasonDetail   from './pages/SeasonDetail'
import TeamsPage      from './pages/TeamsPage'
import TeamDetail     from './pages/TeamDetail'
import MyTeamPage     from './pages/MyTeamPage'
import StatisticsPage from './pages/StatisticsPage'
import AdminPage      from './pages/AdminPage'
import ProfilePage    from './pages/ProfilePage'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  return isAdmin ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index              element={<DashboardPage />} />
            <Route path="seasons"     element={<SeasonsPage />} />
            <Route path="seasons/:id" element={<SeasonDetail />} />
            <Route path="teams"       element={<TeamsPage />} />
            <Route path="teams/:id"   element={<TeamDetail />} />
            <Route path="my-team"     element={<MyTeamPage />} />
            <Route path="statistics"  element={<StatisticsPage />} />
            <Route path="admin"       element={<AdminRoute><AdminPage /></AdminRoute>} />
            <Route path="profile"     element={<ProfilePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
