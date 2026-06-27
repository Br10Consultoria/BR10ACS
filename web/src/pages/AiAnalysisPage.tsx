import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Sparkles, Router, AlertTriangle, CheckCircle2, XCircle, RotateCcw, ExternalLink, ChevronDown, ChevronUp, Key, Eye, EyeOff, Settings, CheckCircle } from 'lucide-react'
import { devicesApi, aiConfigApi } from '@/api'
import toast from 'react-hot-toast'

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

interface DeviceAiState {
  loading: boolean
  result: AiResult | null
  error: string | null
  expanded: boolean
}

export default function AiAnalysisPage() {
  const qc = useQueryClient()
  const [analyses, setAnalyses] = useState<Record<string, DeviceAiState>>({})
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [showConfigPanel, setShowConfigPanel] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [baseUrlInput, setBaseUrlInput] = useState('')
  const [showKey, setShowKey] = useState(false)

  // Status da IA
  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => aiConfigApi.status().then(r => r.data as { configured: boolean; source: string }),
    staleTime: 30000,
  })

  // Config atual (preview da chave)
  const { data: aiConfig } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => aiConfigApi.getConfig().then(r => r.data as { hasApiKey: boolean; apiKeyPreview: string | null; baseUrl: string | null }),
    staleTime: 30000,
    enabled: showConfigPanel,
  })

  // Salvar configuração
  const saveMut = useMutation({
    mutationFn: () => aiConfigApi.saveConfig(apiKeyInput, baseUrlInput || undefined),
    onSuccess: (res) => {
      const configured = (res.data as { configured: boolean }).configured
      if (configured) {
        toast.success('API key salva e IA recarregada com sucesso!')
      } else {
        toast.error('Chave inválida ou vazia — IA não foi ativada')
      }
      setApiKeyInput('')
      qc.invalidateQueries({ queryKey: ['ai-status'] })
      qc.invalidateQueries({ queryKey: ['ai-config'] })
      setShowConfigPanel(false)
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  })

  const { data: devicesData, isLoading } = useQuery({
    queryKey: ['devices-ai-list'],
    queryFn: () => devicesApi.list({ limit: 200 }).then(r => r.data),
    staleTime: 30000,
  })

  const devices: Record<string, unknown>[] = Array.isArray(devicesData)
    ? devicesData
    : (devicesData as { data?: Record<string, unknown>[] })?.data || []

  const filtered = devices.filter(d => {
    if (filter === 'online') return d.online === true
    if (filter === 'offline') return d.online !== true
    return true
  })

  const analyzeDevice = async (deviceId: string) => {
    if (!aiStatus?.configured) {
      toast.error('Configure a API key da OpenAI antes de analisar')
      setShowConfigPanel(true)
      return
    }
    setAnalyses(prev => ({ ...prev, [deviceId]: { loading: true, result: null, error: null, expanded: true } }))
    try {
      const { data } = await devicesApi.aiAnalysis(deviceId)
      setAnalyses(prev => ({ ...prev, [deviceId]: { loading: false, result: data as AiResult, error: null, expanded: true } }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na análise'
      setAnalyses(prev => ({ ...prev, [deviceId]: { loading: false, result: null, error: msg, expanded: true } }))
      toast.error('Erro ao analisar dispositivo')
    }
  }

  const analyzeAll = async () => {
    if (!aiStatus?.configured) {
      toast.error('Configure a API key da OpenAI antes de analisar')
      setShowConfigPanel(true)
      return
    }
    const online = devices.filter(d => d.online === true)
    if (online.length === 0) { toast.error('Nenhum dispositivo online'); return }
    toast.success(`Iniciando análise de ${online.length} dispositivos...`)
    for (const d of online) {
      const id = (d._id as string) || (d.id as string)
      if (id) await analyzeDevice(id)
    }
  }

  const severityIcon = (s: string) => {
    if (s === 'critical') return <XCircle className="w-4 h-4 text-red-500" />
    if (s === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-500" />
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
  }

  const severityBg = (s: string) => {
    if (s === 'critical') return 'border-red-200 bg-red-50'
    if (s === 'warning') return 'border-amber-200 bg-amber-50'
    return 'border-emerald-200 bg-emerald-50'
  }

  const priorityBadge = (p: string) => {
    if (p === 'high') return 'bg-red-100 text-red-700'
    if (p === 'medium') return 'bg-amber-100 text-amber-700'
    return 'bg-slate-100 text-slate-600'
  }

  const onlineCount = devices.filter(d => d.online === true).length
  const analyzedCount = Object.values(analyses).filter(a => a.result).length
  const criticalCount = Object.values(analyses).filter(a => a.result?.severity === 'critical').length
  const warningCount = Object.values(analyses).filter(a => a.result?.severity === 'warning').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Análise IA</h1>
            <p className="text-sm text-slate-500">Diagnóstico inteligente de ONTs via GPT-4o-mini</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfigPanel(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showConfigPanel
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Settings className="w-4 h-4" />
            Configurar IA
            {aiStatus?.configured
              ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            }
          </button>
          <button
            onClick={analyzeAll}
            disabled={isLoading || onlineCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Analisar todos online ({onlineCount})
          </button>
        </div>
      </div>

      {/* Painel de configuração de API key */}
      {showConfigPanel && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-slate-800">Configuração da API OpenAI</h2>
            {aiStatus?.configured && (
              <span className="ml-auto text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                IA ativa · fonte: {aiStatus.source === 'database' ? 'banco de dados' : 'variável de ambiente'}
              </span>
            )}
          </div>

          {aiConfig?.hasApiKey && (
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
              Chave atual: <span className="font-mono font-medium">{aiConfig.apiKeyPreview}</span>
              {aiConfig.baseUrl && (
                <span className="ml-3 text-slate-400">URL: {aiConfig.baseUrl}</span>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                API Key da OpenAI <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Obtenha em <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">platform.openai.com/api-keys</a>. A chave é armazenada criptografada no banco de dados.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                URL base da API <span className="text-slate-400">(opcional — deixe vazio para usar o padrão OpenAI)</span>
              </label>
              <input
                type="text"
                value={baseUrlInput}
                onChange={e => setBaseUrlInput(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !apiKeyInput.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saveMut.isPending ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                Salvar e recarregar IA
              </button>
              <button
                onClick={() => setShowConfigPanel(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aviso quando IA não configurada */}
      {!aiStatus?.configured && !showConfigPanel && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">IA não configurada</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Configure a API key da OpenAI para habilitar o diagnóstico inteligente.{' '}
              <button onClick={() => setShowConfigPanel(true)} className="underline font-medium">Configurar agora</button>
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      {analyzedCount > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{analyzedCount}</div>
            <div className="text-xs text-slate-500 mt-1">Analisados</div>
          </div>
          <div className="bg-white border border-red-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <div className="text-xs text-slate-500 mt-1">Críticos</div>
          </div>
          <div className="bg-white border border-amber-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{warningCount}</div>
            <div className="text-xs text-slate-500 mt-1">Atenção</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2">
        {(['all', 'online', 'offline'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? `Todos (${devices.length})` : f === 'online' ? `Online (${onlineCount})` : `Offline (${devices.length - onlineCount})`}
          </button>
        ))}
      </div>

      {/* Lista de dispositivos */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">
          <RotateCcw className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p className="text-sm">Carregando dispositivos...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => {
            const id = (d._id as string) || (d.id as string)
            const serial = (d.serialNumber as string) || id?.split('-').pop() || '—'
            const model = `${(d.manufacturer as string) || ''} ${(d.model as string) || ''}`.trim()
            const online = d.online === true
            const state = analyses[id]

            return (
              <div key={id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Cabeçalho do dispositivo */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <Router className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-800">{serial}</span>
                      {model && <span className="text-xs text-slate-400">{model}</span>}
                      {(d.rxPower as number) != null && (
                        <span className={`text-xs font-medium ${(d.rxPower as number) < -27 ? 'text-red-600' : 'text-slate-500'}`}>
                          {(d.rxPower as number).toFixed(1)} dBm
                        </span>
                      )}
                    </div>
                    {state?.result && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {severityIcon(state.result.severity)}
                        <span className="text-xs text-slate-600 truncate">{state.result.summary}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      to={`/devices/${id}`}
                      className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Abrir dispositivo"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                    {state?.result && (
                      <button
                        onClick={() => setAnalyses(prev => ({ ...prev, [id]: { ...prev[id], expanded: !prev[id].expanded } }))}
                        className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {state.expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => analyzeDevice(id)}
                      disabled={state?.loading || !online}
                      title={!online ? 'Dispositivo offline' : 'Analisar com IA'}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                    >
                      {state?.loading ? (
                        <><RotateCcw className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
                      ) : (
                        <><Sparkles className="w-3.5 h-3.5" /> Analisar</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Resultado expandido */}
                {state?.result && state.expanded && (
                  <div className={`border-t border-slate-100 px-4 py-3 ${severityBg(state.result.severity)}`}>
                    {state.result.issues?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-slate-600 mb-1.5">Problemas identificados</p>
                        <div className="space-y-1.5">
                          {state.result.issues.map((issue, i) => (
                            <div key={i} className="flex items-start gap-2">
                              {severityIcon(issue.severity)}
                              <div>
                                <span className="text-xs font-medium text-slate-700">{issue.title}</span>
                                <p className="text-xs text-slate-500">{issue.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {state.result.recommendations?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-1.5">Recomendações</p>
                        <div className="space-y-1.5">
                          {state.result.recommendations.map((rec, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${priorityBadge(rec.priority)}`}>
                                {rec.priority.toUpperCase()}
                              </span>
                              <div>
                                <span className="text-xs font-medium text-slate-700">{rec.action}</span>
                                <p className="text-xs text-slate-500">{rec.reason}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {state.result.predictedCause && (
                      <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200">
                        <strong>Causa provável:</strong> {state.result.predictedCause}
                      </p>
                    )}
                  </div>
                )}

                {state?.error && (
                  <div className="border-t border-red-100 px-4 py-2 bg-red-50">
                    <p className="text-xs text-red-600">{state.error}</p>
                  </div>
                )}
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <Router className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhum dispositivo encontrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
