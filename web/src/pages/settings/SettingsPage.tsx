import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Save, RefreshCw, Shield, Database, Mail, Send,
  MessageSquare, Webhook, CheckCircle, XCircle, Loader2,
} from 'lucide-react'
import { settingsApi } from '@/api'
import { Card, CardHeader, CardTitle, CardContent, LoadingScreen } from '@/components/ui'
import toast from 'react-hot-toast'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface SettingField {
  key: string
  label: string
  type: 'text' | 'password' | 'number' | 'toggle' | 'select'
  placeholder?: string
  options?: { value: string; label: string }[]
  hint?: string
}

// ── Eventos disponíveis ───────────────────────────────────────────────────────

const ALERT_EVENTS = [
  { value: 'device_offline',    label: 'Dispositivo offline',       color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'device_online',     label: 'Dispositivo voltou online',  color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'signal_critical',   label: 'Sinal crítico (RX < -27)',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'signal_recovered',  label: 'Sinal recuperado',           color: 'bg-blue-100 text-blue-700 border-blue-200' },
]

// ── Seções de configuração ────────────────────────────────────────────────────

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
]

// ── Componente de seleção de eventos ─────────────────────────────────────────

function EventSelector({
  label,
  value,
  onChange,
}: {
  channel: string
  label: string
  value: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (evt: string) => {
    if (value.includes(evt)) {
      onChange(value.filter(e => e !== evt))
    } else {
      onChange([...value, evt])
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
        Eventos que disparam {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {ALERT_EVENTS.map(evt => {
          const active = value.includes(evt.value)
          return (
            <button
              key={evt.value}
              type="button"
              onClick={() => toggle(evt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active
                  ? evt.color + ' shadow-sm'
                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
              }`}
            >
              {active ? '✓ ' : ''}{evt.label}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-slate-400 mt-1.5">
        Clique nos eventos para ativar/desativar notificações {label} para cada tipo.
      </p>
    </div>
  )
}

// ── Componente de resultado de teste ─────────────────────────────────────────

function TestResult({ result }: { result: { ok: boolean; message?: string; error?: string; latencyMs?: number; statusCode?: number } | null }) {
  if (!result) return null
  return (
    <div className={`flex items-start gap-2 mt-2 p-2.5 rounded-lg text-sm ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
      {result.ok
        ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
        : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
      }
      <span>
        {result.ok
          ? (result.message || 'Conexão bem-sucedida') + (result.latencyMs ? ` (${result.latencyMs}ms)` : '')
          : (result.error || 'Falha na conexão')}
        {result.statusCode ? ` — HTTP ${result.statusCode}` : ''}
      </span>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [telegramResult, setTelegramResult] = useState<{ ok: boolean; message?: string; error?: string; latencyMs?: number } | null>(null)
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; message?: string; error?: string; latencyMs?: number; statusCode?: number } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll().then(r => r.data),
  })

  useEffect(() => {
    if (!data) return
    if (Array.isArray(data)) {
      const obj = (data as { key: string; value: unknown }[]).reduce(
        (acc, { key, value }) => ({ ...acc, [key]: value }),
        {} as Record<string, unknown>,
      )
      setValues(obj)
    } else {
      setValues(data as Record<string, unknown>)
    }
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

  // Helpers para eventos configuráveis
  const getEventList = (channel: string): string[] => {
    const v = values[`notifications.events.${channel}`]
    if (Array.isArray(v)) return v as string[]
    if (typeof v === 'string') {
      try { return JSON.parse(v) } catch { return [] }
    }
    // Defaults
    if (channel === 'telegram') return ['device_offline', 'signal_critical']
    if (channel === 'webhook')  return ['device_offline', 'device_online', 'signal_critical', 'signal_recovered']
    if (channel === 'email')    return ['device_offline', 'signal_critical']
    return []
  }

  const setEventList = (channel: string, list: string[]) => {
    setValue(`notifications.events.${channel}`, list)
  }

  // ── Funções de teste ──────────────────────────────────────────────────────

  const testSmtp = async () => {
    setTestingSmtp(true)
    try {
      await settingsApi.updateMany(values)
      const res = await settingsApi.testSmtp()
      if (res.data?.ok) {
        toast.success('E-mail de teste enviado! Verifique sua caixa de entrada.')
      } else {
        toast.error(`Falha no teste SMTP: ${res.data?.error || 'erro desconhecido'}`)
      }
    } catch (err: any) {
      toast.error(`Erro ao testar SMTP: ${err?.response?.data?.message || err?.message}`)
    } finally {
      setTestingSmtp(false)
    }
  }

  const testTelegram = async () => {
    setTestingTelegram(true)
    setTelegramResult(null)
    try {
      await settingsApi.updateMany(values)
      const res = await settingsApi.testTelegram()
      setTelegramResult(res.data)
      if (res.data?.ok) {
        toast.success('Mensagem de teste enviada no Telegram!')
      } else {
        toast.error(`Telegram: ${res.data?.error || 'falha desconhecida'}`)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Erro desconhecido'
      setTelegramResult({ ok: false, error: msg })
      toast.error(`Erro ao testar Telegram: ${msg}`)
    } finally {
      setTestingTelegram(false)
    }
  }

  const testWebhook = async () => {
    setTestingWebhook(true)
    setWebhookResult(null)
    try {
      await settingsApi.updateMany(values)
      const res = await settingsApi.testWebhook()
      setWebhookResult(res.data)
      if (res.data?.ok) {
        toast.success(`Webhook respondeu com sucesso (HTTP ${res.data.statusCode})`)
      } else {
        toast.error(`Webhook: ${res.data?.error || `HTTP ${res.data?.statusCode}`}`)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Erro desconhecido'
      setWebhookResult({ ok: false, error: msg })
      toast.error(`Erro ao testar Webhook: ${msg}`)
    } finally {
      setTestingWebhook(false)
    }
  }

  if (isLoading) return <LoadingScreen />

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Seções genéricas */}
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
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
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

      {/* ── Telegram ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-500" />
            <CardTitle>Notificações — Telegram</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            { key: 'notifications.telegram.enabled', label: 'Habilitar Telegram', type: 'toggle' as const, hint: 'Envia alertas críticos via bot do Telegram' },
            { key: 'notifications.telegram.botToken', label: 'Bot Token', type: 'password' as const, placeholder: '123456:ABC-DEF...', hint: 'Obtenha com @BotFather no Telegram' },
            { key: 'notifications.telegram.chatId', label: 'Chat ID', type: 'text' as const, placeholder: '-100123456789', hint: 'ID do grupo ou canal que receberá os alertas' },
          ] as SettingField[]).map((field: SettingField) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
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
              ) : (
                <input
                  type={field.type}
                  value={(values[field.key] as string) || ''}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              )}
              {field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}
            </div>
          ))}

          <EventSelector
            channel="telegram"
            label="no Telegram"
            value={getEventList('telegram')}
            onChange={(v) => setEventList('telegram', v)}
          />

          <div className="pt-2">
            <button
              onClick={testTelegram}
              disabled={testingTelegram}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium text-sm rounded-lg transition-colors"
            >
              {testingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
              Testar Telegram
            </button>
            <TestResult result={telegramResult} />
          </div>
        </CardContent>
      </Card>

      {/* ── Webhook ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-slate-500" />
            <CardTitle>Notificações — Webhook</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            { key: 'notifications.webhook.enabled', label: 'Habilitar Webhook', type: 'toggle' as const, hint: 'Envia alertas como JSON para uma URL externa (Slack, N8N, Make, etc.)' },
            { key: 'notifications.webhook.url', label: 'URL do Webhook', type: 'text' as const, placeholder: 'https://hooks.slack.com/...', hint: 'Endpoint que receberá o payload JSON do alerta' },
            { key: 'notifications.webhook.secret', label: 'Secret (opcional)', type: 'password' as const, placeholder: 'meu-secret', hint: 'Enviado no header X-BR10ACS-Secret para validação' },
          ] as SettingField[]).map((field: SettingField) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
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
              ) : (
                <input
                  type={field.type}
                  value={(values[field.key] as string) || ''}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              )}
              {field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}
            </div>
          ))}

          <EventSelector
            channel="webhook"
            label="no Webhook"
            value={getEventList('webhook')}
            onChange={(v) => setEventList('webhook', v)}
          />

          <div className="pt-2">
            <button
              onClick={testWebhook}
              disabled={testingWebhook}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium text-sm rounded-lg transition-colors"
            >
              {testingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Webhook className="w-4 h-4" />}
              Testar Webhook
            </button>
            <TestResult result={webhookResult} />
          </div>
        </CardContent>
      </Card>

      {/* ── SMTP ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-500" />
            <CardTitle>Notificações — E-mail (SMTP)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {([
            { key: 'notifications.smtp.enabled', label: 'Habilitar E-mail', type: 'toggle' as const, hint: 'Envia alertas por e-mail via servidor SMTP' },
            { key: 'notifications.smtp.host', label: 'Servidor SMTP', type: 'text' as const, placeholder: 'smtp.gmail.com', hint: 'Ex: smtp.gmail.com, smtp.office365.com, mail.suaempresa.com' },
            { key: 'notifications.smtp.port', label: 'Porta SMTP', type: 'number' as const, placeholder: '587', hint: '587 (TLS/STARTTLS) · 465 (SSL) · 25 (sem criptografia)' },
            { key: 'notifications.smtp.secure', label: 'Usar SSL/TLS (porta 465)', type: 'toggle' as const, hint: 'Ative apenas se usar a porta 465. Para porta 587 (STARTTLS), deixe desativado.' },
            { key: 'notifications.smtp.user', label: 'Usuário SMTP', type: 'text' as const, placeholder: 'alertas@suaempresa.com', hint: 'Geralmente o próprio endereço de e-mail' },
            { key: 'notifications.smtp.pass', label: 'Senha SMTP', type: 'password' as const, placeholder: '••••••••', hint: 'Para Gmail: use uma App Password (Senha de aplicativo), não a senha da conta' },
            { key: 'notifications.smtp.from', label: 'Remetente', type: 'text' as const, placeholder: 'BR10ACS <alertas@suaempresa.com>', hint: 'Endereço que aparecerá no campo "De" do e-mail' },
            { key: 'notifications.smtp.to', label: 'Destinatário(s)', type: 'text' as const, placeholder: 'noc@suaempresa.com, ti@suaempresa.com', hint: 'Separe múltiplos destinatários com vírgula' },
          ] as SettingField[]).map((field: SettingField) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
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

          <EventSelector
            channel="email"
            label="por E-mail"
            value={getEventList('email')}
            onChange={(v) => setEventList('email', v)}
          />
        </CardContent>
      </Card>

      {/* ── Rodapé com botões de ação ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={testSmtp}
            disabled={testingSmtp}
            className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium text-sm rounded-lg transition-colors"
          >
            {testingSmtp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Testar E-mail SMTP
          </button>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium text-sm rounded-lg transition-colors"
        >
          {saveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Configurações
        </button>
      </div>
    </div>
  )
}
