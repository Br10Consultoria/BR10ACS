import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, Shield, Bell, Database } from 'lucide-react'
import { settingsApi } from '@/api'
import { Card, CardHeader, CardTitle, CardContent, LoadingScreen } from '@/components/ui'
import toast from 'react-hot-toast'

interface SettingField {
  key: string
  label: string
  type: 'text' | 'password' | 'number' | 'toggle' | 'select'
  placeholder?: string
  options?: { value: string; label: string }[]
  hint?: string
}

const sections = [
  {
    title: 'GenieACS',
    icon: Database,
    fields: [
      { key: 'genieacs.nbiUrl', label: 'NBI URL', type: 'text', placeholder: 'http://host:7557', hint: 'URL da API REST do GenieACS' },
      { key: 'genieacs.cwmpUrl', label: 'CWMP URL', type: 'text', placeholder: 'http://host:7547' },
      { key: 'genieacs.username', label: 'Usuário NBI', type: 'text', placeholder: 'admin' },
      { key: 'genieacs.password', label: 'Senha NBI', type: 'password', placeholder: '••••••••' },
    ] as SettingField[],
  },
  {
    title: 'Coletor de Dados',
    icon: RefreshCw,
    fields: [
      { key: 'collector.enabled', label: 'Coletor ativo', type: 'toggle' },
      { key: 'collector.interval', label: 'Intervalo (segundos)', type: 'number', placeholder: '300' },
      { key: 'collector.batchSize', label: 'Tamanho do lote', type: 'number', placeholder: '100' },
      { key: 'collector.offlineThreshold', label: 'Tempo offline (segundos)', type: 'number', placeholder: '900' },
    ] as SettingField[],
  },
  {
    title: 'Segurança',
    icon: Shield,
    fields: [
      { key: 'security.sessionTimeout', label: 'Timeout de sessão (min)', type: 'number', placeholder: '60' },
      { key: 'security.maxLoginAttempts', label: 'Máx. tentativas de login', type: 'number', placeholder: '5' },
      { key: 'security.lockoutDuration', label: 'Duração do bloqueio (min)', type: 'number', placeholder: '15' },
    ] as SettingField[],
  },
  {
    title: 'Notificações',
    icon: Bell,
    fields: [
      { key: 'notifications.offlineAlert', label: 'Alerta de dispositivo offline', type: 'toggle' },
      { key: 'notifications.webhookUrl', label: 'Webhook URL', type: 'text', placeholder: 'https://...' },
    ] as SettingField[],
  },
]

export default function SettingsPage() {
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, unknown>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll().then(r => r.data),
  })

  useEffect(() => {
    if (data) setValues(data)
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.updateMany(values),
    onSuccess: () => {
      toast.success('Configurações salvas com sucesso')
      qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: () => toast.error('Erro ao salvar configurações'),
  })

  const setValue = (key: string, value: unknown) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6 max-w-3xl">
      {sections.map(({ title, icon: Icon, fields }) => (
        <Card key={title}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-slate-500" />
              <CardTitle>{title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {field.label}
                </label>
                {field.type === 'toggle' ? (
                  <button
                    onClick={() => setValue(field.key, !values[field.key])}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      values[field.key] ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      values[field.key] ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                ) : field.type === 'select' ? (
                  <select
                    value={(values[field.key] as string) || ''}
                    onChange={(e) => setValue(field.key, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={(values[field.key] as string) || ''}
                    onChange={(e) => setValue(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                )}
                {field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium text-sm rounded-lg transition-colors"
        >
          {saveMutation.isPending ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salvar Configurações
        </button>
      </div>
    </div>
  )
}
