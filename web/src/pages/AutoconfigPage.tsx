import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Cpu, Plus, Trash2, CheckCircle, ChevronRight, ChevronDown,
  Zap, RefreshCw, Info, X,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { presetsApi } from '@/api'
import toast from 'react-hot-toast'

// ── Constantes ────────────────────────────────────────────────────────────────

const KNOWN_VENDORS: { label: string; oui: string }[] = [
  { label: 'INTELBRAS', oui: '00259E' },
  { label: 'HUAWEI', oui: '6C8D6F' },
  { label: 'ZTE', oui: 'BC76C7' },
  { label: 'NOKIA (Alcatel)', oui: '3C1E04' },
  { label: 'FIBERHOME', oui: '00259E' },
  { label: 'VSOL', oui: 'A8F7E0' },
  { label: 'TP-LINK', oui: '1C61B4' },
  { label: 'DATACOM', oui: '001E8C' },
  { label: 'Outro (manual)', oui: '' },
]

interface Preset {
  _id: string
  weight?: number
  precondition?: string
  configurations?: unknown[]
}

function parsePrecondition(raw?: string): { oui?: string; model?: string } {
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw)
    return {
      oui: obj['DeviceID.OUI'] || obj['deviceId.OUI'] || undefined,
      model: obj['DeviceID.ProductClass'] || obj['deviceId.ProductClass'] || undefined,
    }
  } catch {
    return {}
  }
}

function isAutoconfig(preset: Preset): boolean {
  return preset._id.startsWith('br10acs_')
}

// ── Wizard de criação ─────────────────────────────────────────────────────────

interface WizardProps {
  onClose: () => void
  onSuccess: () => void
}

function AutoconfigWizard({ onClose, onSuccess }: WizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedVendor, setSelectedVendor] = useState<{ label: string; oui: string } | null>(null)
  const [customOui, setCustomOui] = useState('')
  const [model, setModel] = useState('')
  const [action, setAction] = useState<'collect' | 'reboot' | 'firmware'>('collect')

  const templateMut = useMutation({
    mutationFn: ({ oui, productClass }: { oui: string; productClass?: string }) =>
      presetsApi.applyTemplate(oui, productClass),
    onSuccess: (res: { data?: { preset?: string } }) => {
      toast.success(`Autoconfig criado: ${res.data?.preset || 'OK'}`)
      onSuccess()
      onClose()
    },
    onError: () => toast.error('Erro ao criar autoconfig'),
  })

  const finalOui = selectedVendor?.oui || customOui.trim().toUpperCase()
  const canNext1 = !!finalOui
  const canFinish = !!finalOui

  const handleCreate = () => {
    if (!finalOui) return
    templateMut.mutate({ oui: finalOui, productClass: model.trim() || undefined })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Novo Autoconfig</h3>
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
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-blue-600' : 'bg-slate-100'
              }`}
            />
          ))}
        </div>

        {/* Step 1 — Fabricante */}
        {step === 1 && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <h4 className="font-medium text-slate-800 mb-1">Selecione o fabricante</h4>
              <p className="text-xs text-slate-500">O OUI identifica o fabricante do equipamento no TR-069.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {KNOWN_VENDORS.map(v => (
                <button
                  key={v.label}
                  onClick={() => { setSelectedVendor(v); setCustomOui('') }}
                  className={`flex items-center gap-2 px-3 py-2.5 border rounded-xl text-sm text-left transition-all ${
                    selectedVendor?.label === v.label
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {selectedVendor?.label === v.label && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span className="truncate">{v.label}</span>
                </button>
              ))}
            </div>
            {selectedVendor?.label === 'Outro (manual)' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">OUI (6 caracteres hex)</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Ex: 00259E"
                  value={customOui}
                  onChange={e => setCustomOui(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setStep(2)}
                disabled={!canNext1}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Modelo (opcional) */}
        {step === 2 && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <h4 className="font-medium text-slate-800 mb-1">Modelo do equipamento</h4>
              <p className="text-xs text-slate-500">Deixe em branco para aplicar a <strong>todos os modelos</strong> do fabricante selecionado.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Modelo / ProductClass</label>
              <input
                type="text"
                placeholder="Ex: 1200R, HG8145V5, F670L... (opcional)"
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                O autoconfig será aplicado automaticamente a <strong>qualquer ONT/CPE</strong> com OUI <code className="font-mono">{finalOui}</code>
                {model ? ` e modelo "${model}"` : ''} que se conectar ao ACS.
              </p>
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
                Voltar
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Ação */}
        {step === 3 && (
          <div className="px-6 py-5 space-y-4">
            <div>
              <h4 className="font-medium text-slate-800 mb-1">Ação automática</h4>
              <p className="text-xs text-slate-500">O que o ACS deve fazer quando o dispositivo se conectar.</p>
            </div>
            <div className="space-y-2">
              {[
                { value: 'collect', label: 'Coletar dados', desc: 'Coleta sinal óptico, tráfego, Wi-Fi, hosts e informações do dispositivo' },
                { value: 'reboot', label: 'Reiniciar', desc: 'Envia comando de reboot no próximo Inform' },
                { value: 'firmware', label: 'Atualizar firmware', desc: 'Aplica atualização de firmware (requer arquivo no GenieACS)' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAction(opt.value as 'collect' | 'reboot' | 'firmware')}
                  className={`w-full flex items-start gap-3 px-4 py-3 border rounded-xl text-left transition-all ${
                    action === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 ${
                    action === opt.value ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                  }`}>
                    {action === opt.value && <div className="w-1.5 h-1.5 bg-white rounded-full m-auto mt-0.5" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-800">{opt.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {action !== 'collect' && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 flex gap-2">
                <Info className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-700">
                  {action === 'reboot'
                    ? 'O dispositivo será reiniciado automaticamente a cada Inform. Use com cautela.'
                    : 'O firmware deve estar previamente enviado na tela de Arquivos.'}
                </p>
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
                Voltar
              </button>
              <button
                onClick={handleCreate}
                disabled={!canFinish || templateMut.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
              >
                {templateMut.isPending ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Criando...</>
                ) : (
                  <><Zap className="w-4 h-4" /> Criar Autoconfig</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AutoconfigPage() {
  const qc = useQueryClient()
  const [showWizard, setShowWizard] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: presets = [], isLoading, refetch } = useQuery({
    queryKey: ['presets'],
    queryFn: () => presetsApi.listPresets().then(r => r.data as Preset[]),
  })

  const deleteMut = useMutation({
    mutationFn: (name: string) => presetsApi.deletePreset(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presets'] })
      toast.success('Autoconfig removido')
    },
    onError: () => toast.error('Erro ao remover autoconfig'),
  })

  const autoconfigs = presets.filter(isAutoconfig)
  const others = presets.filter(p => !isAutoconfig(p))

  return (
    <div className="space-y-6">
      {showWizard && (
        <AutoconfigWizard
          onClose={() => setShowWizard(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['presets'] })
            qc.invalidateQueries({ queryKey: ['provisions'] })
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 max-w-xl">
            Configure o provisionamento automático por fabricante e modelo. Quando um dispositivo se conectar ao ACS,
            o autoconfig correspondente será aplicado automaticamente no próximo Inform.
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0 ml-4"
        >
          <Plus className="w-4 h-4" /> Novo Autoconfig
        </button>
      </div>

      {/* Como funciona */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-700">Como funciona o Autoconfig?</p>
              <p className="text-xs text-slate-500">
                O GenieACS avalia os presets a cada <strong>Inform</strong> (BOOTSTRAP, BOOT ou PERIODIC).
                Quando uma ONT com o OUI/modelo configurado se conectar, o preset é aplicado automaticamente —
                sem necessidade de intervenção manual. A provisão criada coleta sinal óptico, tráfego, Wi-Fi,
                hosts e informações do dispositivo.
              </p>
              <div className="flex flex-wrap gap-4 mt-2">
                {[
                  { step: '1', label: 'ONT conecta ao ACS' },
                  { step: '2', label: 'GenieACS avalia presets' },
                  { step: '3', label: 'Preset com OUI/modelo correspondente é aplicado' },
                  { step: '4', label: 'Provisão coleta dados automaticamente' },
                ].map(s => (
                  <div key={s.step} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {s.step}
                    </span>
                    <span className="text-xs text-slate-600">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Autoconfigs criados pelo BR10ACS */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Autoconfigs Ativos</CardTitle>
          <button
            onClick={() => refetch()}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Carregando...</div>
          ) : autoconfigs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Cpu className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhum autoconfig configurado</p>
              <p className="text-xs mt-1">Clique em "Novo Autoconfig" para começar</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {autoconfigs.map(p => {
                const { oui, model } = parsePrecondition(p.precondition)
                const vendor = KNOWN_VENDORS.find(v => v.oui === oui)
                return (
                  <div key={p._id}>
                    <div
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpanded(expanded === p._id ? null : p._id)}
                    >
                      <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Cpu className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-800 text-sm">
                            {vendor?.label || oui || p._id}
                          </span>
                          {model && (
                            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                              {model}
                            </span>
                          )}
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded flex items-center gap-1">
                            <Zap className="w-3 h-3" /> ativo
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">
                          OUI: {oui || '—'} · Preset: {p._id}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); deleteMut.mutate(p._id) }}
                          disabled={deleteMut.isPending}
                          className="text-slate-300 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {expanded === p._id
                          ? <ChevronDown className="w-4 h-4 text-slate-400" />
                          : <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                      </div>
                    </div>
                    {expanded === p._id && (
                      <div className="px-5 pb-4 bg-slate-50 border-t border-slate-100">
                        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <div className="text-slate-400 font-medium uppercase tracking-wider mb-1">Fabricante</div>
                            <div className="text-slate-700">{vendor?.label || oui || '—'}</div>
                          </div>
                          <div>
                            <div className="text-slate-400 font-medium uppercase tracking-wider mb-1">OUI</div>
                            <div className="text-slate-700 font-mono">{oui || '—'}</div>
                          </div>
                          <div>
                            <div className="text-slate-400 font-medium uppercase tracking-wider mb-1">Modelo</div>
                            <div className="text-slate-700 font-mono">{model || 'Todos'}</div>
                          </div>
                          <div>
                            <div className="text-slate-400 font-medium uppercase tracking-wider mb-1">Peso</div>
                            <div className="text-slate-700">{p.weight ?? 100}</div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Precondição (JSON)</div>
                          <pre className="bg-slate-900 text-green-400 rounded-lg p-3 text-xs overflow-x-auto">
                            {p.precondition || 'true'}
                          </pre>
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

      {/* Outros presets (não BR10ACS) */}
      {others.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Outros Presets GenieACS</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              {others.map(p => (
                <div key={p._id} className="flex items-center gap-4 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-700">{p._id}</span>
                    {p.precondition && (
                      <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">{p.precondition}</div>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">peso: {p.weight ?? '—'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
