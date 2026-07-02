import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Router, FileText, Settings, Users,
  LogOut, ChevronRight, ChevronDown, Activity,
  Layers, HardDrive, Code2, Bell, Cpu, Link2, Sparkles, BookOpen,
  Database, MessageCircle, Mail, Send, PanelLeftClose, PanelLeftOpen, Download,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import logoImg from '../../assets/logo.png'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { authApi, alertsApi } from '@/api'
import toast from 'react-hot-toast'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  exact?: boolean
  badge?: boolean
}

interface SubMenuItem {
  to: string
  icon: React.ElementType
  label: string
}

interface SidebarContextValue {
  collapsed: boolean
}

// ─── Context para propagar estado collapsed ───────────────────────────────────
import { createContext, useContext } from 'react'
const SidebarCtx = createContext<SidebarContextValue>({ collapsed: false })

// ─── Dados de navegação ───────────────────────────────────────────────────────
const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/devices', icon: Router, label: 'Dispositivos' },
  { to: '/alerts', icon: Bell, label: 'Alertas', badge: true },
  { to: '/logs', icon: FileText, label: 'Logs' },
  { to: '/mass-ops', icon: Activity, label: 'Operações em Massa' },
  { to: '/ai-analysis', icon: Sparkles, label: 'Análise IA' },
]

const genieItems: SubMenuItem[] = [
  { to: '/autoconfig', icon: Cpu, label: 'Autoconfig' },
  { to: '/presets', icon: Layers, label: 'Presets' },
  { to: '/provisions', icon: Code2, label: 'Provisões' },
  { to: '/files', icon: HardDrive, label: 'Arquivos' },
]

const adminItems: NavItem[] = [
  { to: '/integrations', icon: Link2, label: 'Integrações ERP' },
  { to: '/backup', icon: Database, label: 'Backup' },
  { to: '/docs', icon: BookOpen, label: 'Documentação API' },
  { to: '/users', icon: Users, label: 'Usuários' },
]

// ─── Componente: NavItem simples ──────────────────────────────────────────────
function SideNavLink({
  to,
  icon: Icon,
  label,
  exact,
  badge,
  unreadAlerts = 0,
}: NavItem & { unreadAlerts?: number }) {
  const { collapsed } = useContext(SidebarCtx)

  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors group relative ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    } ${collapsed ? 'justify-center' : ''}`

  return (
    <NavLink to={to} end={exact} className={cls} title={collapsed ? label : undefined}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1">{label}</span>
          {badge && unreadAlerts > 0 ? (
            <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {unreadAlerts > 99 ? '99+' : unreadAlerts}
            </span>
          ) : (
            <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </>
      )}
      {collapsed && badge && unreadAlerts > 0 && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      )}
    </NavLink>
  )
}

// ─── Componente: Grupo colapsável (submenu) ───────────────────────────────────
function CollapsibleGroup({
  icon: GroupIcon,
  label,
  items,
  defaultOpen = false,
}: {
  icon: React.ElementType
  label: string
  items: SubMenuItem[]
  defaultOpen?: boolean
}) {
  const { collapsed: sidebarCollapsed } = useContext(SidebarCtx)
  const location = useLocation()
  const isAnyActive = items.some((item) => location.pathname.startsWith(item.to))
  const [open, setOpen] = useState(defaultOpen || isAnyActive)

  // Abre automaticamente se uma rota filha estiver ativa
  useEffect(() => {
    if (isAnyActive) setOpen(true)
  }, [location.pathname, isAnyActive])

  // No modo collapsed, mostra apenas os ícones sem o grupo
  if (sidebarCollapsed) {
    return (
      <>
        {items.map(({ to, icon: Icon, label: itemLabel }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center justify-center px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
            title={itemLabel}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
          </NavLink>
        ))}
      </>
    )
  }

  return (
    <div>
      {/* Header do grupo */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors group ${
          isAnyActive && !open
            ? 'bg-slate-800 text-white'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <GroupIcon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Itens do submenu */}
      {open && (
        <div className="ml-3 mt-0.5 border-l border-slate-700/60 pl-2 space-y-0.5">
          {items.map(({ to, icon: Icon, label: itemLabel }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors group ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{itemLabel}</span>
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Sidebar({ onCollapse }: { onCollapse?: (v: boolean) => void }) {
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })

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

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebar_collapsed', String(next)) } catch { /* ignore */ }
    onCollapse?.(next)
  }

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
    toast.success('Sessão encerrada')
  }

  const sidebarWidth = collapsed ? 'w-16' : 'w-60'

  return (
    <SidebarCtx.Provider value={{ collapsed }}>
      <aside className={`fixed left-0 top-0 h-full ${sidebarWidth} bg-slate-900 flex flex-col z-30 transition-all duration-300`}>

        {/* ── Logo + Toggle ─────────────────────────────────────────────────── */}
        <div className={`flex items-center border-b border-slate-700/50 ${collapsed ? 'justify-center px-2 py-4' : 'gap-3 px-4 py-4'}`}>
          {collapsed ? (
            <img src={logoImg} alt="BR10 ACS" className="w-8 h-8 object-contain" />
          ) : (
            <img src={logoImg} alt="BR10 ACS" className="h-10 w-auto object-contain flex-1 min-w-0" />
          )}
          <button
            onClick={toggleCollapse}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition-colors flex-shrink-0"
            title={collapsed ? 'Expandir menu' : 'Retrair menu'}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* ── Navegação ─────────────────────────────────────────────────────── */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">

          {/* Principal */}
          {!collapsed && (
            <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider px-3 mb-2">
              Principal
            </p>
          )}
          {collapsed && <div className="h-2" />}

          {navItems.map((item) => (
            <SideNavLink key={item.to} {...item} unreadAlerts={unreadAlerts} />
          ))}

          {/* GenieACS */}
          <div className={collapsed ? 'pt-2' : 'pt-4'}>
            {!collapsed && (
              <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider px-3 mb-2">
                GenieACS
              </p>
            )}
            {collapsed && <div className="border-t border-slate-700/40 mb-2" />}
            <CollapsibleGroup
              icon={Cpu}
              label="GenieACS"
              items={genieItems}
              defaultOpen={true}
            />
          </div>

          {/* Administração */}
          {isAdmin && (
            <div className={collapsed ? 'pt-2' : 'pt-4'}>
              {!collapsed && (
                <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider px-3 mb-2">
                  Administração
                </p>
              )}
              {collapsed && <div className="border-t border-slate-700/40 mb-2" />}

              {adminItems.map((item) => (
                <SideNavLink key={item.to} {...item} />
              ))}

              {/* Configurações com submenus */}
              <CollapsibleGroup
                icon={Settings}
                label="Configurações"
                items={[
                  { to: '/settings', icon: Settings, label: 'Geral' },
                  { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
                  { to: '/settings/telegram', icon: Send, label: 'Telegram' },
                  { to: '/settings/email', icon: Mail, label: 'E-mail' },
                ]}
              />

              {/* Sistema */}
              <CollapsibleGroup
                icon={Download}
                label="Sistema"
                items={[
                  { to: '/system/update', icon: Download, label: 'Atualizar Sistema' },
                ]}
              />
            </div>
          )}
        </nav>

        {/* ── Usuário ───────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-700/50 p-2">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2 py-1">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-400 transition-colors p-1 rounded"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
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
              <div className="mt-1 px-2 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>v1.0.1-rev2</span>
                <span className="bg-slate-800 px-1 rounded text-slate-400">PROD</span>
              </div>
            </>
          )}
        </div>
      </aside>
    </SidebarCtx.Provider>
  )
}
