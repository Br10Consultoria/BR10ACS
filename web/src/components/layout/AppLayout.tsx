import { Outlet, useLocation } from 'react-router-dom'
import { Bell, RefreshCw } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuthStore } from '@/store/auth.store'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/devices': 'Dispositivos',
  '/logs': 'Logs do Sistema',
  '/mass-ops': 'Operações em Massa',
  '/settings': 'Configurações',
  '/users': 'Usuários',
}

export default function AppLayout() {
  const location = useLocation()
  const user = useAuthStore((s) => s.user)

  const title = Object.entries(pageTitles).find(([path]) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  )?.[1] || 'BR10 ACS'

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col ml-60 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
          <h1 className="text-slate-800 font-semibold text-base">{title}</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Recarregar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors relative">
              <Bell className="w-4 h-4" />
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-sm text-slate-600 font-medium">{user?.name}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
