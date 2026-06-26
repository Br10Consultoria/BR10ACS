import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Router, Wifi, WifiOff, Activity, ArrowRight, Clock } from 'lucide-react'
import { devicesApi } from '@/api'
import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, LoadingScreen, Table, Th, Td } from '@/components/ui'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-400'}`} />
  )
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

  const devices = devicesData?.devices || devicesData || []

  // Dados simulados para o gráfico de tendência (substituir por TimeSeries real)
  const trendData = Array.from({ length: 12 }, (_, i) => ({
    time: `${String(i * 2).padStart(2, '0')}:00`,
    online: Math.floor((stats?.online || 1) * (0.85 + Math.random() * 0.15)),
    offline: Math.floor((stats?.offline || 0) * (0.8 + Math.random() * 0.2)),
  }))

  if (statsLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>

      {/* Gráfico + Tabela */}
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
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f8fafc', fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="online" stroke="#3b82f6" strokeWidth={2} fill="url(#colorOnline)" name="Online" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição por fabricante */}
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
                    <Td className="font-mono text-xs">{(d.ip as string) || '—'}</Td>
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
