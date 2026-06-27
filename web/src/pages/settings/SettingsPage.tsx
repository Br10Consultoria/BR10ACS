import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, Shield, Bell, Database, Mail, Send } from 'lucide-react'
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
    title: 'Notificações — Telegram',
    icon: Bell,
    fields: [
      { key: 'notifications.telegram.enabled', label: 'Habilitar Telegram', type: 'toggle', hint: 'Envia alertas críticos via bot do Telegram' },
      { key: 'notifications.telegram.botToken', label: 'Bot Token', type: 'password', placeholder: '123456:ABC-DEF...', hint: 'Obtenha com @BotFather no Telegram' },
      { key: 'notifications.telegram.chatId', label: 'Chat ID', type: 'text', placeholder: '-100123456789', hint: 'ID do grupo ou canal que receberá os alertas' },
    ] as SettingField[],
  },
  {
    title: 'Notificações — Webhook',
    icon: Bell,
    fields: [
      { key: 'notifications.webhook.enabled', label: 'Habilitar Webhook', type: 'toggle', hint: 'Envia alertas como JSON para uma URL externa (Slack, N8N, Make, etc.)' },
      { key: 'notifications.webhook.url', label: 'URL do Webhook', type: 'text', placeholder: 'https://hooks.slack.com/...', hint: 'Endpoint que receberá o payload JSON do alerta' },
      { key: 'notifications.webhook.secret', label: 'Secret (opcional)', type: 'password', placeholder: 'meu-secret', hint: 'Enviado no header X-BR10ACS-Secret para validação' },
    ] as SettingField[],
  },
  {
    title: 'Notificações — E-mail (SMTP)',
    icon: Mail,
    fields: [
      { key: 'notifications.smtp.enabled', label: 'Habilitar E-mail', type: 'toggle', hint: 'Envia alertas por e-mail via servidor SMTP' },
      { key: 'notifications.smtp.host', label: 'Servidor SMTP', type: 'text', placeholder: 'smtp.gmail.com', hint: 'Ex: smtp.gmail.com, smtp.office365.com, mail.suaempresa.com' },
      { key: 'notifications.smtp.port', label: 'Porta SMTP', type: 'number', placeholder: '587', hint: '587 (TLS/STARTTLS) · 465 (SSL) · 25 (sem criptografia)' },
      { key: 'notifications.smtp.secure', label: 'Usar SSL/TLS (porta 465)', type: 'toggle', hint: 'Ative apenas se usar a porta 465. Para porta 587 (STARTTLS), deixe desativado.' },
      { key: 'notifications.smtp.user', label: 'Usuário SMTP', type: 'text', placeholder: 'alertas@suaempresa.com', hint: 'Geralmente o próprio endereço de e-mail' },
      { key: 'notifications.smtp.pass', label: 'Senha SMTP', type: 'password', placeholder: '••••••••', hint: 'Para Gmail: use uma App Password (Senha de aplicativo), não a senha da conta' },
      { key: 'notifications.smtp.from', label: 'Remetente', type: 'text', placeholder: 'BR10ACS <alertas@suaempresa.com>', hint: 'Endereço que aparecerá no campo "De" do e-mail' },
      { key: 'notifications.smtp.to', label: 'Destinatário(s)', type: 'text', placeholder: 'noc@suaempresa.com, ti@suaempresa.com', hint: 'Separe múltiplos destinatários com vírgula' },
    ] as SettingField[],
  },
]

export default function SettingsPage() {
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [testingSmtp, setTestingSmtp] = useState(false)

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

  const testSmtp = async () => {
    setTestingSmtp(true)
    try {
      // Salva primeiro para garantir que os valores mais recentes estão no banco
      await settingsApi.updateMany(values)
      const res = await settingsApi.testSmtp()
      if (res.data?.ok) {
        toast.success('E-mail de teste enviado com sucesso! Verifique sua caixa de entrada.')
      } else {
        toast.error(`Falha no teste SMTP: ${res.data?.error || 'erro desconhecido'}`)
      }
    } catch (err: any) {
      toast.error(`Erro ao testar SMTP: ${err?.response?.data?.message || err?.message}`)
    } finally {
      setTestingSmtp(false)
    }
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

      <div className="flex items-center justify-between">
        <button
          onClick={testSmtp}
          disabled={testingSmtp}
          className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium text-sm rounded-lg transition-colors"
        >
          {testingSmtp ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Testar E-mail SMTP
        </button>
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
