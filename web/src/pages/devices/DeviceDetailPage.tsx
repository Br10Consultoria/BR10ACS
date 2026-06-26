import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, RefreshCw, Power, RotateCcw, Wifi,
  Signal, Activity, Monitor, Code, Users, Search, Download
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

  const refreshMutation = useMutation({
    mutationFn: () => devicesApi.refresh(deviceId),
    onSuccess: () => {
      toast.success('Coleta forçada! Aguarde o dispositivo reportar...')
      setTimeout(() => qc.invalidateQueries({ queryKey: ['device', deviceId] }), 5000)
    },
    onError: () => toast.error('Falha ao forçar coleta'),
  })

  if (isLoading) return <LoadingScreen />
  if (!device) return <div className="text-center py-12 text-slate-500">Dispositivo não encontrado</div>

  const online = device.online as boolean
  const d = device as Record<string, unknown>

  // Extrai valor real de cada parâmetro (backend retorna {value, writable, type, timestamp})
  const extractRawValue = (v: unknown): string => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'object' && v !== null && 'value' in v) {
      const val = (v as Record<string, unknown>).value
      return val === null || val === undefined ? '—' : String(val)
    }
    return String(v)
  }

  const allRawEntries = rawParams
    ? Object.entries(rawParams as Record<string, unknown>)
    : []

  const filteredRaw = allRawEntries.filter(([k, v]) => {
    const strVal = extractRawValue(v)
    return !rawSearch ||
      k.toLowerCase().includes(rawSearch.toLowerCase()) ||
      strVal.toLowerCase().includes(rawSearch.toLowerCase())
  })

  const downloadRawParams = (fmt: 'csv' | 'json') => {
    const serial = (d.serialNumber as string) || deviceId.split('-').pop() || 'device'
    if (fmt === 'json') {
      const obj: Record<string, string> = {}
      allRawEntries.forEach(([k, v]) => { obj[k] = extractRawValue(v) })
      const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${serial}_params.json`; a.click(); URL.revokeObjectURL(url)
    } else {
      const rows = ['Parâmetro,Valor', ...allRawEntries.map(([k, v]) => `${k},"${extractRawValue(v).replace(/"/g, '""')}"`)]
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${serial}_params.csv`; a.click(); URL.revokeObjectURL(url)
    }
  }

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
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            title="Forçar coleta completa de todos os parâmetros TR-069"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => connReqMutation.mutate()}
            disabled={connReqMutation.isPending}
            title="Enviar Connection Request (acorda o dispositivo)"
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
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>Parâmetros TR-069 Brutos <span className="text-xs font-normal text-slate-400">({allRawEntries.length} parâmetros)</span></CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar parâmetros..."
                    value={rawSearch}
                    onChange={(e) => setRawSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
                  />
                </div>
                <button
                  onClick={() => downloadRawParams('csv')}
                  title="Download CSV"
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button
                  onClick={() => downloadRawParams('json')}
                  title="Download JSON"
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> JSON
                </button>
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
                    {filteredRaw.map(([key, value]) => {
                      const rawEntry = typeof value === 'object' && value !== null && 'value' in value
                        ? (value as Record<string, unknown>)
                        : null
                      const displayVal = extractRawValue(value)
                      const writable = rawEntry?.writable as boolean | undefined
                      return (
                        <tr key={key} className="hover:bg-slate-50 border-b border-slate-100">
                          <td className="px-4 py-2 font-mono text-slate-600 break-all">
                            {key}
                            {writable === false && <span className="ml-1.5 text-[10px] text-slate-400">(R)</span>}
                          </td>
                          <td className="px-4 py-2 text-slate-700 break-all">{displayVal}</td>
                        </tr>
                      )
                    })}
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
type DiagResult = Record<string, unknown> | null

function useDiagnostic(deviceId: string, type: 'ping' | 'traceroute' | 'speedtest') {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DiagResult>(null)
  const [status, setStatus] = useState<string>('')
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const run = async (params: Record<string, unknown>) => {
    setLoading(true)
    setResult(null)
    setStatus('Enviando comando...')
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null }
    try {
      await devicesApi.diagnostics(deviceId, type, params)
      setStatus('Aguardando resultado do dispositivo...')
      let attempts = 0
      const interval = setInterval(async () => {
        attempts++
        try {
          const { data } = await devicesApi.diagnosticsResult(deviceId, type)
          const state = String(data?.state || '')
          if (data && state && state !== 'Requested' && state !== 'None' && state !== '') {
            setResult(data)
            setStatus('')
            setLoading(false)
            clearInterval(interval)
            pollTimerRef.current = null
          } else if (attempts >= 20) {
            setStatus('Timeout: dispositivo nao respondeu')
            setLoading(false)
            clearInterval(interval)
            pollTimerRef.current = null
          }
        } catch {
          if (attempts >= 20) {
            setStatus('Erro ao obter resultado')
            setLoading(false)
            clearInterval(interval)
          }
        }
      }, 3000)
      pollTimerRef.current = interval
    } catch {
      toast.error(`Falha ao iniciar ${type}`)
      setStatus('')
      setLoading(false)
    }
  }

  return { loading, result, status, run }
}

function ResultBox({ result, type }: { result: DiagResult; type: string }) {
  if (!result) return null
  if (type === 'traceroute') {
    const hops = (result.hops as Record<string, unknown>[]) || []
    return (
      <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 space-y-1 overflow-x-auto">
        <div><span className="text-slate-400">host:</span> {String(result.host || '—')}</div>
        <div><span className="text-slate-400">state:</span> {String(result.state || '—')}</div>
        {hops.length > 0 && (
          <div className="mt-2">
            <div className="text-slate-400 mb-1">Hops:</div>
            {hops.map((h, i) => (
              <div key={i}>{String(h.hopIndex ?? i + 1).padStart(2, ' ')}. {String(h.hostAddress || h.host || '*')} {h.rttTimes ? `(${h.rttTimes}ms)` : ''}</div>
            ))}
          </div>
        )}
      </div>
    )
  }
  if (type === 'speedtest') {
    const start = result.startTime ? new Date(result.startTime as string).getTime() : null
    const end = result.endTime ? new Date(result.endTime as string).getTime() : null
    const durationMs = start && end ? end - start : null
    const bytes = Number(result.testBytes || result.totalBytes || 0)
    const mbps = durationMs && bytes ? ((bytes * 8) / (durationMs / 1000) / 1_000_000).toFixed(2) : null
    return (
      <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 space-y-1">
        <div><span className="text-slate-400">state:</span> {String(result.state || '—')}</div>
        <div><span className="text-slate-400">url:</span> {String(result.url || '—')}</div>
        <div><span className="text-slate-400">bytes recebidos:</span> {bytes ? `${(bytes / 1024 / 1024).toFixed(2)} MB` : '—'}</div>
        {durationMs && <div><span className="text-slate-400">duração:</span> {(durationMs / 1000).toFixed(1)}s</div>}
        {mbps && <div className="text-yellow-400"><span className="text-slate-400">velocidade:</span> {mbps} Mbps</div>}
      </div>
    )
  }
  return (
    <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-green-400 space-y-1">
      {Object.entries(result).map(([k, v]) => (
        <div key={k}><span className="text-slate-400">{k}:</span> {Array.isArray(v) ? JSON.stringify(v) : String(v ?? '—')}</div>
      ))}
    </div>
  )
}

function DiagnosticsTab({ deviceId }: { deviceId: string }) {
  const [pingHost, setPingHost] = useState('8.8.8.8')
  const [traceHost, setTraceHost] = useState('8.8.8.8')
  const [speedUrl, setSpeedUrl] = useState('http://speedtest.tele2.net/1MB.zip')

  const ping = useDiagnostic(deviceId, 'ping')
  const traceroute = useDiagnostic(deviceId, 'traceroute')
  const speedtest = useDiagnostic(deviceId, 'speedtest')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Ping */}
      <Card>
        <CardHeader><CardTitle>Ping</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <input type="text" value={pingHost} onChange={(e) => setPingHost(e.target.value)}
              placeholder="Host ou IP" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={() => ping.run({ host: pingHost })} disabled={ping.loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {ping.loading ? <RotateCcw className="w-4 h-4 animate-spin" /> : 'Ping'}
            </button>
          </div>
          {ping.status && <p className="text-xs text-slate-400 animate-pulse">{ping.status}</p>}
          <ResultBox result={ping.result} type="ping" />
        </CardContent>
      </Card>

      {/* Traceroute */}
      <Card>
        <CardHeader><CardTitle>Traceroute</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <input type="text" value={traceHost} onChange={(e) => setTraceHost(e.target.value)}
              placeholder="Host ou IP" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={() => traceroute.run({ host: traceHost })} disabled={traceroute.loading}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
              {traceroute.loading ? <RotateCcw className="w-4 h-4 animate-spin" /> : 'Trace'}
            </button>
          </div>
          {traceroute.status && <p className="text-xs text-slate-400 animate-pulse">{traceroute.status}</p>}
          <ResultBox result={traceroute.result} type="traceroute" />
        </CardContent>
      </Card>

      {/* Speed Test */}
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Teste de Velocidade (Download TR-069)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-500">O dispositivo fará o download do arquivo informado e reportará a velocidade via TR-069 DownloadDiagnostics.</p>
          <div className="flex gap-2">
            <input type="text" value={speedUrl} onChange={(e) => setSpeedUrl(e.target.value)}
              placeholder="URL do arquivo de teste" className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={() => speedtest.run({ url: speedUrl })} disabled={speedtest.loading}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
              {speedtest.loading ? <RotateCcw className="w-4 h-4 animate-spin" /> : 'Iniciar'}
            </button>
          </div>
          {speedtest.status && <p className="text-xs text-slate-400 animate-pulse">{speedtest.status}</p>}
          <ResultBox result={speedtest.result} type="speedtest" />
        </CardContent>
      </Card>
    </div>
  )
}
