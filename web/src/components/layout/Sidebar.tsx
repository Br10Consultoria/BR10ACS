import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Router, FileText, Settings, Users,
  LogOut, ChevronRight, Wifi, Activity, Layers, HardDrive, Code2
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { authApi } from '@/api'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/devices', icon: Router, label: 'Dispositivos' },
  { to: '/logs', icon: FileText, label: 'Logs' },
  { to: '/mass-ops', icon: Activity, label: 'Operações em Massa' },
]

const genieItems = [
  { to: '/presets', icon: Layers, label: 'Presets' },
  { to: '/provisions', icon: Code2, label: 'Provisões' },
  { to: '/files', icon: HardDrive, label: 'Arquivos' },
]

const adminItems = [
  { to: '/settings', icon: Settings, label: 'Configurações' },
  { to: '/users', icon: Users, label: 'Usuários' },
]

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
    isActive
      ? 'bg-blue-600 text-white'
      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
  }`

export default function Sidebar() {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
    toast.success('Sessão encerrada')
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-slate-900 flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/50">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Wifi className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-white font-bold text-sm leading-tight">BR10 ACS</div>
          <div className="text-slate-400 text-xs">TR-069 Manager</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mb-2">
          Principal
        </p>
        {navItems.map(({ to, icon: Icon, label, exact }) => (
          <NavLink key={to} to={to} end={exact} className={navLinkClass}>
            <Icon className="w-4.5 h-4.5 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </NavLink>
        ))}

        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mt-5 mb-2">
          GenieACS
        </p>
        {genieItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={navLinkClass}>
            <Icon className="w-4.5 h-4.5 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-3 mt-5 mb-2">
              Administração
            </p>
            {adminItems.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} className={navLinkClass}>
                <Icon className="w-4.5 h-4.5 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-slate-700/50 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{user?.name}</div>
            <div className="text-slate-400 text-xs truncate capitalize">{user?.role?.replace('_', ' ')}</div>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-400 transition-colors p-1 rounded"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
