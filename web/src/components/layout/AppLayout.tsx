import { Outlet, useLocation } from 'react-router-dom'
import { Bell, RefreshCw, Cpu, MemoryStick, Clock, HardDrive } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuthStore } from '@/store/auth.store'
import { useQuery } from '@tanstack/react-query'
import { systemApi } from '@/api'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/devices': 'Dispositivos',
  '/logs': 'Logs do Sistema',
  '/mass-ops': 'Operações em Massa',
  '/presets': 'Presets & Provisões',
  '/provisions': 'Presets & Provisões',
  '/files': 'Arquivos',
  '/settings': 'Configurações',
  '/users': 'Usuários',
  '/backup': 'Backup',
  '/docs': 'Documentação API',
  '/integrations': 'Integrações',
}

function MetricBadge({
  icon: Icon,
  label,
  value,
  color = 'slate',
}: {
  icon: React.ElementType
  label: string
  value: string
  color?: 'slate' | 'blue' | 'green' | 'amber' | 'red'
}) {
  const colorMap: Record<string, string> = {
    slate: 'text-slate-500',
    blue:  'text-blue-500',
    green: 'text-emerald-500',
    amber: 'text-amber-500',
    red:   'text-red-500',
  }
  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs" title={label}>
      <Icon className={`w-3 h-3 ${colorMap[color]}`} />
      <span className="text-slate-500 hidden xl:inline">{label}</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  )
}

function ServerMetrics() {
  const { data } = useQuery({
    queryKey: ['system-metrics'],
    queryFn: () => systemApi.getMetrics(),
    refetchInterval: 30_000,
    staleTime: 25_000,
  })

  // Relógio local atualizado a cada segundo
  const [now, setNow] = React.useState(new Date())
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  if (!data) {
    return (
      <MetricBadge icon={Clock} label="Hora" value={timeStr} color="blue" />
    )
  }

  const cpuPct = data.cpu?.usage ?? 0
  const memPct = data.memory?.usagePercent ?? 0
  const uptime = data.uptime?.systemFormatted ?? '—'

  const cpuColor = cpuPct > 80 ? 'red' : cpuPct > 60 ? 'amber' : 'green'
  const memColor = memPct > 85 ? 'red' : memPct > 70 ? 'amber' : 'green'

  return (
    <div className="flex items-center gap-1.5">
      <MetricBadge icon={Clock}      label="Hora"    value={timeStr}         color="blue"    />
      <MetricBadge icon={Cpu}        label="CPU"     value={`${cpuPct}%`}    color={cpuColor} />
      <MetricBadge icon={MemoryStick} label="RAM"   value={`${memPct}%`}    color={memColor} />
      <MetricBadge icon={HardDrive}  label="Uptime" value={uptime}           color="slate"   />
    </div>
  )
}

// Importação lazy do React para o componente de estado local
import React from 'react'

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
            {/* Métricas do servidor */}
            <ServerMetrics />

            <div className="h-6 w-px bg-slate-200" />

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
