import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Router, FileText, Settings, Users,
  LogOut, ChevronRight, Wifi, Activity, Layers, HardDrive, Code2, Bell, Cpu, Link2, Sparkles, BookOpen, Database, MessageCircle
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { authApi, alertsApi } from '@/api'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/devices', icon: Router, label: 'Dispositivos' },
  { to: '/alerts', icon: Bell, label: 'Alertas', badge: true },
  { to: '/logs', icon: FileText, label: 'Logs' },
  { to: '/mass-ops', icon: Activity, label: 'Operações em Massa' },
  { to: '/ai-analysis', icon: Sparkles, label: 'Análise IA' },
]

const genieItems = [
  { to: '/autoconfig', icon: Cpu, label: 'Autoconfig' },
  { to: '/presets', icon: Layers, label: 'Presets' },
  { to: '/provisions', icon: Code2, label: 'Provisões' },
  { to: '/files', icon: HardDrive, label: 'Arquivos' },
]

const adminItems = [
  { to: '/integrations', icon: Link2, label: 'Integrações ERP' },
  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp Bot' },
  { to: '/backup', icon: Database, label: 'Backup' },
  { to: '/docs', icon: BookOpen, label: 'Documentação API' },
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

  const { data: alertCount } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: async () => {
      const res = await alertsApi.countUnacknowledged()
      return res.data as { count: number }
    },
    refetchInterval: 30000,
    staleTime: 20000,
  })

  const unreadAlerts = alertCount?.count ?? 0

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
        {navItems.map(({ to, icon: Icon, label, exact, badge }) => (
          <NavLink key={to} to={to} end={exact} className={navLinkClass}>
            <Icon className="w-4.5 h-4.5 flex-shrink-0" />
            <span className="flex-1">{label}</span>
            {badge && unreadAlerts > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {unreadAlerts > 99 ? '99+' : unreadAlerts}
              </span>
            )}
            {(!badge || unreadAlerts === 0) && (
              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
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
        <div className="mt-2 px-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
          <span>v1.0.1-rev1</span>
          <span className="bg-slate-800 px-1 rounded text-slate-400">PROD</span>
        </div>
      </div>
    </aside>
  )
}
