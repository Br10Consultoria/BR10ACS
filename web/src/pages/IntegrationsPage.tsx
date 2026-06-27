import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Link2, Plus, Trash2, CheckCircle, XCircle, RefreshCw,
  ChevronDown, ChevronRight, ExternalLink, Search,
  Zap, Eye, EyeOff, X, Info, User, Phone, Mail, MapPin,
  Activity, ToggleLeft, ToggleRight, Shield, Key, Globe,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { integrationsApi } from '@/api'
import toast from 'react-hot-toast'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Adapter {
  label: string
  description: string
  authType: string
  docsUrl?: string
}

interface Integration {
  _id: string
  name: string
  type: string
  enabled: boolean
  config: Record<string, unknown>
  stats: { requests: number; errors: number; lastUsed?: string }
}

interface CustomerResult {
  found: boolean
  normalized?: {
    id?: string
    name?: string
    cpf?: string
    status?: string
    plan?: string
    address?: string
    phone?: string
    email?: string
    profileUrl?: string
  }
  raw?: Record<string, unknown>
  error?: string
}

// ── Wizard de criação ─────────────────────────────────────────────────────────

const AUTH_LABELS: Record<string, string> = {
  apikey_header: 'API Key no Header',
  bearer: 'Bearer Token',
  basic: 'Basic Auth (usuário + senha)',
  apikey_query: 'API Key na URL (query param)',
}

interface WizardProps {
  onClose: () => void
  onSuccess: () => void
}

function IntegrationWizard({ onClose, onSuccess }: WizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedType, setSelectedType] = useState('')
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showKey, setShowKey] = useState(false)

  const { data: adaptersData } = useQuery({
    queryKey: ['integration-adapters'],
    queryFn: () => integrationsApi.getAdapters().then(r => r.data as Record<string, Adapter>),
  })

  const adapters = adaptersData || {}

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => integrationsApi.create(data),
    onSuccess: () => {
      toast.success('Integração criada com sucesso')
      onSuccess()
      onClose()
    },
    onError: () => toast.error('Erro ao criar integração'),
  })

  const selectedAdapter = adapters[selectedType]
  const authType = selectedAdapter?.authType || 'apikey_header'

  const handleCreate = () => {
    const config: Record<string, unknown> = { baseUrl, authType }
    if (authType === 'basic') {
      config.username = username
      config.password = password
    } else {
      config.apiKey = apiKey
    }

    createMut.mutate({
      name: name || `${selectedAdapter?.label || selectedType} - ${new Date().toLocaleDateString('pt-BR')}`,
      type: selectedType,
      enabled: true,
      config,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Nova Integração ERP</h3>
              <p className="text-xs text-slate-400">Passo {step} de 3</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-6 pt-4">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-blue-600' : 'bg-slate-100'}`} />
          ))}
        </div>

        {/* Step 1 — Tipo de ERP */}
        {step === 1 && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <h4 className="font-medium text-slate-800 mb-1">Selecione o ERP</h4>
              <p className="text-xs text-slate-500">Escolha o sistema que deseja integrar. Cada ERP tem um adaptador pré-configurado.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(adapters).map(([key, a]) => (
                <button
                  key={key}
                  onClick={() => { setSelectedType(key); setBaseUrl('') }}
                  className={`flex items-start gap-2 px-3 py-3 border rounded-xl text-left transition-all ${
                    selectedType === key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {selectedType === key && <CheckCircle className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />}
                  <div>
                    <div className={`text-sm font-medium ${selectedType === key ? 'text-blue-700' : 'text-slate-700'}`}>{a.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5 leading-tight">{AUTH_LABELS[a.authType] || a.authType}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                disabled={!selectedType}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — URL e nome */}
        {step === 2 && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <h4 className="font-medium text-slate-800 mb-1">Configuração da conexão</h4>
              <p className="text-xs text-slate-500">Informe a URL base da API do seu ERP.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome da integração</label>
              <input
                type="text"
                placeholder={`${selectedAdapter?.label || ''} - Produção`}
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL base da API *</label>
              <input
                type="url"
                placeholder={`Ex: https://suaempresa.${selectedType}.com.br`}
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {selectedAdapter?.docsUrl && (
              <a
                href={selectedAdapter.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Documentação da API do {selectedAdapter.label}
              </a>
            )}
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Voltar</button>
              <button
                onClick={() => setStep(3)}
                disabled={!baseUrl}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Credenciais */}
        {step === 3 && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <h4 className="font-medium text-slate-800 mb-1">Credenciais de acesso</h4>
              <p className="text-xs text-slate-500">
                Tipo de autenticação: <strong>{AUTH_LABELS[authType] || authType}</strong>
              </p>
            </div>

            {authType === 'basic' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Usuário</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Senha / Token</label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-2.5 text-slate-400"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {authType === 'bearer' ? 'Bearer Token' : authType === 'apikey_query' ? 'API Key' : 'API Key / Token'}
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder="Cole sua chave de API aqui"
                    className="w-full px-3 py-2 pr-10 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-2.5 text-slate-400"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                As credenciais são armazenadas criptografadas no MongoDB e nunca são expostas na interface.
              </p>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Voltar</button>
              <button
                onClick={handleCreate}
                disabled={createMut.isPending || (!apiKey && !password)}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
              >
                {createMut.isPending
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Criando...</>
                  : <><Zap className="w-4 h-4" /> Criar Integração</>
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Painel de Lookup ──────────────────────────────────────────────────────────

const AUTH_ICONS: Record<string, JSX.Element> = {
  apikey_header: <Key className="w-3 h-3" />,
  bearer:        <Shield className="w-3 h-3" />,
  basic:         <Key className="w-3 h-3" />,
  apikey_query:  <Globe className="w-3 h-3" />,
}

function LookupPanel({ integration }: { integration: Integration }) {
  const [lookupType, setLookupType] = useState<'pppoe' | 'serial' | 'cpf'>('pppoe')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<CustomerResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showRaw, setShowRaw] = useState(false)

  const handleLookup = async () => {
    if (!query.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const params = { [lookupType]: query.trim() } as { pppoe?: string; serial?: string; cpf?: string }
      const r = await integrationsApi.lookupCustomer(integration._id, params)
      setResult(r.data as CustomerResult)
    } catch {
      setResult({ found: false, error: 'Erro ao consultar o ERP' })
    } finally {
      setLoading(false)
    }
  }

  const statusColor = (status?: string) => {
    if (!status) return 'bg-slate-100 text-slate-600'
    const s = status.toLowerCase()
    if (s.includes('ativo') || s === '1' || s === 'active') return 'bg-green-100 text-green-700'
    if (s.includes('suspen') || s.includes('bloq') || s === '0') return 'bg-red-100 text-red-700'
    return 'bg-yellow-100 text-yellow-700'
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Tipo de busca */}
      <div className="flex gap-2">
        {(['pppoe', 'serial', 'cpf'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setLookupType(t); setResult(null) }}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
              lookupType === t
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            {t === 'pppoe' ? 'Login PPPoE' : t === 'serial' ? 'Serial' : 'CPF/CNPJ'}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={`Buscar por ${lookupType === 'pppoe' ? 'login PPPoE' : lookupType === 'serial' ? 'serial' : 'CPF/CNPJ'}...`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLookup()}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleLookup}
          disabled={loading || !query.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar
        </button>
      </div>

      {result && (
        <div className={`rounded-xl border p-4 ${result.found ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          {result.found && result.normalized ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">Cliente encontrado</span>
                </div>
                {result.normalized.profileUrl && (
                  <a
                    href={result.normalized.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> Abrir no ERP
                  </a>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {result.normalized.name && (
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium">{result.normalized.name}</span>
                  </div>
                )}
                {result.normalized.cpf && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="text-slate-400">CPF/CNPJ:</span> {result.normalized.cpf}
                  </div>
                )}
                {result.normalized.status && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Status:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(result.normalized.status)}`}>
                      {result.normalized.status}
                    </span>
                  </div>
                )}
                {result.normalized.plan && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="text-slate-400">Plano:</span> {result.normalized.plan}
                  </div>
                )}
                {result.normalized.phone && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {result.normalized.phone}
                  </div>
                )}
                {result.normalized.email && (
                  <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {result.normalized.email}
                  </div>
                )}
                {result.normalized.address && (
                  <div className="flex items-center gap-1.5 text-slate-600 col-span-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {result.normalized.address}
                  </div>
                )}
              </div>
              {result.raw && (
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  {showRaw ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {showRaw ? 'Ocultar' : 'Ver'} resposta bruta do ERP
                </button>
              )}
              {showRaw && result.raw && (
                <pre className="bg-slate-900 text-green-400 rounded-lg p-3 text-xs overflow-x-auto max-h-48">
                  {JSON.stringify(result.raw, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700">
                {result.error || 'Cliente não encontrado'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const qc = useQueryClient()
  const [showWizard, setShowWizard] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string; latencyMs?: number }>>({})

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsApi.list().then(r => r.data as Integration[]),
  })

  const { data: adaptersData } = useQuery({
    queryKey: ['integration-adapters'],
    queryFn: () => integrationsApi.getAdapters().then(r => r.data as Record<string, Adapter>),
  })

  const adapters = adaptersData || {}

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      integrationsApi.update(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
    onError: () => toast.error('Erro ao atualizar integração'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => integrationsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] })
      toast.success('Integração removida')
    },
    onError: () => toast.error('Erro ao remover integração'),
  })

  const handleTestConnection = async (id: string) => {
    setTestingId(id)
    try {
      const r = await integrationsApi.testConnection(id)
      const data = r.data as { ok: boolean; message: string; latencyMs?: number }
      setTestResults(prev => ({ ...prev, [id]: data }))
      toast[data.ok ? 'success' : 'error'](data.message)
    } catch {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, message: 'Erro ao testar conexão' } }))
    } finally {
      setTestingId(null)
    }
  }

  const [search, setSearch] = useState('')
  const erpIntegrations = integrations.filter(i =>
    !['webhook', 'slack', 'telegram'].includes(i.type) &&
    (search === '' || i.name.toLowerCase().includes(search.toLowerCase()) || i.type.toLowerCase().includes(search.toLowerCase()))
  )
  const webhookIntegrations = integrations.filter(i => ['webhook', 'slack', 'telegram'].includes(i.type))
  const totalRequests = integrations.reduce((s, i) => s + (i.stats?.requests || 0), 0)
  const totalErrors = integrations.reduce((s, i) => s + (i.stats?.errors || 0), 0)
  const activeCount = integrations.filter(i => i.enabled).length

  return (
    <div className="space-y-6">
      {showWizard && (
        <IntegrationWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['integrations'] })}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 max-w-xl">
            Conecte o BR10ACS ao seu ERP para consultar clientes pelo login PPPoE, serial da ONT ou CPF/CNPJ
            diretamente na tela de detalhes do dispositivo.
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0 ml-4"
        >
          <Plus className="w-4 h-4" /> Nova Integração
        </button>
      </div>

      {/* Stats globais */}
      {integrations.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Integrações Ativas', value: `${activeCount} / ${integrations.length}`, color: 'text-green-600' },
            { label: 'Total de Consultas', value: totalRequests.toLocaleString('pt-BR'), color: 'text-blue-600' },
            { label: 'Erros Registrados', value: totalErrors.toLocaleString('pt-BR'), color: totalErrors > 0 ? 'text-red-600' : 'text-slate-500' },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="py-4">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ERPs disponíveis */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Object.entries(adapters).map(([key, a]) => {
          const active = integrations.some(i => i.type === key && i.enabled)
          return (
            <div
              key={key}
              className={`border rounded-xl p-3 ${active ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-800">{a.label}</span>
                {active && <span className="w-2 h-2 rounded-full bg-green-500" />}
              </div>
              <p className="text-xs text-slate-400 leading-tight">{AUTH_LABELS[a.authType] || a.authType}</p>
            </div>
          )
        })}
      </div>

      {/* Integrações ERP configuradas */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Integrações ERP Configuradas</CardTitle>
          <div className="flex items-center gap-2">
            {integrations.length > 0 && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                />
              </div>
            )}
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['integrations'] })}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Carregando...</div>
          ) : erpIntegrations.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Link2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhuma integração ERP configurada</p>
              <p className="text-xs mt-1">Clique em "Nova Integração" para conectar seu ERP</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {erpIntegrations.map(integration => {
                const adapter = adapters[integration.type]
                const testResult = testResults[integration._id]
                return (
                  <div key={integration._id}>
                    <div
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpanded(expanded === integration._id ? null : integration._id)}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        integration.enabled ? 'bg-green-100' : 'bg-slate-100'
                      }`}>
                        <Link2 className={`w-5 h-5 ${integration.enabled ? 'text-green-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-800 text-sm">{integration.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            integration.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {integration.enabled ? 'Ativo' : 'Inativo'}
                          </span>
                          {adapter && (
                            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                              {adapter.label}
                            </span>
                          )}
                          {testResult && (
                            <span className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                              testResult.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {testResult.ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {testResult.ok ? `OK${testResult.latencyMs ? ` (${testResult.latencyMs}ms)` : ''}` : 'Falhou'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono truncate max-w-xs">{String(integration.config?.baseUrl || '—')}</span>
                          <span>·</span>
                          <span>{integration.stats?.requests || 0} req</span>
                          {(integration.stats?.errors || 0) > 0 && (
                            <><span>·</span><span className="text-red-500">{integration.stats.errors} erros</span></>
                          )}
                          {integration.stats?.lastUsed && (
                            <><span>·</span><span>último uso: {new Date(integration.stats.lastUsed).toLocaleDateString('pt-BR')}</span></>
                          )}
                          {integration.config?.authType && (
                            <span className="flex items-center gap-0.5 text-slate-400">
                              · {AUTH_ICONS[String(integration.config.authType)] || null}
                              {AUTH_LABELS[String(integration.config.authType)] || String(integration.config.authType)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); handleTestConnection(integration._id) }}
                          disabled={testingId === integration._id}
                          className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Testar conexão"
                        >
                          {testingId === integration._id
                            ? <RefreshCw className="w-4 h-4 animate-spin" />
                            : <Activity className="w-4 h-4" />
                          }
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); toggleMut.mutate({ id: integration._id, enabled: !integration.enabled }) }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            integration.enabled
                              ? 'text-green-600 hover:bg-red-50 hover:text-red-500'
                              : 'text-slate-400 hover:bg-green-50 hover:text-green-600'
                          }`}
                          title={integration.enabled ? 'Desativar' : 'Ativar'}
                        >
                          {integration.enabled
                            ? <ToggleRight className="w-5 h-5" />
                            : <ToggleLeft className="w-5 h-5" />
                          }
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteMut.mutate(integration._id) }}
                          className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {expanded === integration._id
                          ? <ChevronDown className="w-4 h-4 text-slate-400" />
                          : <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                      </div>
                    </div>

                    {/* Painel expandido com lookup */}
                    {expanded === integration._id && (
                      <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100">
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                            Consultar cliente no ERP
                          </p>
                          <LookupPanel integration={integration} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhooks */}
      {webhookIntegrations.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Webhooks</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              {webhookIntegrations.map(wh => (
                <div key={wh._id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-700">{wh.name}</span>
                    <div className="text-xs text-slate-400 mt-0.5">{String(wh.config?.url || '—')}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${wh.enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {wh.enabled ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
