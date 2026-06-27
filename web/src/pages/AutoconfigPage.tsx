import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Cpu, Plus, Trash2, ChevronRight, ChevronDown,
  Zap, RefreshCw, X, Edit2, ToggleLeft, ToggleRight, Settings2,
  Tag, Code2, AlertTriangle, Info,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { autoconfigApi } from '@/api'
import toast from 'react-hot-toast'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface AutoConfigRule {
  _id: string
  name: string
  description?: string
  enabled: boolean
  priority: number
  conditions: {
    manufacturer?: string
    model?: string
    oui?: string
    tags?: string[]
    serialPattern?: string
    firmwareVersion?: string
  }
  parameters: { name: string; value: string; type: string }[]
  presets: string[]
  tagsToAdd: string[]
  stats: { applied: number; errors: number; lastApplied?: string }
}

// ── Constantes ────────────────────────────────────────────────────────────────

const KNOWN_VENDORS = [
  { label: 'INTELBRAS', oui: '00259E' },
  { label: 'HUAWEI', oui: '6C8D6F' },
  { label: 'ZTE', oui: 'BC76C7' },
  { label: 'NOKIA (Alcatel)', oui: '3C1E04' },
  { label: 'FIBERHOME', oui: 'C8B373' },
  { label: 'VSOL', oui: 'A8F7E0' },
  { label: 'TP-LINK', oui: '1C61B4' },
  { label: 'DATACOM', oui: '001E8C' },
  { label: 'Personalizado', oui: '' },
]

const PARAM_TYPES = ['xsd:string', 'xsd:int', 'xsd:boolean', 'xsd:unsignedInt']

// ── Wizard de criação/edição ──────────────────────────────────────────────────

interface WizardProps {
  initial?: AutoConfigRule
  onClose: () => void
  onSuccess: () => void
}

function AutoconfigWizard({ initial, onClose, onSuccess }: WizardProps) {
  const isEdit = !!initial
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1 — Identificação
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [priority, setPriority] = useState(initial?.priority ?? 100)

  // Step 2 — Condições
  const initVendor = initial?.conditions?.oui
    ? KNOWN_VENDORS.find(v => v.oui === initial.conditions.oui) ?? KNOWN_VENDORS[KNOWN_VENDORS.length - 1]
    : null
  const [selectedVendor, setSelectedVendor] = useState<typeof KNOWN_VENDORS[0] | null>(initVendor)
  const [customOui, setCustomOui] = useState(initial?.conditions?.oui || '')
  const [model, setModel] = useState(initial?.conditions?.model || '')
  const [firmware, setFirmware] = useState(initial?.conditions?.firmwareVersion || '')
  const [serialPattern, setSerialPattern] = useState(initial?.conditions?.serialPattern || '')

  // Step 3 — Ações
  const [parameters, setParameters] = useState<{ name: string; value: string; type: string }[]>(
    initial?.parameters || []
  )
  const [tagsToAdd, setTagsToAdd] = useState<string[]>(initial?.tagsToAdd || [])
  const [newTag, setNewTag] = useState('')
  const [newParam, setNewParam] = useState({ name: '', value: '', type: 'xsd:string' })

  const saveMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEdit ? autoconfigApi.update(initial!._id, data) : autoconfigApi.create(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Regra atualizada' : 'Regra criada com sucesso')
      onSuccess()
      onClose()
    },
    onError: () => toast.error('Erro ao salvar regra'),
  })

  const finalOui = selectedVendor?.oui || customOui.trim().toUpperCase()

  const handleSave = () => {
    saveMut.mutate({
      name: name.trim(),
      description: description.trim(),
      priority,
      enabled: true,
      conditions: {
        oui: finalOui || undefined,
        model: model.trim() || undefined,
        firmwareVersion: firmware.trim() || undefined,
        serialPattern: serialPattern.trim() || undefined,
      },
      parameters,
      tagsToAdd,
      presets: [],
    })
  }

  const addParam = () => {
    if (!newParam.name.trim()) return
    setParameters(prev => [...prev, { ...newParam }])
    setNewParam({ name: '', value: '', type: 'xsd:string' })
  }

  const removeParam = (i: number) => setParameters(prev => prev.filter((_, idx) => idx !== i))

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">{isEdit ? 'Editar Regra' : 'Nova Regra de Autoconfig'}</h3>
              <p className="text-xs text-slate-400">Passo {step} de 3</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-6 pt-4 flex-shrink-0">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-blue-600' : 'bg-slate-100'}`} />
          ))}
        </div>

        {/* Conteúdo scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Step 1 — Identificação */}
          {step === 1 && (
            <>
              <div>
                <h4 className="font-medium text-slate-800 mb-1">Identificação da regra</h4>
                <p className="text-xs text-slate-500">Dê um nome descritivo para identificar esta regra de provisionamento automático.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome da regra *</label>
                <input
                  type="text"
                  placeholder="Ex: Intelbras 1200R - Coletar Sinal"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descrição (opcional)</label>
                <textarea
                  placeholder="Descreva o objetivo desta regra..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Prioridade</label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={priority}
                  onChange={e => setPriority(Number(e.target.value))}
                  className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Regras com maior prioridade são aplicadas primeiro. Padrão: 100.</p>
              </div>
            </>
          )}

          {/* Step 2 — Condições */}
          {step === 2 && (
            <>
              <div>
                <h4 className="font-medium text-slate-800 mb-1">Condições de aplicação</h4>
                <p className="text-xs text-slate-500">A regra será aplicada automaticamente quando um dispositivo se registrar e atender a estas condições.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">Fabricante (OUI)</label>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {KNOWN_VENDORS.map(v => (
                    <button
                      key={v.oui + v.label}
                      onClick={() => { setSelectedVendor(v); if (v.oui) setCustomOui(v.oui) }}
                      className={`px-2 py-1.5 border rounded-lg text-xs text-left transition-all ${
                        selectedVendor?.label === v.label
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                {selectedVendor?.label === 'Personalizado' && (
                  <input
                    type="text"
                    placeholder="OUI (ex: 00259E)"
                    value={customOui}
                    onChange={e => setCustomOui(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {finalOui && (
                  <p className="text-xs text-slate-400 mt-1">OUI: <span className="font-mono text-blue-600">{finalOui}</span></p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Modelo (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: 1200R (deixe vazio para todos os modelos)"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Versão de firmware (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: 2.2.250203"
                  value={firmware}
                  onChange={e => setFirmware(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Padrão de serial (regex, opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: ^ITBS.*"
                  value={serialPattern}
                  onChange={e => setSerialPattern(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Deixe todos os campos vazios para aplicar a regra a <strong>todos os dispositivos</strong> que se registrarem.
                </p>
              </div>
            </>
          )}

          {/* Step 3 — Ações */}
          {step === 3 && (
            <>
              <div>
                <h4 className="font-medium text-slate-800 mb-1">Ações a executar</h4>
                <p className="text-xs text-slate-500">Defina o que será feito automaticamente quando o dispositivo atender às condições.</p>
              </div>

              {/* Parâmetros TR-069 */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Code2 className="w-3.5 h-3.5 text-slate-500" />
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Parâmetros TR-069 a definir</label>
                </div>
                {parameters.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {parameters.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-xs">
                        <span className="font-mono text-slate-700 flex-1 truncate">{p.name}</span>
                        <span className="text-slate-400">=</span>
                        <span className="font-mono text-blue-700">{p.value}</span>
                        <span className="text-slate-300">({p.type.replace('xsd:', '')})</span>
                        <button onClick={() => removeParam(i)} className="text-slate-300 hover:text-red-500 ml-1">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Nome do parâmetro TR-069"
                    value={newParam.name}
                    onChange={e => setNewParam(p => ({ ...p, name: e.target.value }))}
                    className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Valor"
                    value={newParam.value}
                    onChange={e => setNewParam(p => ({ ...p, value: e.target.value }))}
                    className="w-24 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={newParam.type}
                    onChange={e => setNewParam(p => ({ ...p, type: e.target.value }))}
                    className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                    onKeyDown={e => e.key === 'Enter' && (tagsToAdd.push(newTag.trim()), setTagsToAdd([...tagsToAdd]), setNewTag(''))}
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
                    Nenhuma ação definida. A regra será criada mas não executará ações. Você pode editar depois para adicionar parâmetros ou tags.
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
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Salvando...</>
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
  const [editTarget, setEditTarget] = useState<AutoConfigRule | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['autoconfig-rules'],
    queryFn: () => autoconfigApi.list().then(r => r.data as AutoConfigRule[]),
    refetchInterval: 30000,
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

  const vendorLabel = (oui?: string) =>
    KNOWN_VENDORS.find(v => v.oui === oui)?.label || oui || '—'

  return (
    <div className="space-y-6">
      {(showWizard || editTarget) && (
        <AutoconfigWizard
          initial={editTarget ?? undefined}
          onClose={() => { setShowWizard(false); setEditTarget(null) }}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['autoconfig-rules'] })}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 max-w-xl">
            Regras de provisionamento automático. Quando um dispositivo se registrar no ACS e atender às condições
            definidas, os parâmetros e tags configurados são aplicados automaticamente via TR-069.
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0 ml-4"
        >
          <Plus className="w-4 h-4" /> Nova Regra
        </button>
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

      {/* Lista de regras */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Regras Configuradas</CardTitle>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
              {rules.filter(r => r.enabled).length} ativas
            </span>
          </div>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['autoconfig-rules'] })}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Carregando...</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Cpu className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhuma regra de autoconfig criada</p>
              <p className="text-xs mt-1">Clique em "Nova Regra" para configurar o provisionamento automático</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {[...rules].sort((a, b) => b.priority - a.priority).map(rule => (
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
                            <Tag className="w-3 h-3" /> Tags a adicionar
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
                          {rule.stats.errors} erro{rule.stats.errors !== 1 ? 's' : ''} na última execução
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

      {rules.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Regras ativas', value: rules.filter(r => r.enabled).length, color: 'text-green-600' },
            { label: 'Total de aplicações', value: rules.reduce((s, r) => s + r.stats.applied, 0), color: 'text-blue-600' },
            { label: 'Erros registrados', value: rules.reduce((s, r) => s + r.stats.errors, 0), color: 'text-red-500' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
