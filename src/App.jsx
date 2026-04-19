import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import { setRefreshFn } from './services/api.js'
import { startOnlineWatcher, recoverOrphanedSessions } from './services/pendingQueue.js'
import LoginPage from './pages/LoginPage.jsx'
import HomePage from './pages/HomePage.jsx'
import ReadPage from './pages/ReadPage.jsx'
import ReportPage from './pages/ReportPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return children
}

export default function App() {
  const { refreshAccessToken } = useAuth()

  useEffect(() => {
    setRefreshFn(refreshAccessToken)
  }, [refreshAccessToken])

  // Boot recovery: migrate the legacy localStorage queue and promote any
  // sessions left in 'recording' state (tab crashed mid-dictation) to 'ready'
  // so the queue can pick them up. Then start the online watcher.
  useEffect(() => {
    recoverOrphanedSessions()
      .catch(() => {})
      .finally(() => startOnlineWatcher())
  }, [])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/read" element={<ProtectedRoute><ReadPage /></ProtectedRoute>} />
      <Route path="/report/:id" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
