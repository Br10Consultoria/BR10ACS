import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, RefreshCw, Power, RotateCcw, Wifi,
  Signal, Activity, Monitor, Code, Users, Search
} from 'lucide-react'
import { devicesApi } from '@/api'
import { Card, CardHeader, CardTitle, CardContent, Badge, LoadingScreen } from '@/components/ui'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'info', label: 'Informações', icon: Monitor },
  { id: 'signal', label: 'Sinal', icon: Signal },
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { id: 'hosts', label: 'Hosts', icon: Users },
  { id: 'diagnostics', label: 'Diagnóstico', icon: Activity },
  { id: 'raw', label: 'Parâmetros Brutos', icon: Code },
]

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState('info')
  const [rawSearch, setRawSearch] = useState('')
  const qc = useQueryClient()

  const deviceId = decodeURIComponent(id || '')

  const { data: device, isLoading } = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => devicesApi.get(deviceId).then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: rawParams, isLoading: rawLoading } = useQuery({
    queryKey: ['device-raw', deviceId],
    queryFn: () => devicesApi.rawParams(deviceId).then(r => r.data),
    enabled: activeTab === 'raw',
  })

  const rebootMutation = useMutation({
    mutationFn: () => devicesApi.reboot(deviceId),
    onSuccess: () => { toast.success('Reboot solicitado'); qc.invalidateQueries({ queryKey: ['device', deviceId] }) },
    onError: () => toast.error('Falha ao solicitar reboot'),
  })

  const connReqMutation = useMutation({
    mutationFn: () => devicesApi.connectionRequest(deviceId),
    onSuccess: () => toast.success('Connection Request enviado'),
    onError: () => toast.error('Falha ao enviar Connection Request'),
  })

  if (isLoading) return <LoadingScreen />
  if (!device) return <div className="text-center py-12 text-slate-500">Dispositivo não encontrado</div>

  const online = device.online as boolean
  const d = device as Record<string, unknown>

  const filteredRaw = rawParams
    ? Object.entries(rawParams as Record<string, unknown>).filter(([k, v]) =>
        !rawSearch || k.toLowerCase().includes(rawSearch.toLowerCase()) ||
        String(v).toLowerCase().includes(rawSearch.toLowerCase())
      )
    : []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to="/devices" className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800 font-mono">
                {(d.serialNumber as string) || deviceId.split('-').pop()}
              </h2>
              <Badge variant={online ? 'green' : 'red'}>
                {online ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Online</> : 'Offline'}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {(d.manufacturer as string) || '—'} {(d.model as string) || '—'} · {(d.ip as string) || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => connReqMutation.mutate()}
            disabled={connReqMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${connReqMutation.isPending ? 'animate-spin' : ''}`} />
            Sync
          </button>
          <button
            onClick={() => { if (confirm('Confirma o reboot?')) rebootMutation.mutate() }}
            disabled={rebootMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <Power className="w-3.5 h-3.5" />
            Reboot
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto">
        {TABS.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === tabId
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card>
            <CardHeader><CardTitle>Dispositivo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Serial', d.serialNumber],
                ['Fabricante', d.manufacturer],
                ['Modelo', d.model],
                ['Firmware', d.softwareVersion],
                ['Hardware', d.hardwareVersion],
                ['OUI', d.oui],
                ['Uptime', d.uptime ? `${Math.floor((d.uptime as number) / 3600)}h ${Math.floor(((d.uptime as number) % 3600) / 60)}m` : null],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label as string}</span>
                  <span className="font-medium text-slate-700 text-right max-w-[60%] truncate">{(value as string) || '—'}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Conexão PPPoE</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Usuário PPPoE', d.pppLogin],
                ['IPv4', d.ipv4],
                ['IPv6', d.ipv6],
                ['Gateway', d.pppGateway],
                ['DNS', d.pppDNSServers],
                ['Status PPPoE', d.pppConnectionStatus],
                ['MAC WAN', d.pppMACAddress],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label as string}</span>
                  <span className="font-mono text-xs font-medium text-slate-700 text-right">{(value as string) || '—'}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Tráfego</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                ['Download Total', d.wanBytesReceived ? `${((d.wanBytesReceived as number) / 1048576).toFixed(1)} MB` : null],
                ['Upload Total', d.wanBytesSent ? `${((d.wanBytesSent as number) / 1048576).toFixed(1)} MB` : null],
                ['Bytes Recebidos', d.wanBytesReceived],
                ['Bytes Enviados', d.wanBytesSent],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between text-sm">
                  <span className="text-slate-500">{label as string}</span>
                  <span className="font-medium text-slate-700">{(value as string) || '—'}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Último Inform</span>
                  <span className="text-xs text-slate-600">
                    {d.lastInform ? formatDistanceToNow(new Date(d.lastInform as string), { addSuffix: true, locale: ptBR }) : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-slate-500">Registrado em</span>
                  <span className="text-xs text-slate-600">
                    {d.registered ? format(new Date(d.registered as string), 'dd/MM/yyyy HH:mm') : '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'signal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader><CardTitle>Sinal Óptico (PON)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'RX Power', value: d.rxPower, unit: 'dBm', good: [-27, -8] },
                { label: 'TX Power', value: d.txPower, unit: 'dBm', good: [0, 5] },
                { label: 'Temperatura', value: d.temperature, unit: '°C', good: [0, 70] },
                { label: 'Tensão', value: d.voltage, unit: 'V', good: [3.1, 3.5] },
              ].map(({ label, value, unit }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-bold text-slate-800">
                      {value != null ? `${value} ${unit}` : '—'}
                    </span>
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Status do Link</span>
                  <Badge variant={d.linkStatus === 'Up' ? 'green' : 'red'}>
                    {(d.linkStatus as string) || '—'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Connection Request</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">URL</span>
                <span className="font-mono text-xs text-slate-600 break-all text-right max-w-[70%]">
                  {(d.connectionRequestUrl as string) || '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Usuário</span>
                <span className="font-mono text-xs">{(d.connectionRequestUsername as string) || '—'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'wifi' && (
        <Card>
          <CardHeader><CardTitle>Redes Wi-Fi</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {((d.wifiNetworks as Record<string, unknown>[]) || []).map((net, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-slate-800">{(net.ssid as string) || `Rede ${i + 1}`}</span>
                    <Badge variant={(net.enabled as boolean) ? 'green' : 'gray'}>
                      {(net.enabled as boolean) ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Banda</span>
                      <span>{(net.band as string) || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Canal</span>
                      <span>{(net.channel as string) || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dispositivos</span>
                      <span>{(net.associated as number) ?? 0}</span>
                    </div>
                  </div>
                </div>
              ))}
              {(!(d.wifiNetworks as unknown[]) || (d.wifiNetworks as unknown[]).length === 0) && (
                <p className="text-slate-400 text-sm col-span-2 py-4 text-center">Nenhuma rede Wi-Fi coletada</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'hosts' && (
        <Card>
          <CardHeader><CardTitle>Hosts Conectados</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {((d.hosts as Record<string, unknown>[]) || []).map((host, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <Monitor className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-700">{(host.hostname as string) || 'Desconhecido'}</div>
                      <div className="text-xs text-slate-400 font-mono">{(host.mac as string) || '—'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-slate-600">{(host.ip as string) || '—'}</div>
                    <div className="text-xs text-slate-400">{(host.interface as string) || '—'}</div>
                  </div>
                </div>
              ))}
              {(!(d.hosts as unknown[]) || (d.hosts as unknown[]).length === 0) && (
                <p className="text-slate-400 text-sm py-4 text-center">Nenhum host conectado</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'diagnostics' && (
        <DiagnosticsTab deviceId={deviceId} />
      )}

      {activeTab === 'raw' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Parâmetros TR-069 Brutos</CardTitle>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar parâmetros..."
                  value={rawSearch}
                  onChange={(e) => setRawSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {rawLoading ? (
              <div className="p-8"><LoadingScreen /></div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-500 border-b border-slate-200 w-[60%]">Parâmetro</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-500 border-b border-slate-200">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRaw.map(([key, value]) => (
                      <tr key={key} className="hover:bg-slate-50 border-b border-slate-100">
                        <td className="px-4 py-2 font-mono text-slate-600 break-all">{key}</td>
                        <td className="px-4 py-2 text-slate-700 break-all">{String(value ?? '—')}</td>
                      </tr>
                    ))}
                    {filteredRaw.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-slate-400">
                          {rawSearch ? 'Nenhum parâmetro encontrado' : 'Sem parâmetros coletados'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ── Diagnostics Tab ───────────────────────────────────────────────────────────
function DiagnosticsTab({ deviceId }: { deviceId: string }) {
  const [pingHost, setPingHost] = useState('8.8.8.8')
  const [pingResult, setPingResult] = useState<Record<string, unknown> | null>(null)
  const [pingLoading, setPingLoading] = useState(false)

  const runPing = async () => {
    setPingLoading(true)
    try {
      const { data } = await devicesApi.diagnostics(deviceId, 'ping', { host: pingHost })
      setPingResult(data)
    } catch {
      toast.error('Falha ao executar ping')
    } finally {
      setPingLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card>
        <CardHeader><CardTitle>Ping</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={pingHost}
              onChange={(e) => setPingHost(e.target.value)}
              placeholder="Host ou IP"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={runPing}
              disabled={pingLoading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {pingLoading ? <RotateCcw className="w-4 h-4 animate-spin" /> : 'Ping'}
            </button>
          </div>
          {pingResult && (
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 space-y-1">
              {Object.entries(pingResult).map(([k, v]) => (
                <div key={k}><span className="text-slate-400">{k}:</span> {String(v)}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
