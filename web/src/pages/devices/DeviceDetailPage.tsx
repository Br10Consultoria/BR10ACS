import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, RefreshCw, Power, RotateCcw, Wifi,
  Signal, Activity, Monitor, Code, Users, Search, Download, Tag, X, Trash2, History, User,
  Building2, Phone, Mail, MapPin, ExternalLink, Loader2
} from 'lucide-react'
import { devicesApi, logsApi, integrationsApi } from '@/api'
import { Card, CardHeader, CardTitle, CardContent, Badge, LoadingScreen } from '@/components/ui'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'

const TABS = [
  { id: 'info', label: 'Informações', icon: Monitor },
  { id: 'signal', label: 'Sinal', icon: Signal },
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { id: 'hosts', label: 'Hosts', icon: Users },
  { id: 'diagnostics', label: 'Diagnóstico', icon: Activity },
  { id: 'history', label: 'Histórico', icon: History },
  { id: 'erp', label: 'Cliente ERP', icon: Building2 },
  { id: 'raw', label: 'Parâmetros Brutos', icon: Code },
]

// Formata bytes em unidade legível
function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('info')
  const [rawSearch, setRawSearch] = useState('')
  const [isPolling, setIsPolling] = useState(false)
  const [pollCountdown, setPollCountdown] = useState(0)
  const [showTagEditor, setShowTagEditor] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const qc = useQueryClient()
  const deviceId = decodeURIComponent(id || '')

  // Polling inteligente: após Refresh/Sync, re-fetch a cada 5s por 60s
  const startPolling = (durationSec = 60) => {
    if (pollRef.current) clearInterval(pollRef.current)
    setIsPolling(true)
    setPollCountdown(durationSec)
    let remaining = durationSec
    pollRef.current = setInterval(() => {
      remaining -= 5
      setPollCountdown(remaining)
      qc.invalidateQueries({ queryKey: ['device', deviceId] })
      qc.invalidateQueries({ queryKey: ['device-timeseries', deviceId] })
      if (remaining <= 0) {
        clearInterval(pollRef.current!)
        pollRef.current = null
        setIsPolling(false)
        setPollCountdown(0)
        toast.success('Dados atualizados!')
      }
    }, 5000)
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const { data: device, isLoading } = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => devicesApi.get(deviceId).then(r => r.data),
    refetchInterval: isPolling ? 5000 : 30000,
  })

  const { data: rawParams, isLoading: rawLoading } = useQuery({
    queryKey: ['device-raw', deviceId],
    queryFn: () => devicesApi.rawParams(deviceId).then(r => r.data),
    enabled: activeTab === 'raw',
  })

  const { data: timeSeries } = useQuery({
    queryKey: ['device-timeseries', deviceId],
    queryFn: () => devicesApi.getTimeSeries(deviceId).then(r => r.data),
    enabled: activeTab === 'signal',
  })

  const { data: deviceLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['device-logs', deviceId],
    queryFn: () => logsApi.list({ deviceId, limit: 100 }).then(r => r.data),
    enabled: activeTab === 'history',
    refetchInterval: activeTab === 'history' ? 30000 : false,
  })

  const rebootMutation = useMutation({
    mutationFn: () => devicesApi.reboot(deviceId),
    onSuccess: () => { toast.success('Reboot solicitado'); qc.invalidateQueries({ queryKey: ['device', deviceId] }) },
    onError: () => toast.error('Falha ao solicitar reboot'),
  })

  const connReqMutation = useMutation({
    mutationFn: () => devicesApi.connectionRequest(deviceId),
    onSuccess: () => {
      toast.success('Connection Request enviado — monitorando por 60s...')
      startPolling(60)
    },
    onError: () => toast.error('Falha ao enviar Connection Request'),
  })

  const refreshMutation = useMutation({
    mutationFn: () => devicesApi.refresh(deviceId),
    onSuccess: () => {
      toast.success('Refresh solicitado — monitorando por 60s...')
      startPolling(60)
    },
    onError: () => toast.error('Falha ao forçar coleta'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => devicesApi.delete(deviceId),
    onSuccess: () => {
      toast.success('Dispositivo removido')
      navigate('/devices')
    },
    onError: () => toast.error('Falha ao remover dispositivo'),
  })

  const addTagMutation = useMutation({
    mutationFn: (tag: string) => devicesApi.addTag(deviceId, tag),
    onSuccess: () => {
      toast.success('Tag adicionada')
      qc.invalidateQueries({ queryKey: ['device', deviceId] })
      setTagInput('')
    },
    onError: () => toast.error('Falha ao adicionar tag'),
  })

  const removeTagMutation = useMutation({
    mutationFn: (tag: string) => devicesApi.removeTag(deviceId, tag),
    onSuccess: () => {
      toast.success('Tag removida')
      qc.invalidateQueries({ queryKey: ['device', deviceId] })
    },
    onError: () => toast.error('Falha ao remover tag'),
  })

  if (isLoading) return <LoadingScreen />
  if (!device) return <div className="text-center py-12 text-slate-500">Dispositivo não encontrado</div>

  const online = device.online as boolean
  const d = device as Record<string, unknown>
  const tags = (d.tags as string[]) || []

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

  // Prepara dados do gráfico de sinal
  const chartData = Array.isArray(timeSeries)
    ? timeSeries.map((p: Record<string, unknown>) => ({
        time: p.timestamp ? format(new Date(p.timestamp as string), 'HH:mm') : '',
        rx: p.rxDbm != null ? Number(p.rxDbm) : null,
        tx: p.txDbm != null ? Number(p.txDbm) : null,
      })).reverse()
    : []

  return (
    <div className="space-y-5">
      {/* Indicador de polling ativo */}
      {isPolling && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <RefreshCw className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-blue-700">Monitorando atualizações — re-fetch a cada 5s</span>
              <span className="text-xs text-blue-600 font-mono">{pollCountdown}s restantes</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-1">
              <div
                className="bg-blue-600 h-1 rounded-full transition-all duration-1000"
                style={{ width: `${(pollCountdown / 60) * 100}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setIsPolling(false); setPollCountdown(0) }}
            className="text-xs text-blue-500 hover:text-blue-700 font-medium"
          >Parar</button>
        </div>
      )}

      {/* Confirmação de exclusão */}
      {showDeleteConfirm && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <Trash2 className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700 flex-1">Confirma a remoção do dispositivo <strong>{(d.serialNumber as string) || deviceId}</strong>? Esta ação não pode ser desfeita.</span>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
          >Remover</button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100"
          >Cancelar</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to="/devices" className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-800 font-mono">
                {(d.serialNumber as string) || deviceId.split('-').pop()}
              </h2>
              <Badge variant={online ? 'green' : 'red'}>
                {online ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Online</> : 'Offline'}
              </Badge>
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-medium">
                  {tag}
                  <button onClick={() => removeTagMutation.mutate(tag)} className="hover:text-indigo-900">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setShowTagEditor(!showTagEditor)}
                className="inline-flex items-center gap-1 px-2 py-0.5 border border-dashed border-slate-300 text-slate-400 rounded-full text-xs hover:border-indigo-300 hover:text-indigo-500 transition-colors"
              >
                <Tag className="w-3 h-3" /> tag
              </button>
            </div>
            {showTagEditor && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { addTagMutation.mutate(tagInput.trim()) } }}
                  placeholder="Nova tag (Enter para adicionar)"
                  className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
                  autoFocus
                />
                <button
                  onClick={() => { if (tagInput.trim()) addTagMutation.mutate(tagInput.trim()) }}
                  disabled={!tagInput.trim() || addTagMutation.isPending}
                  className="px-2.5 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >Adicionar</button>
                <button onClick={() => setShowTagEditor(false)} className="text-xs text-slate-400 hover:text-slate-600">Fechar</button>
              </div>
            )}
            <p className="text-sm text-slate-500 mt-0.5">
              {(d.manufacturer as string) || '—'} {(d.model as string) || '—'} · {(d.ipv4 as string) || (d.ip as string) || '—'}
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
          <button
            onClick={() => setShowDeleteConfirm(true)}
            title="Remover dispositivo"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
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
              {/* Download */}
              {d.wanBytesReceived != null && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Download Total</span>
                    <span className="font-semibold text-blue-700">{formatBytes(d.wanBytesReceived as number)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, ((d.wanBytesReceived as number) / 10_737_418_240) * 100)}%` }} />
                  </div>
                </div>
              )}
              {/* Upload */}
              {d.wanBytesSent != null && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Upload Total</span>
                    <span className="font-semibold text-emerald-700">{formatBytes(d.wanBytesSent as number)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, ((d.wanBytesSent as number) / 10_737_418_240) * 100)}%` }} />
                  </div>
                </div>
              )}
              {d.wanBytesReceived == null && d.wanBytesSent == null && (
                <p className="text-xs text-slate-400 text-center py-2">Dados de tráfego não disponíveis — faça Refresh para coletar</p>
              )}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Último Inform</span>
                  <span className="text-xs text-slate-600">
                    {d.lastInform ? formatDistanceToNow(new Date(d.lastInform as string), { addSuffix: true, locale: ptBR }) : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
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
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader><CardTitle>Sinal Óptico (PON)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'RX Power', value: d.rxPower, unit: 'dBm', good: [-27, -8], color: 'text-blue-700' },
                  { label: 'TX Power', value: d.txPower, unit: 'dBm', good: [0, 5], color: 'text-emerald-700' },
                  { label: 'Temperatura', value: d.temperature, unit: '°C', good: [0, 70], color: 'text-orange-600' },
                  { label: 'Tensão', value: d.voltage, unit: 'V', good: [3.1, 3.5], color: 'text-purple-700' },
                ].map(({ label, value, unit, good, color }) => {
                  const num = value != null ? Number(value) : null
                  const inRange = num != null && num >= good[0] && num <= good[1]
                  const outRange = num != null && (num < good[0] || num > good[1])
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-500">{label}</span>
                        <span className={`font-bold ${outRange ? 'text-red-600' : inRange ? color : 'text-slate-400'}`}>
                          {num != null ? `${num} ${unit}` : '—'}
                          {outRange && <span className="ml-1 text-xs">⚠</span>}
                        </span>
                      </div>
                      {num != null && (
                        <div className="text-xs text-slate-400">
                          Faixa ideal: {good[0]} a {good[1]} {unit}
                        </div>
                      )}
                    </div>
                  )
                })}
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

          {/* Gráfico histórico de sinal */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Histórico de Sinal (últimas 24h)</CardTitle>
                <span className="text-xs text-slate-400">{chartData.length} pontos coletados</span>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Signal className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">Nenhum dado histórico disponível</p>
                  <p className="text-xs mt-1">O histórico é coletado automaticamente a cada ciclo do coletor</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      formatter={(value, name) => [value != null ? `${Number(value).toFixed(2)} dBm` : '—', name === 'rx' ? 'RX Power' : 'TX Power']}
                    />
                    <Legend formatter={(v) => v === 'rx' ? 'RX Power' : 'TX Power'} />
                    <ReferenceLine y={-27} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Min', fontSize: 10, fill: '#ef4444' }} />
                    <ReferenceLine y={-8} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Max', fontSize: 10, fill: '#f59e0b' }} />
                    <Line type="monotone" dataKey="rx" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="tx" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'wifi' && (
        <WifiTab deviceId={deviceId} device={d} />
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
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Eventos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {logsLoading ? (
              <div className="p-8"><LoadingScreen /></div>
            ) : (() => {
              const raw = deviceLogs as { data?: Record<string, unknown>[]; total?: number } | Record<string, unknown>[] | null
              const logs: Record<string, unknown>[] = Array.isArray(raw) ? raw : (raw as { data?: Record<string, unknown>[] })?.data || []
              if (logs.length === 0) {
                return (
                  <div className="text-center py-12 text-slate-400">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-20" />
                    <p>Nenhum evento registrado para este dispositivo</p>
                  </div>
                )
              }
              return (
                <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                  {logs.map((log, idx) => {
                    const level = (log.level as string) || 'info'
                    const dotColor = level === 'error' ? 'bg-red-500' : level === 'warn' ? 'bg-yellow-500' : 'bg-blue-400'
                    const catColor: Record<string, string> = { auth: 'bg-purple-100 text-purple-700', device: 'bg-blue-100 text-blue-700', cwmp: 'bg-cyan-100 text-cyan-700', autoconfig: 'bg-indigo-100 text-indigo-700', massop: 'bg-orange-100 text-orange-700', system: 'bg-slate-100 text-slate-600' }
                    const cat = (log.category as string) || 'system'
                    return (
                      <div key={(log._id as string) || idx} className="flex items-start gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${dotColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${catColor[cat] || catColor.system}`}>{cat}</span>
                            <span className="text-xs font-medium text-slate-700 truncate">{(log.message as string) || '—'}</span>
                          </div>
                          {!!(log.metadata) && Object.keys(log.metadata as object).length > 0 && (
                            <pre className="text-xs text-slate-400 mt-1 bg-slate-50 rounded p-1.5 overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex-shrink-0 text-right whitespace-nowrap">
                          {log.date
                            ? format(new Date(log.date as string), 'dd/MM/yy HH:mm', { locale: ptBR })
                            : '—'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}
      {activeTab === 'erp' && (
        <ErpTab deviceId={deviceId} pppLogin={(d.pppLogin as string) || ''} serialNumber={(d.serialNumber as string) || ''} />
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

interface AiIssue { title: string; description: string; severity: 'ok' | 'warning' | 'critical' }
interface AiRecommendation { priority: 'high' | 'medium' | 'low'; action: string; reason: string }
interface AiResult {
  summary: string
  severity: 'ok' | 'warning' | 'critical'
  issues: AiIssue[]
  recommendations: AiRecommendation[]
  predictedCause?: string
  estimatedImpact?: string
}

function DiagnosticsTab({ deviceId }: { deviceId: string }) {
  const [pingHost, setPingHost] = useState('8.8.8.8')
  const [traceHost, setTraceHost] = useState('8.8.8.8')
  const [speedUrl, setSpeedUrl] = useState('http://speedtest.tele2.net/1MB.zip')
  const ping = useDiagnostic(deviceId, 'ping')
  const traceroute = useDiagnostic(deviceId, 'traceroute')
  const speedtest = useDiagnostic(deviceId, 'speedtest')

  const aiMut = useMutation({
    mutationFn: () => devicesApi.aiAnalysis(deviceId).then(r => r.data as AiResult),
    onError: () => toast.error('Erro na análise IA'),
  })

  const severityColor = (s: string) => {
    if (s === 'critical') return 'text-red-600 bg-red-50 border-red-200'
    if (s === 'warning') return 'text-amber-600 bg-amber-50 border-amber-200'
    return 'text-green-600 bg-green-50 border-green-200'
  }
  const priorityColor = (p: string) => {
    if (p === 'high') return 'bg-red-100 text-red-700'
    if (p === 'medium') return 'bg-amber-100 text-amber-700'
    return 'bg-slate-100 text-slate-600'
  }

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

      {/* Análise IA */}
      <Card className="lg:col-span-2 border-2 border-indigo-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">IA</span>
              </div>
              <div>
                <CardTitle>Diagnóstico Inteligente</CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Análise automática de sinal, uptime e eventos com IA (GPT-4o-mini)</p>
              </div>
            </div>
            <button
              onClick={() => aiMut.mutate()}
              disabled={aiMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {aiMut.isPending ? (
                <><RotateCcw className="w-4 h-4 animate-spin" /> Analisando...</>
              ) : (
                <><span>✦</span> Analisar com IA</>
              )}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {!aiMut.data && !aiMut.isPending && (
            <div className="text-center py-8 text-slate-400">
              <div className="text-4xl mb-3">✦</div>
              <p className="text-sm">Clique em "Analisar com IA" para obter um diagnóstico inteligente desta ONT.</p>
              <p className="text-xs mt-1">A IA analisa sinal óptico, uptime, histórico de eventos e recomenda ações.</p>
            </div>
          )}
          {aiMut.isPending && (
            <div className="text-center py-8 text-indigo-400">
              <RotateCcw className="w-8 h-8 animate-spin mx-auto mb-3" />
              <p className="text-sm">Coletando dados e analisando com IA...</p>
            </div>
          )}
          {aiMut.data && (() => {
            const r = aiMut.data
            return (
              <div className="space-y-4">
                {/* Sumário */}
                <div className={`p-4 rounded-lg border ${severityColor(r.severity)}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm uppercase tracking-wide">
                      {r.severity === 'ok' ? '✓ Normal' : r.severity === 'warning' ? '⚠ Atenção' : '✕ Crítico'}
                    </span>
                  </div>
                  <p className="text-sm">{r.summary}</p>
                  {r.predictedCause && (
                    <p className="text-xs mt-2 opacity-80"><strong>Causa provável:</strong> {r.predictedCause}</p>
                  )}
                  {r.estimatedImpact && (
                    <p className="text-xs mt-1 opacity-80"><strong>Impacto estimado:</strong> {r.estimatedImpact}</p>
                  )}
                </div>

                {/* Problemas */}
                {r.issues?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Problemas identificados</h4>
                    <div className="space-y-2">
                      {r.issues.map((issue, i) => (
                        <div key={i} className={`p-3 rounded-lg border ${severityColor(issue.severity)}`}>
                          <p className="text-sm font-medium">{issue.title}</p>
                          <p className="text-xs mt-0.5 opacity-80">{issue.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recomendações */}
                {r.recommendations?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Recomendações</h4>
                    <div className="space-y-2">
                      {r.recommendations.map((rec, i) => (
                        <div key={i} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full h-fit mt-0.5 ${priorityColor(rec.priority)}`}>
                            {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Média' : 'Baixa'}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-800">{rec.action}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{rec.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}
// ── Wi-Fi Tab com edição remota ───────────────────────────────────────────────
function WifiTab({ deviceId, device }: { deviceId: string; device: Record<string, unknown> }) {
  const qc = useQueryClient()
  const networks: Record<string, unknown>[] = (device.wifiNetworks as Record<string, unknown>[]) || []

  // Estado de edição por rede (índice)
  const [editing, setEditing] = React.useState<number | null>(null)
  const [editSsid, setEditSsid] = React.useState('')
  const [editPass, setEditPass] = React.useState('')
  const [showPass, setShowPass] = React.useState(false)

  const setParamMutation = useMutation({
    mutationFn: ({ name, value }: { name: string; value: string }) =>
      devicesApi.setParam(deviceId, name, value),
    onSuccess: () => {
      toast.success('Parâmetro enviado ao dispositivo')
      qc.invalidateQueries({ queryKey: ['device', deviceId] })
      setEditing(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Falha ao enviar parâmetro. Verifique se o dispositivo está online.')
    },
  })

  const applyWifi = (net: Record<string, unknown>, idx: number) => {
    // Tenta TR-098 primeiro, fallback para TR-181
    const manufacturer = ((device as Record<string, unknown>)?.manufacturer as string || '').toLowerCase()
    let base: string
    if (manufacturer.includes('huawei') || manufacturer.includes('nokia') || manufacturer.includes('fiberhome')) {
      base = `Device.WiFi.SSID.${idx + 1}`
    } else {
      base = `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx + 1}`
    }
    if (editSsid && editSsid !== (net.ssid as string)) {
      setParamMutation.mutate({ name: `${base}.SSID`, value: editSsid })
    }
    if (editPass) {
      setParamMutation.mutate({ name: `${base}.PreSharedKey.1.PreSharedKey`, value: editPass })
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {networks.map((net, i) => (
          <Card key={i}>
            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-blue-500" />
                <span className="font-medium text-sm text-slate-800">{(net.ssid as string) || `Rede ${i + 1}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={(net.enabled as boolean) ? 'green' : 'gray'}>
                  {(net.enabled as boolean) ? 'Ativa' : 'Inativa'}
                </Badge>
                <button
                  onClick={() => {
                    setEditing(editing === i ? null : i)
                    setEditSsid((net.ssid as string) || '')
                    setEditPass('')
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {editing === i ? 'Cancelar' : 'Editar'}
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <div className="font-semibold text-slate-700">{(net.band as string) || '—'}</div>
                  <div>Banda</div>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <div className="font-semibold text-slate-700">{(net.channel as string) || '—'}</div>
                  <div>Canal</div>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <div className="font-semibold text-slate-700">{(net.associated as number) ?? 0}</div>
                  <div>Clientes</div>
                </div>
              </div>

              {editing === i && (
                <div className="mt-3 space-y-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="text-xs font-semibold text-blue-700">Configuração Remota</div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Novo SSID</label>
                    <input
                      type="text"
                      value={editSsid}
                      onChange={(e) => setEditSsid(e.target.value)}
                      placeholder={`SSID atual: ${(net.ssid as string) || '—'}`}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Nova Senha Wi-Fi</label>
                    <div className="relative">
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={editPass}
                        onChange={(e) => setEditPass(e.target.value)}
                        placeholder="Deixe em branco para não alterar"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white pr-16"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                      >
                        {showPass ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditing(null)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => applyWifi(net, i)}
                      disabled={setParamMutation.isPending || (!editSsid && !editPass)}
                      className="px-3 py-1.5 text-xs bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {setParamMutation.isPending ? 'Enviando...' : 'Aplicar'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">
                    O parâmetro será enviado via TR-069 SetParameterValues. O dispositivo pode demorar até 30s para aplicar.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {networks.length === 0 && (
          <div className="col-span-2 text-center py-12 text-slate-400">
            <Wifi className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>Nenhuma rede Wi-Fi coletada para este dispositivo</p>
            <p className="text-xs mt-1">Execute um Refresh para coletar os dados</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ErpTab ────────────────────────────────────────────────────────────────────

interface ErpTabProps {
  deviceId: string
  pppLogin: string
  serialNumber: string
}

interface Integration {
  _id: string
  name: string
  type: string
  enabled: boolean
}

interface CustomerResult {
  found: boolean
  name?: string
  cpf?: string
  status?: string
  plan?: string
  address?: string
  phone?: string
  email?: string
  profileUrl?: string
  rawData?: Record<string, unknown>
}

function ErpTab({ pppLogin, serialNumber }: ErpTabProps) {
  const [selectedIntegration, setSelectedIntegration] = useState<string>('')
  const [lookupKey, setLookupKey] = useState<'pppoe' | 'serial'>('pppoe')
  const [manualValue, setManualValue] = useState('')

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations-list'],
    queryFn: () => integrationsApi.list().then(r => {
      const list = r.data as Integration[]
      return list.filter(i => i.enabled)
    }),
  })

  const lookupMut = useMutation({
    mutationFn: ({ integrationId, params }: { integrationId: string; params: Record<string, string> }) =>
      integrationsApi.lookupCustomer(integrationId, params).then(r => r.data as CustomerResult),
  })

  const handleLookup = () => {
    if (!selectedIntegration) { toast.error('Selecione uma integração ERP'); return }
    const value = manualValue.trim() || (lookupKey === 'pppoe' ? pppLogin : serialNumber)
    if (!value) { toast.error('Nenhum valor para buscar'); return }
    const params: Record<string, string> = lookupKey === 'pppoe' ? { pppoe: value } : { serial: value }
    lookupMut.mutate({ integrationId: selectedIntegration, params })
  }

  const customer = lookupMut.data

  const statusColor = (s?: string) => {
    if (!s) return 'bg-slate-100 text-slate-500'
    const sl = s.toLowerCase()
    if (sl.includes('ativo') || sl.includes('active')) return 'bg-green-100 text-green-700'
    if (sl.includes('suspen') || sl.includes('bloq')) return 'bg-red-100 text-red-700'
    if (sl.includes('cancel')) return 'bg-slate-100 text-slate-500'
    return 'bg-yellow-100 text-yellow-700'
  }

  return (
    <div className="space-y-4">
      {/* Painel de busca */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <CardTitle>Consultar Cliente no ERP</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Building2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhuma integração ERP configurada</p>
              <p className="text-xs mt-1">
                Acesse <strong>Integrações</strong> no menu lateral para configurar seu ERP (SGP, IXC, MK-Auth, etc.)
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Seleção de integração */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Integração ERP</label>
                <select
                  value={selectedIntegration}
                  onChange={e => setSelectedIntegration(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {integrations.map(i => (
                    <option key={i._id} value={i._id}>{i.name} ({i.type})</option>
                  ))}
                </select>
              </div>

              {/* Tipo de busca */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Buscar por</label>
                <div className="flex gap-2">
                  {[
                    { key: 'pppoe' as const, label: 'Login PPPoE', value: pppLogin },
                    { key: 'serial' as const, label: 'Serial', value: serialNumber },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setLookupKey(opt.key); setManualValue('') }}
                      className={`flex-1 px-3 py-2 border rounded-lg text-xs text-left transition-all ${
                        lookupKey === opt.key
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="font-mono text-slate-400 truncate">{opt.value || '(não disponível)'}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Valor manual */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Valor de busca (deixe vazio para usar o valor acima)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={lookupKey === 'pppoe' ? pppLogin || 'Login PPPoE...' : serialNumber || 'Serial...'}
                    value={manualValue}
                    onChange={e => setManualValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLookup()}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleLookup}
                    disabled={lookupMut.isPending || !selectedIntegration}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                  >
                    {lookupMut.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Search className="w-4 h-4" />
                    }
                    Buscar
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultado da busca */}
      {lookupMut.isError && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3 text-red-600">
              <X className="w-5 h-5" />
              <p className="text-sm">Erro ao consultar o ERP. Verifique a configuração da integração.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {customer && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-slate-600" />
                <CardTitle>Resultado da Consulta</CardTitle>
              </div>
              {customer.found && customer.profileUrl && (
                <a
                  href={customer.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver no ERP
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!customer.found ? (
              <div className="text-center py-8 text-slate-400">
                <User className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum cliente encontrado com este {lookupKey === 'pppoe' ? 'login PPPoE' : 'serial'}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Nome e status */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{customer.name || '—'}</h3>
                    <p className="text-sm text-slate-500 font-mono">{customer.cpf || '—'}</p>
                  </div>
                  {customer.status && (
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(customer.status)}`}>
                      {customer.status}
                    </span>
                  )}
                </div>

                {/* Dados do cliente */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {customer.plan && (
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2.5">
                      <Signal className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-slate-400">Plano</div>
                        <div className="text-sm font-medium text-slate-700">{customer.plan}</div>
                      </div>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2.5">
                      <Phone className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-slate-400">Telefone</div>
                        <div className="text-sm font-medium text-slate-700">{customer.phone}</div>
                      </div>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2.5">
                      <Mail className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-slate-400">E-mail</div>
                        <div className="text-sm font-medium text-slate-700">{customer.email}</div>
                      </div>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2.5">
                      <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-slate-400">Endereço</div>
                        <div className="text-sm font-medium text-slate-700">{customer.address}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
