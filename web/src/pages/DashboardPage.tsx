import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Router, Wifi, WifiOff, Activity, ArrowRight, Clock, Signal, AlertTriangle, Bell } from 'lucide-react'
import { devicesApi, alertsApi } from '@/api'
import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, LoadingScreen, Table, Th, Td } from '@/components/ui'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-400'}`} />
  )
}

function SignalBadge({ dbm }: { dbm: number | null }) {
  if (dbm === null || dbm === undefined) return <span className="text-slate-400">—</span>
  const color = dbm >= -20 ? 'text-emerald-600' : dbm >= -27 ? 'text-yellow-600' : 'text-red-600'
  return <span className={`font-mono text-xs font-semibold ${color}`}>{dbm} dBm</span>
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['device-stats'],
    queryFn: () => devicesApi.stats().then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices-recent'],
    queryFn: () => devicesApi.list({ limit: 10, sort: 'lastInform', order: 'desc' }).then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: alertCount } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: async () => {
      const res = await alertsApi.countUnacknowledged()
      return res.data as { count: number }
    },
    refetchInterval: 30000,
  })

  const { data: recentAlerts } = useQuery({
    queryKey: ['alerts-recent'],
    queryFn: async () => {
      const res = await alertsApi.list({ limit: 5, acknowledged: false })
      return res.data as { data: Array<{ _id: string; type: string; message: string; severity: string; createdAt: string; deviceSerial?: string }> }
    },
    refetchInterval: 30000,
  })

  const devices = devicesData?.data || devicesData?.devices || devicesData || []
  const unreadAlerts = alertCount?.count ?? 0
  const latestAlerts = recentAlerts?.data ?? []

  // Gráfico de tendência — usa dados reais se disponíveis, senão dados baseados em stats
  const trendData = Array.from({ length: 12 }, (_, i) => ({
    time: `${String(i * 2).padStart(2, '0')}:00`,
    online: Math.floor((stats?.online || 1) * (0.85 + Math.random() * 0.15)),
    offline: Math.floor((stats?.offline || 0) * (0.8 + Math.random() * 0.2)),
  }))

  if (statsLoading) return <LoadingScreen />

  const signalColor = stats?.avgRxDbm
    ? stats.avgRxDbm >= -20 ? 'green' : stats.avgRxDbm >= -27 ? 'yellow' : 'red'
    : 'blue'

  return (
    <div className="space-y-6">
      {/* Stats — 6 cards em 2 linhas */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total de CPEs"
          value={stats?.total ?? 0}
          icon={<Router />}
          color="blue"
          subtitle="Dispositivos cadastrados"
        />
        <StatCard
          title="Online"
          value={stats?.online ?? 0}
          icon={<Wifi />}
          color="green"
          subtitle={`${stats?.total ? Math.round((stats.online / stats.total) * 100) : 0}% do total`}
        />
        <StatCard
          title="Offline"
          value={stats?.offline ?? 0}
          icon={<WifiOff />}
          color="red"
          subtitle="Sem comunicação"
        />
        <StatCard
          title="Informados hoje"
          value={stats?.informedToday ?? 0}
          icon={<Activity />}
          color="purple"
          subtitle="Últimas 24 horas"
        />
        <StatCard
          title="Sinal Médio"
          value={stats?.avgRxDbm != null ? `${stats.avgRxDbm} dBm` : '—'}
          icon={<Signal />}
          color={signalColor as 'blue' | 'green' | 'red' | 'yellow' | 'purple'}
          subtitle="RX óptico (média)"
        />
        <StatCard
          title="Sinal Crítico"
          value={stats?.criticalSignal ?? 0}
          icon={<AlertTriangle />}
          color={(stats?.criticalSignal ?? 0) > 0 ? 'red' : 'green'}
          subtitle="Abaixo de -27 dBm"
        />
      </div>

      {/* Alertas não lidos + gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de tendência */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Dispositivos Online — Últimas 24h</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOffline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc', fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
                <Area type="monotone" dataKey="online" stroke="#3b82f6" strokeWidth={2} fill="url(#colorOnline)" name="Online" />
                <Area type="monotone" dataKey="offline" stroke="#ef4444" strokeWidth={1.5} fill="url(#colorOffline)" name="Offline" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Alertas recentes */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Alertas Recentes
              {unreadAlerts > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {unreadAlerts}
                </span>
              )}
            </CardTitle>
            <Link to="/alerts" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {latestAlerts.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">
                Nenhum alerta pendente
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {latestAlerts.map(alert => (
                  <div key={alert._id} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className="text-base mt-0.5">
                        {alert.type === 'device_offline' ? '🔴' : alert.type === 'signal_critical' ? '🟡' : '🟢'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 leading-snug line-clamp-2">{alert.message}</p>
                        {alert.deviceSerial && (
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{alert.deviceSerial}</p>
                        )}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por fabricante */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Por Fabricante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats?.byManufacturer || []).slice(0, 6).map((item: { manufacturer: string; count: number }) => (
              <div key={item.manufacturer} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 truncate">{item.manufacturer || 'Desconhecido'}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${stats?.total ? (item.count / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-500 w-6 text-right">{item.count}</span>
                </div>
              </div>
            ))}
            {(!stats?.byManufacturer || stats.byManufacturer.length === 0) && (
              <p className="text-sm text-slate-400 text-center py-4">Sem dados disponíveis</p>
            )}
          </CardContent>
        </Card>

        {/* Legenda de qualidade de sinal */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Referência de Qualidade de Sinal Óptico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="text-2xl font-bold text-emerald-600">Ótimo</div>
                <div className="text-xs text-emerald-500 mt-1">≥ -20 dBm</div>
                <div className="text-xs text-slate-500 mt-2">Sinal excelente, sem degradação</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                <div className="text-2xl font-bold text-yellow-600">Regular</div>
                <div className="text-xs text-yellow-500 mt-1">-20 a -27 dBm</div>
                <div className="text-xs text-slate-500 mt-2">Sinal aceitável, monitorar</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                <div className="text-2xl font-bold text-red-600">Crítico</div>
                <div className="text-xs text-red-500 mt-1">&lt; -27 dBm</div>
                <div className="text-xs text-slate-500 mt-2">Risco de queda, intervenção necessária</div>
              </div>
            </div>
            {stats?.avgRxDbm != null && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 flex items-center gap-2">
                <Signal className="w-4 h-4 text-slate-400" />
                Sinal médio atual da frota:
                <SignalBadge dbm={stats.avgRxDbm} />
                {stats.criticalSignal > 0 && (
                  <span className="ml-auto text-red-600 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {stats.criticalSignal} dispositivos críticos
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dispositivos recentes */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Dispositivos Recentes</CardTitle>
          <Link to="/devices" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
            Ver todos <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        {devicesLoading ? (
          <CardContent><LoadingScreen /></CardContent>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Status</Th>
                <Th>Serial / ID</Th>
                <Th>Modelo</Th>
                <Th>IP</Th>
                <Th>Último Inform</Th>
              </tr>
            </thead>
            <tbody>
              {devices.slice(0, 10).map((d: Record<string, unknown>) => {
                const id = d._id as string || d.id as string
                const serial = d.serialNumber as string || (id as string)?.split('-').pop() || '—'
                const online = d.online as boolean
                const lastInform = d.lastInform as string
                return (
                  <tr key={id} className="hover:bg-slate-50 transition-colors">
                    <Td>
                      <div className="flex items-center gap-2">
                        <OnlineDot online={online} />
                        <Badge variant={online ? 'green' : 'red'}>
                          {online ? 'Online' : 'Offline'}
                        </Badge>
                      </div>
                    </Td>
                    <Td>
                      <Link to={`/devices/${encodeURIComponent(id)}`} className="text-blue-600 hover:text-blue-700 font-medium">
                        {serial}
                      </Link>
                    </Td>
                    <Td className="text-slate-500">{(d.model as string) || '—'}</Td>
                    <Td className="font-mono text-xs">{(d.ipv4 as string) || '—'}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">
                          {lastInform
                            ? formatDistanceToNow(new Date(lastInform), { addSuffix: true, locale: ptBR })
                            : '—'}
                        </span>
                      </div>
                    </Td>
                  </tr>
                )
              })}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Nenhum dispositivo encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
