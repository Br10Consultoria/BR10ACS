import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import AppLayout from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import LoginPage from '@/pages/auth/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import DevicesPage from '@/pages/devices/DevicesPage'
import DeviceDetailPage from '@/pages/devices/DeviceDetailPage'
import LogsPage from '@/pages/logs/LogsPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import UsersPage from '@/pages/users/UsersPage'
import MassOpsPage from '@/pages/MassOpsPage'
import PresetsPage from '@/pages/PresetsPage'
import FilesPage from '@/pages/FilesPage'
import AlertsPage from '@/pages/alerts/AlertsPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="devices/:id" element={<DeviceDetailPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="mass-ops" element={<MassOpsPage />} />
            <Route path="presets" element={<PresetsPage />} />
            <Route path="provisions" element={<PresetsPage />} />
            <Route path="files" element={<FilesPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: { background: '#1e293b', color: '#f8fafc', fontSize: '13px', borderRadius: '10px' },
        success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }} />
    </QueryClientProvider>
  )
}
