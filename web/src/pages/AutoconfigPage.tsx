import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, RefreshCw, Zap, Settings2, Cpu, Tag, Code2, AlertTriangle,
  ChevronRight, ChevronDown, Edit2, Trash2, ToggleLeft, ToggleRight,
  X, Info, Search, Play, FlaskConical, CheckCircle2, XCircle, Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui'
import { autoconfigApi } from '../api'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface AutoConfigRule {
  _id: string
  name: string
  enabled: boolean
  priority: number
  conditions: {
    oui?: string
    manufacturer?: string
    model?: string
    firmwareVersion?: string
    serialPattern?: string
    tags?: string[]
  }
  parameters: { name: string; value: string; type: string }[]
  tagsToAdd: string[]
  stats: { applied: number; errors: number; lastApplied?: string }
}

interface GlobalStats {
  totalRules: number
  activeRules: number
  totalApplied: number
  totalErrors: number
  lastApplied?: string
}

interface DryRunResult {
  deviceId: string
  manufacturer: string
  model: string
  oui: string
  matches: { rule: string; id: string; parameters: number; tags: string[] }[]
  total: number
}

// ── Vendors conhecidos ────────────────────────────────────────────────────────

const KNOWN_VENDORS = [
  { oui: 'E8:65:D4', label: 'INTELBRAS', manufacturer: 'INTELBRAS' },
  { oui: '00:E0:FC', label: 'HUAWEI', manufacturer: 'HUAWEI' },
  { oui: 'BC:AD:28', label: 'ZTE', manufacturer: 'ZTE' },
  { oui: '00:13:25', label: 'NOKIA', manufacturer: 'Nokia' },
  { oui: '00:0A:EB', label: 'TP-LINK', manufacturer: 'TP-LINK' },
  { oui: '00:1F:A4', label: 'FIBERHOME', manufacturer: 'FiberHome' },
  { oui: '00:D0:1E', label: 'VSOL', manufacturer: 'VSOL' },
  { oui: '00:22:B0', label: 'DATACOM', manufacturer: 'DATACOM' },
]

const PARAM_TYPES = ['xsd:string', 'xsd:boolean', 'xsd:int', 'xsd:unsignedInt', 'xsd:dateTime']

// ── Modal Dry-Run ─────────────────────────────────────────────────────────────

function DryRunModal({ onClose }: { onClose: () => void }) {
  const [deviceId, setDeviceId] = useState('')
  const [result, setResult] = useState<DryRunResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (!deviceId.trim()) return
    setLoading(true)
    setError('')
    try {
      const r = await autoconfigApi.dryRun(deviceId.trim())
      setResult(r.data as DryRunResult)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Dispositivo não encontrado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-purple-600" />
            <h2 className="text-base font-semibold text-slate-800">Simular Regras (Dry-Run)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">
            Informe o ID de um dispositivo para simular quais regras ativas seriam aplicadas, sem executar nenhuma ação.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="ID do dispositivo (ex: 000E50-ONT-ABCDEF123456)"
              value={deviceId}
              onChange={e => setDeviceId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && run()}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={run}
              disabled={loading || !deviceId.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Simular
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-600">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-xl p-4 text-sm">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div><span className="text-slate-400">Fabricante</span><div className="font-medium text-slate-700 mt-0.5">{result.manufacturer || '—'}</div></div>
                  <div><span className="text-slate-400">Modelo</span><div className="font-medium text-slate-700 mt-0.5">{result.model || '—'}</div></div>
                  <div><span className="text-slate-400">OUI</span><div className="font-mono text-slate-700 mt-0.5">{result.oui || '—'}</div></div>
                </div>
              </div>

              {result.total === 0 ? (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Nenhuma regra ativa corresponde a este dispositivo.
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-slate-700">{result.total} regra{result.total !== 1 ? 's' : ''} seriam aplicadas</span>
                  </div>
                  <div className="space-y-2">
                    {result.matches.map((m, i) => (
                      <div key={i} className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-xs">
                        <div className="font-medium text-green-800">{m.rule}</div>
                        <div className="text-green-600 mt-0.5">
                          {m.parameters} parâmetro{m.parameters !== 1 ? 's' : ''}
                          {m.tags.length > 0 && ` · tags: ${m.tags.join(', ')}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Fechar</button>
        </div>
      </div>
    </div>
  )
}

// ── Wizard de criação/edição ───────────────────────────────────────────────────

function AutoconfigWizard({
  initial,
  onClose,
  onSuccess,
}: {
  initial?: AutoConfigRule
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!initial
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1 — Identificação
  const [name, setName] = useState(initial?.name || '')
  const [priority, setPriority] = useState(initial?.priority ?? 10)
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)

  // Step 2 — Condições
  const [selectedVendor, setSelectedVendor] = useState(
    KNOWN_VENDORS.find(v => v.oui === initial?.conditions?.oui)?.oui || '__custom__'
  )
  const [customOui, setCustomOui] = useState(
    KNOWN_VENDORS.find(v => v.oui === initial?.conditions?.oui) ? '' : (initial?.conditions?.oui || '')
  )
  const [model, setModel] = useState(initial?.conditions?.model || '')
  const [firmwareVersion, setFirmwareVersion] = useState(initial?.conditions?.firmwareVersion || '')
  const [serialPattern, setSerialPattern] = useState(initial?.conditions?.serialPattern || '')

  // Step 3 — Ações
  const [parameters, setParameters] = useState<{ name: string; value: string; type: string }[]>(
    initial?.parameters || []
  )
  const [newParam, setNewParam] = useState({ name: '', value: '', type: 'xsd:string' })
  const [tagsToAdd, setTagsToAdd] = useState<string[]>(initial?.tagsToAdd || [])
  const [newTag, setNewTag] = useState('')

  const addParam = () => {
    if (!newParam.name.trim()) return
    setParameters(prev => [...prev, { ...newParam }])
    setNewParam({ name: '', value: '', type: 'xsd:string' })
  }

  const saveMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEdit ? autoconfigApi.update(initial!._id, data) : autoconfigApi.create(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Regra atualizada!' : 'Regra criada!')
      onSuccess()
      onClose()
    },
    onError: () => toast.error('Erro ao salvar regra'),
  })

  const handleSave = () => {
    const oui = selectedVendor === '__custom__' ? customOui.trim() : selectedVendor
    saveMut.mutate({
      name: name.trim(),
      priority,
      enabled,
      conditions: {
        ...(oui && { oui }),
        ...(model.trim() && { model: model.trim() }),
        ...(firmwareVersion.trim() && { firmwareVersion: firmwareVersion.trim() }),
        ...(serialPattern.trim() && { serialPattern: serialPattern.trim() }),
      },
      parameters,
      tagsToAdd,
    })
  }

  const STEPS = ['Identificação', 'Condições', 'Ações']

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-800">
              {isEdit ? 'Editar Regra' : 'Nova Regra de Autoconfig'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center px-6 py-3 gap-2 border-b border-slate-50 flex-shrink-0">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${step === i + 1 ? 'bg-blue-600 text-white' : step > i + 1 ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs ${step === i + 1 ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Nome da Regra *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Intelbras 1200R — Coleta de Sinal"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Prioridade</label>
                  <input
                    type="number"
                    min={1} max={100}
                    value={priority}
                    onChange={e => setPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">Maior número = maior prioridade</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Status</label>
                  <button
                    onClick={() => setEnabled(e => !e)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors w-full
                      ${enabled ? 'border-green-200 bg-green-50 text-green-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                  >
                    {enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                    {enabled ? 'Ativa' : 'Inativa'}
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Fabricante / OUI</label>
                <select
                  value={selectedVendor}
                  onChange={e => setSelectedVendor(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">— Qualquer fabricante —</option>
                  {KNOWN_VENDORS.map(v => (
                    <option key={v.oui} value={v.oui}>{v.label} ({v.oui})</option>
                  ))}
                  <option value="__custom__">OUI personalizado...</option>
                </select>
                {selectedVendor === '__custom__' && (
                  <input
                    type="text"
                    placeholder="Ex: AA:BB:CC"
                    value={customOui}
                    onChange={e => setCustomOui(e.target.value)}
                    className="mt-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Deixe em branco para aplicar a qualquer fabricante.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Modelo</label>
                <input
                  type="text"
                  placeholder="Ex: 1200R (parcial aceito)"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Versão de Firmware</label>
                <input
                  type="text"
                  placeholder="Ex: 2.2.250203 (parcial aceito)"
                  value={firmwareVersion}
                  onChange={e => setFirmwareVersion(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Padrão de Serial (Regex)</label>
                <input
                  type="text"
                  placeholder="Ex: ^ITBS.* (opcional)"
                  value={serialPattern}
                  onChange={e => setSerialPattern(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Todos os campos são opcionais. Quanto mais específico, menor o número de dispositivos afetados.
                  Campos de texto usam correspondência parcial (contém).
                </p>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              {/* Parâmetros TR-069 */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Code2 className="w-3.5 h-3.5 text-slate-500" />
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Parâmetros TR-069</label>
                </div>

                {parameters.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {parameters.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 text-xs border border-slate-100">
                        <span className="font-mono text-slate-600 flex-1 truncate">{p.name}</span>
                        <span className="text-slate-300">=</span>
                        <span className="font-mono text-blue-700">{p.value}</span>
                        <span className="text-slate-300 text-xs">({p.type.replace('xsd:', '')})</span>
                        <button onClick={() => setParameters(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-500 ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-1.5 items-end">
                  <input
                    type="text"
                    placeholder="Nome do parâmetro"
                    value={newParam.name}
                    onChange={e => setNewParam(p => ({ ...p, name: e.target.value }))}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Valor"
                    value={newParam.value}
                    onChange={e => setNewParam(p => ({ ...p, value: e.target.value }))}
                    className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={newParam.type}
                    onChange={e => setNewParam(p => ({ ...p, type: e.target.value }))}
                    className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {PARAM_TYPES.map(t => <option key={t} value={t}>{t.replace('xsd:', '')}</option>)}
                  </select>
                  <button
                    onClick={addParam}
                    disabled={!newParam.name.trim()}
                    className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Tags a adicionar</label>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tagsToAdd.map((t, i) => (
                    <span key={i} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                      {t}
                      <button onClick={() => setTagsToAdd(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Nome da tag"
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newTag.trim()) {
                        setTagsToAdd(prev => [...prev, newTag.trim()])
                        setNewTag('')
                      }
                    }}
                    className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => { if (newTag.trim()) { setTagsToAdd(prev => [...prev, newTag.trim()]); setNewTag('') } }}
                    disabled={!newTag.trim()}
                    className="px-2.5 py-1.5 bg-slate-600 text-white rounded-lg text-xs hover:bg-slate-700 disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {parameters.length === 0 && tagsToAdd.length === 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Nenhuma ação definida. A regra será criada mas não executará ações. Você pode editar depois.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0">
          {step > 1
            ? <button onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Voltar</button>
            : <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          }
          {step < 3 ? (
            <button
              onClick={() => setStep(s => (s + 1) as 2 | 3)}
              disabled={step === 1 && !name.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saveMut.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
            >
              {saveMut.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : <><Zap className="w-4 h-4" /> {isEdit ? 'Salvar Alterações' : 'Criar Regra'}</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AutoconfigPage() {
  const qc = useQueryClient()
  const [showWizard, setShowWizard] = useState(false)
  const [showDryRun, setShowDryRun] = useState(false)
  const [editTarget, setEditTarget] = useState<AutoConfigRule | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [applyingAll, setApplyingAll] = useState(false)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['autoconfig-rules'],
    queryFn: () => autoconfigApi.list().then(r => r.data as AutoConfigRule[]),
    refetchInterval: 30000,
  })

  const { data: globalStats } = useQuery({
    queryKey: ['autoconfig-stats'],
    queryFn: () => autoconfigApi.stats().then(r => r.data as GlobalStats),
    refetchInterval: 60000,
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      autoconfigApi.update(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['autoconfig-rules'] }),
    onError: () => toast.error('Erro ao atualizar regra'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => autoconfigApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['autoconfig-rules'] })
      toast.success('Regra removida')
    },
    onError: () => toast.error('Erro ao remover regra'),
  })

  const handleApplyAll = async () => {
    if (!window.confirm('Forçar execução de todas as regras ativas em todos os dispositivos agora?')) return
    setApplyingAll(true)
    try {
      const r = await autoconfigApi.applyAll()
      const d = r.data as { devices: number; applications: number; errors: number }
      toast.success(`Concluído: ${d.applications} aplicações em ${d.devices} dispositivos${d.errors > 0 ? ` (${d.errors} erros)` : ''}`)
      qc.invalidateQueries({ queryKey: ['autoconfig-rules'] })
      qc.invalidateQueries({ queryKey: ['autoconfig-stats'] })
    } catch {
      toast.error('Erro ao executar autoconfig')
    } finally {
      setApplyingAll(false)
    }
  }

  const vendorLabel = (oui?: string) =>
    KNOWN_VENDORS.find(v => v.oui === oui)?.label || oui || '—'

  const filteredRules = rules.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.conditions.oui?.toLowerCase().includes(search.toLowerCase()) ||
    r.conditions.model?.toLowerCase().includes(search.toLowerCase()) ||
    vendorLabel(r.conditions.oui).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {(showWizard || editTarget) && (
        <AutoconfigWizard
          initial={editTarget ?? undefined}
          onClose={() => { setShowWizard(false); setEditTarget(null) }}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['autoconfig-rules'] })
            qc.invalidateQueries({ queryKey: ['autoconfig-stats'] })
          }}
        />
      )}

      {showDryRun && <DryRunModal onClose={() => setShowDryRun(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 max-w-xl">
            Regras de provisionamento automático via TR-069. Quando um dispositivo se registrar e atender às condições,
            os parâmetros e tags configurados são aplicados automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowDryRun(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
          >
            <FlaskConical className="w-4 h-4" /> Simular
          </button>
          <button
            onClick={handleApplyAll}
            disabled={applyingAll || rules.filter(r => r.enabled).length === 0}
            className="flex items-center gap-1.5 px-3 py-2 border border-amber-200 text-amber-700 bg-amber-50 text-sm rounded-lg hover:bg-amber-100 disabled:opacity-40 transition-colors"
          >
            {applyingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Aplicar Agora
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova Regra
          </button>
        </div>
      </div>

      {/* Como funciona */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { icon: <Cpu className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50', title: '1. Dispositivo se registra', desc: 'ONT envia BOOTSTRAP ou BOOT ao GenieACS' },
          { icon: <Settings2 className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50', title: '2. Condições avaliadas', desc: 'OUI, modelo, firmware e serial são verificados' },
          { icon: <Zap className="w-5 h-5 text-green-600" />, bg: 'bg-green-50', title: '3. Ações executadas', desc: 'Parâmetros definidos e tags adicionadas via TR-069' },
        ].map((s, i) => (
          <div key={i} className={`${s.bg} rounded-xl p-4 flex items-start gap-3`}>
            <div className="flex-shrink-0 mt-0.5">{s.icon}</div>
            <div>
              <div className="text-sm font-semibold text-slate-800">{s.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Estatísticas globais */}
      {globalStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total de Regras', value: globalStats.totalRules, color: 'text-slate-700' },
            { label: 'Regras Ativas', value: globalStats.activeRules, color: 'text-green-600' },
            { label: 'Total Aplicações', value: globalStats.totalApplied, color: 'text-blue-600' },
            { label: 'Erros Registrados', value: globalStats.totalErrors, color: 'text-red-500' },
            {
              label: 'Última Execução',
              value: globalStats.lastApplied
                ? new Date(globalStats.lastApplied).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : '—',
              color: 'text-slate-600',
              small: true,
            },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className={`font-bold ${s.small ? 'text-base' : 'text-2xl'} ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de regras */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle>Regras Configuradas</CardTitle>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {rules.filter(r => r.enabled).length} ativas
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar regra..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
              />
            </div>
            <button
              onClick={() => {
                qc.invalidateQueries({ queryKey: ['autoconfig-rules'] })
                qc.invalidateQueries({ queryKey: ['autoconfig-stats'] })
              }}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-10 text-slate-400 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Cpu className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">{search ? 'Nenhuma regra encontrada para esta busca' : 'Nenhuma regra de autoconfig criada'}</p>
              {!search && <p className="text-xs mt-1">Clique em "Nova Regra" para configurar o provisionamento automático</p>}
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {[...filteredRules].sort((a, b) => b.priority - a.priority).map(rule => (
                <div key={rule._id}>
                  <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpanded(expanded === rule._id ? null : rule._id)}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); toggleMut.mutate({ id: rule._id, enabled: !rule.enabled }) }}
                      className="flex-shrink-0"
                      title={rule.enabled ? 'Desativar' : 'Ativar'}
                    >
                      {rule.enabled
                        ? <ToggleRight className="w-6 h-6 text-green-500" />
                        : <ToggleLeft className="w-6 h-6 text-slate-300" />
                      }
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800 text-sm">{rule.name}</span>
                        {rule.conditions.oui && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-medium">
                            {vendorLabel(rule.conditions.oui)}
                          </span>
                        )}
                        {rule.conditions.model && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                            {rule.conditions.model}
                          </span>
                        )}
                        {rule.conditions.firmwareVersion && (
                          <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded font-mono">
                            fw: {rule.conditions.firmwareVersion}
                          </span>
                        )}
                        {!rule.enabled && (
                          <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded">inativa</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Prioridade {rule.priority} ·{' '}
                        {rule.parameters.length} parâmetro{rule.parameters.length !== 1 ? 's' : ''} ·{' '}
                        {rule.tagsToAdd.length} tag{rule.tagsToAdd.length !== 1 ? 's' : ''} ·{' '}
                        {rule.stats.applied} aplicações
                        {rule.stats.lastApplied && ` · último: ${new Date(rule.stats.lastApplied).toLocaleDateString('pt-BR')}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); setEditTarget(rule) }}
                        className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteMut.mutate(rule._id) }}
                        className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {expanded === rule._id
                        ? <ChevronDown className="w-4 h-4 text-slate-400" />
                        : <ChevronRight className="w-4 h-4 text-slate-400" />
                      }
                    </div>
                  </div>

                  {expanded === rule._id && (
                    <div className="px-5 pb-5 bg-slate-50 border-t border-slate-100">
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
                        {[
                          { label: 'Fabricante', value: vendorLabel(rule.conditions.oui) },
                          { label: 'OUI', value: rule.conditions.oui || '—', mono: true },
                          { label: 'Modelo', value: rule.conditions.model || 'Todos', mono: true },
                          { label: 'Firmware', value: rule.conditions.firmwareVersion || 'Todos', mono: true },
                        ].map((f, i) => (
                          <div key={i}>
                            <div className="text-slate-400 font-medium uppercase tracking-wider mb-1">{f.label}</div>
                            <div className={`text-slate-700 ${f.mono ? 'font-mono' : ''}`}>{f.value}</div>
                          </div>
                        ))}
                      </div>

                      {rule.conditions.serialPattern && (
                        <div className="mb-3 text-xs">
                          <span className="text-slate-400 font-medium uppercase tracking-wider">Padrão de Serial: </span>
                          <code className="font-mono text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-100">{rule.conditions.serialPattern}</code>
                        </div>
                      )}

                      {rule.parameters.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Code2 className="w-3 h-3" /> Parâmetros TR-069
                          </div>
                          <div className="space-y-1">
                            {rule.parameters.map((p, i) => (
                              <div key={i} className="flex items-center gap-2 bg-white rounded px-3 py-1.5 text-xs border border-slate-100">
                                <span className="font-mono text-slate-600 flex-1 truncate">{p.name}</span>
                                <span className="text-slate-300">=</span>
                                <span className="font-mono text-blue-700">{p.value}</span>
                                <span className="text-slate-300">({p.type.replace('xsd:', '')})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {rule.tagsToAdd.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Tag className="w-3 h-3" /> Tags
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {rule.tagsToAdd.map((t, i) => (
                              <span key={i} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {rule.stats.errors > 0 && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {rule.stats.errors} erro{rule.stats.errors !== 1 ? 's' : ''} registrado{rule.stats.errors !== 1 ? 's' : ''}
                        </div>
                      )}

                      {rule.parameters.length === 0 && rule.tagsToAdd.length === 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                          <Info className="w-3.5 h-3.5" />
                          Nenhuma ação configurada. Edite a regra para adicionar parâmetros ou tags.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
