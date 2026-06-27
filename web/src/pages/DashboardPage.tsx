import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Router, Wifi, WifiOff, Activity, Signal, AlertTriangle,
  Clock, ArrowRight, X, ChevronRight,
} from 'lucide-react'
import { devicesApi, alertsApi } from '@/api'
import { Card, CardHeader, CardTitle, CardContent, Badge, LoadingScreen, Table, Th, Td } from '@/components/ui'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function OnlineDot({ online }: { online: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-400'}`} />
}

function SignalBadge({ dbm }: { dbm: number }) {
  if (dbm >= -20) return <Badge variant="green">{dbm} dBm</Badge>
  if (dbm >= -27) return <Badge variant="yellow">{dbm} dBm</Badge>
  return <Badge variant="red">{dbm} dBm</Badge>
}

type DrillTarget = 'total' | 'online' | 'offline' | 'informed' | 'signal' | 'critical' | null

interface DrillDevice {
  _id?: string
  id?: string
  serialNumber?: string
  online?: boolean
  lastInform?: string
  model?: string
  ipv4?: string
  rxPower?: number
  manufacturer?: string
}

interface StatCardProps {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
  iconBg: string
  onClick?: () => void
  clickable?: boolean
}

function StatCard({ label, value, sub, icon, iconBg, onClick, clickable = true }: StatCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      className={`bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 text-left w-full transition-all ${
        clickable ? 'hover:shadow-md hover:border-blue-300 cursor-pointer' : 'cursor-default'
      }`}
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</div>
        <div className="text-2xl font-bold text-slate-800 mt-0.5">{value}</div>
        <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
      </div>
      {clickable && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
    </button>
  )
}

interface DrillModalProps {
  target: DrillTarget
  devices: DrillDevice[]
  onClose: () => void
}

function DrillModal({ target, devices, onClose }: DrillModalProps) {
  const navigate = useNavigate()
  if (!target) return null

  const titles: Record<NonNullable<DrillTarget>, string> = {
    total: 'Todos os Dispositivos',
    online: 'Dispositivos Online',
    offline: 'Dispositivos Offline',
    informed: 'Informados nas Últimas 24h',
    signal: 'Sinal Óptico — Todos',
    critical: 'Sinal Crítico (< -27 dBm)',
  }

  const filtered = devices.filter(d => {
    if (target === 'online') return d.online
    if (target === 'offline') return !d.online
    if (target === 'informed') {
      if (!d.lastInform) return false
      return Date.now() - new Date(d.lastInform).getTime() < 24 * 3600 * 1000
    }
    if (target === 'signal') return d.rxPower != null
    if (target === 'critical') return d.rxPower != null && d.rxPower < -27
    return true
  })

  const showSignal = target === 'signal' || target === 'critical'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800">{titles[target]}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length} dispositivo{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onClose(); navigate('/devices') }}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Ver em Dispositivos <ArrowRight className="w-3 h-3" />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Router className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>Nenhum dispositivo nesta categoria</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Serial</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Modelo</th>
                  {showSignal && (
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sinal RX</th>
                  )}
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Último Inform</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => {
                  const id = d._id || d.id || ''
                  const serial = d.serialNumber || id.split('-').pop() || '—'
                  return (
                    <tr key={id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <OnlineDot online={!!d.online} />
                          <Badge variant={d.online ? 'green' : 'red'}>{d.online ? 'Online' : 'Offline'}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{serial}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{d.model || '—'}</td>
                      {showSignal && (
                        <td className="px-4 py-3">
                          {d.rxPower != null ? <SignalBadge dbm={d.rxPower} /> : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">
                        {d.lastInform ? formatDistanceToNow(new Date(d.lastInform), { addSuffix: true, locale: ptBR }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/devices/${encodeURIComponent(id)}`}
                          onClick={onClose}
                          className="text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center gap-1 justify-end"
                        >
                          Detalhes <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [drillTarget, setDrillTarget] = useState<DrillTarget>(null)

  const { data: stats } = useQuery({
    queryKey: ['device-stats'],
    queryFn: () => devicesApi.getStats().then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: devicesData, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices-all-dashboard'],
    queryFn: () => devicesApi.list({ limit: 200 }).then(r => r.data),
    refetchInterval: 60000,
  })

  const { data: alertsData } = useQuery({
    queryKey: ['alerts-recent'],
    queryFn: () => alertsApi.list({ limit: 5, acknowledged: false }).then(r => r.data),
    refetchInterval: 30000,
  })

  const devices: DrillDevice[] = devicesData?.data || devicesData?.devices || devicesData || []
  const recentAlerts: Record<string, unknown>[] = alertsData?.data || alertsData?.alerts || []

  const onlineCount = devices.filter(d => d.online).length
  const offlineCount = devices.filter(d => !d.online).length
  const informedToday = devices.filter(d => {
    if (!d.lastInform) return false
    return Date.now() - new Date(d.lastInform).getTime() < 24 * 3600 * 1000
  }).length

  const totalCount: number = stats?.total ?? devices.length
  const avgRxDbm: number | null = stats?.avgRxDbm ?? null
  const criticalCount: number = stats?.criticalSignal ?? 0

  return (
    <div className="space-y-6">
      {drillTarget && (
        <DrillModal target={drillTarget} devices={devices} onClose={() => setDrillTarget(null)} />
      )}

      {/* StatCards clicáveis */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total de CPEs"
          value={totalCount}
          sub="Dispositivos cadastrados"
          iconBg="bg-blue-100"
          icon={<Router className="w-6 h-6 text-blue-600" />}
          onClick={() => setDrillTarget('total')}
        />
        <StatCard
          label="Online"
          value={onlineCount}
          sub={totalCount > 0 ? `${Math.round((onlineCount / totalCount) * 100)}% do total` : '—'}
          iconBg="bg-emerald-100"
          icon={<Wifi className="w-6 h-6 text-emerald-600" />}
          onClick={() => setDrillTarget('online')}
        />
        <StatCard
          label="Offline"
          value={offlineCount}
          sub="Sem comunicação"
          iconBg="bg-red-100"
          icon={<WifiOff className="w-6 h-6 text-red-500" />}
          onClick={() => setDrillTarget('offline')}
        />
        <StatCard
          label="Informados Hoje"
          value={informedToday}
          sub="Últimas 24 horas"
          iconBg="bg-purple-100"
          icon={<Activity className="w-6 h-6 text-purple-600" />}
          onClick={() => setDrillTarget('informed')}
        />
        <StatCard
          label="Sinal Médio"
          value={avgRxDbm != null ? `${avgRxDbm} dBm` : '—'}
          sub="RX óptico (média)"
          iconBg="bg-green-100"
          icon={<Signal className="w-6 h-6 text-green-600" />}
          onClick={() => setDrillTarget('signal')}
          clickable={avgRxDbm != null}
        />
        <StatCard
          label="Sinal Crítico"
          value={criticalCount}
          sub="Abaixo de -27 dBm"
          iconBg={criticalCount > 0 ? 'bg-orange-100' : 'bg-slate-100'}
          icon={<AlertTriangle className={`w-6 h-6 ${criticalCount > 0 ? 'text-orange-500' : 'text-slate-400'}`} />}
          onClick={() => setDrillTarget('critical')}
          clickable={criticalCount > 0}
        />
      </div>

      {/* Alertas recentes + Qualidade de sinal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Alertas Recentes</CardTitle>
            <Link to="/alerts" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentAlerts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm px-4">Nenhum alerta pendente</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentAlerts.map((a) => (
                  <div key={a._id as string} className="flex items-start gap-3 px-4 py-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      (a.severity as string) === 'critical' ? 'bg-red-500' :
                      (a.severity as string) === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 truncate">{a.message as string}</div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono">{a.deviceSerial as string}</div>
                    </div>
                    <div className="text-xs text-slate-400 flex-shrink-0">
                      {a.createdAt ? formatDistanceToNow(new Date(a.createdAt as string), { addSuffix: true, locale: ptBR }) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Qualidade de Sinal Óptico</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="text-lg font-bold text-emerald-600">Ótimo</div>
                <div className="text-xs text-emerald-500 mt-1">≥ -20 dBm</div>
                <div className="text-xs text-slate-500 mt-1.5">Sem degradação</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                <div className="text-lg font-bold text-yellow-600">Regular</div>
                <div className="text-xs text-yellow-500 mt-1">-20 a -27 dBm</div>
                <div className="text-xs text-slate-500 mt-1.5">Monitorar</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                <div className="text-lg font-bold text-red-600">Crítico</div>
                <div className="text-xs text-red-500 mt-1">&lt; -27 dBm</div>
                <div className="text-xs text-slate-500 mt-1.5">Intervenção</div>
              </div>
            </div>
            {avgRxDbm != null && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 flex items-center gap-2 flex-wrap">
                <Signal className="w-4 h-4 text-slate-400" />
                <span>Sinal médio da frota:</span>
                <SignalBadge dbm={avgRxDbm} />
                {criticalCount > 0 && (
                  <button
                    onClick={() => setDrillTarget('critical')}
                    className="ml-auto text-red-600 font-semibold flex items-center gap-1 text-xs hover:text-red-700"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {criticalCount} críticos
                  </button>
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
                <Th>Fabricante / Modelo</Th>
                <Th>IP</Th>
                <Th>Último Inform</Th>
              </tr>
            </thead>
            <tbody>
              {devices.slice(0, 10).map((d: DrillDevice) => {
                const id = d._id || d.id || ''
                const serial = d.serialNumber || id.split('-').pop() || '—'
                const online = !!d.online
                return (
                  <tr key={id} className="hover:bg-slate-50 transition-colors">
                    <Td>
                      <div className="flex items-center gap-2">
                        <OnlineDot online={online} />
                        <Badge variant={online ? 'green' : 'red'}>{online ? 'Online' : 'Offline'}</Badge>
                      </div>
                    </Td>
                    <Td>
                      <Link to={`/devices/${encodeURIComponent(id)}`} className="text-blue-600 hover:text-blue-700 font-medium font-mono text-xs">
                        {serial}
                      </Link>
                    </Td>
                    <Td>
                      <div>
                        <div className="text-xs font-medium text-slate-700">{d.manufacturer || '—'}</div>
                        <div className="text-xs text-slate-400">{d.model || '—'}</div>
                      </div>
                    </Td>
                    <Td className="font-mono text-xs">{d.ipv4 || '—'}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3 h-3" />
                        <span className="text-xs">
                          {d.lastInform
                            ? formatDistanceToNow(new Date(d.lastInform), { addSuffix: true, locale: ptBR })
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
