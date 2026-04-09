import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/auth/Login'
import Patients from './pages/patients/Patients'
import PatientDetail from './pages/patients/PatientDetail'
import Schedule from './pages/Schedule'
import Treatments from './pages/Treatments'
import Prescriptions from './pages/Prescriptions'
import Billing from './pages/Billing'
import Inventory from './pages/Inventory'
import Settings from './pages/Settings'
import AccountNew from './pages/admin/AccountNew'
import AccountDetail from './pages/admin/AccountDetail'
import NotFound from './pages/NotFound'

export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser)
  const isLoading = useAuthStore((s) => s.isLoading)

  useEffect(() => { loadUser() }, [loadUser])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-black" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/"           element={<Navigate to="/patients" replace />} />
            <Route path="/patients"          element={<Patients />} />
            <Route path="/patients/:id"     element={<PatientDetail />} />
            <Route path="/schedule"       element={<Schedule />} />
            <Route path="/treatments"     element={<Treatments />} />
            <Route path="/prescriptions"  element={<Prescriptions />} />
            <Route path="/billing"       element={<Billing />} />
            <Route path="/inventory"     element={<Inventory />} />
            <Route path="/settings"      element={<Settings />} />
            <Route path="/settings/new"  element={<AccountNew />} />
            <Route path="/settings/:id"  element={<AccountDetail />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}