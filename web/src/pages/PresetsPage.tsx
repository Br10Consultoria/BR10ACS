import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Save, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { presetsApi } from '@/api'
import toast from 'react-hot-toast'

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Preset {
  _id: string
  weight?: number
  precondition?: string
  provisions?: [string, ...unknown[]][]
  events?: Record<string, boolean>
  channel?: string
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PresetsPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'presets' | 'provisions'>('presets')

  return (
    <div className="space-y-5">
      <div className="flex gap-2 border-b border-slate-200 pb-0">
        {(['presets', 'provisions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'presets' ? 'Presets' : 'Provisões (Scripts)'}
          </button>
        ))}
      </div>

      {activeTab === 'presets' ? (
        <PresetsTab qc={qc} />
      ) : (
        <ProvisionsTab qc={qc} />
      )}
    </div>
  )
}

// ── Presets Tab ───────────────────────────────────────────────────────────────
function PresetsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newJson, setNewJson] = useState('{\n  "weight": 100,\n  "precondition": "true",\n  "provisions": [["inform"]]\n}')
  const [showNew, setShowNew] = useState(false)

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ['presets'],
    queryFn: () => presetsApi.listPresets().then((r) => r.data as Preset[]),
  })

  const deleteMut = useMutation({
    mutationFn: (name: string) => presetsApi.deletePreset(name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['presets'] }); toast.success('Preset removido') },
    onError: () => toast.error('Erro ao remover preset'),
  })

  const saveMut = useMutation({
    mutationFn: ({ name, body }: { name: string; body: object }) => presetsApi.putPreset(name, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presets'] })
      toast.success('Preset salvo')
      setShowNew(false)
      setNewName('')
    },
    onError: () => toast.error('Erro ao salvar preset'),
  })

  const handleSaveNew = () => {
    if (!newName.trim()) return toast.error('Informe um nome')
    try {
      const body = JSON.parse(newJson)
      saveMut.mutate({ name: newName.trim(), body })
    } catch {
      toast.error('JSON inválido')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          Presets definem quais provisões são executadas em cada dispositivo com base em condições.
        </p>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Novo Preset
        </button>
      </div>

      {showNew && (
        <Card>
          <CardHeader><CardTitle>Novo Preset</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <input
              type="text"
              placeholder="Nome do preset (ex: default)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              value={newJson}
              onChange={(e) => setNewJson(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="JSON do preset"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveNew}
                disabled={saveMut.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Salvar
              </button>
              <button
                onClick={() => setShowNew(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Carregando presets...</div>
      ) : presets.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Nenhum preset configurado no GenieACS</div>
      ) : (
        <div className="space-y-2">
          {presets.map((p) => (
            <Card key={p._id}>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer"
                onClick={() => setExpanded(expanded === p._id ? null : p._id)}
              >
                <div className="flex items-center gap-3">
                  {expanded === p._id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <span className="font-medium text-slate-800">{p._id}</span>
                  {p.weight !== undefined && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">peso: {p.weight}</span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMut.mutate(p._id) }}
                  className="text-red-400 hover:text-red-600 p-1 rounded"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {expanded === p._id && (
                <CardContent className="pt-0">
                  <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto">
                    {JSON.stringify(p, null, 2)}
                  </pre>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Provisions Tab ────────────────────────────────────────────────────────────
function ProvisionsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newScript, setNewScript] = useState('// Script de provisão GenieACS\n// Documentação: https://docs.genieacs.com/en/latest/script-api.html\n\nconst inform = declare("InternetGatewayDevice.DeviceInfo.UpTime", { value: Date.now() / 1000 });\n')
  const [showNew, setShowNew] = useState(false)

  const { data: provisions = [], isLoading } = useQuery({
    queryKey: ['provisions'],
    queryFn: () => presetsApi.listProvisions().then((r) => r.data as { _id: string; script?: string }[]),
  })

  const deleteMut = useMutation({
    mutationFn: (name: string) => presetsApi.deleteProvision(name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['provisions'] }); toast.success('Provisão removida') },
    onError: () => toast.error('Erro ao remover provisão'),
  })

  const saveMut = useMutation({
    mutationFn: ({ name, script }: { name: string; script: string }) => presetsApi.putProvision(name, script),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provisions'] })
      toast.success('Provisão salva')
      setShowNew(false)
      setNewName('')
    },
    onError: () => toast.error('Erro ao salvar provisão'),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          Scripts JavaScript executados pelo GenieACS durante o provisionamento de dispositivos.
        </p>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Nova Provisão
        </button>
      </div>

      {showNew && (
        <Card>
          <CardHeader><CardTitle>Nova Provisão</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <input
              type="text"
              placeholder="Nome da provisão (ex: default, inform)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              value={newScript}
              onChange={(e) => setNewScript(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Script JavaScript"
            />
            <div className="flex gap-2">
              <button
                onClick={() => saveMut.mutate({ name: newName.trim(), script: newScript })}
                disabled={saveMut.isPending || !newName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> Salvar
              </button>
              <button
                onClick={() => setShowNew(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Carregando provisões...</div>
      ) : provisions.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Nenhuma provisão configurada no GenieACS</div>
      ) : (
        <div className="space-y-2">
          {provisions.map((p) => (
            <Card key={p._id}>
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer"
                onClick={() => setExpanded(expanded === p._id ? null : p._id)}
              >
                <div className="flex items-center gap-3">
                  {expanded === p._id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <span className="font-medium text-slate-800">{p._id}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMut.mutate(p._id) }}
                  className="text-red-400 hover:text-red-600 p-1 rounded"
                  title="Remover"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {expanded === p._id && p.script && (
                <CardContent className="pt-0">
                  <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">
                    {p.script}
                  </pre>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
