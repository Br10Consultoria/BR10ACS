import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Save, RefreshCw, MessageSquare, CheckCircle, XCircle, Loader2,
  Bot, Globe, Info,
} from 'lucide-react'
import { settingsApi, telegramBotApi } from '@/api'
import { Card, CardHeader, CardTitle, CardContent, LoadingScreen } from '@/components/ui'
import toast from 'react-hot-toast'

const ALERT_EVENTS = [
  { value: 'device_offline',   label: 'Dispositivo offline',      color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'device_online',    label: 'Dispositivo voltou online', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'signal_critical',  label: 'Sinal crítico (RX < -27)', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'signal_recovered', label: 'Sinal recuperado',          color: 'bg-blue-100 text-blue-700 border-blue-200' },
]

function TestResult({ result }: { result: { ok: boolean; message?: string; error?: string; latencyMs?: number } | null }) {
  if (!result) return null
  return (
    <div className={`flex items-start gap-2 mt-2 p-2.5 rounded-lg text-sm ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
      {result.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
      <span>{result.ok ? (result.message || 'Enviado com sucesso') + (result.latencyMs ? ` (${result.latencyMs}ms)` : '') : (result.error || 'Falha')}</span>
    </div>
  )
}

export default function TelegramSettingsPage() {
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; error?: string; latencyMs?: number } | null>(null)
  const [registering, setRegistering] = useState(false)
  const [regResult, setRegResult] = useState<{ ok: boolean; description?: string } | null>(null)
  const [webhookInfo, setWebhookInfo] = useState<any>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll().then(r => r.data),
  })

  useEffect(() => {
    if (!data) return
    const obj = Array.isArray(data)
      ? (data as { key: string; value: unknown }[]).reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {} as Record<string, unknown>)
      : (data as Record<string, unknown>)
    setValues(obj)
  }, [data])

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.updateMany(values),
    onSuccess: () => { toast.success('Configurações salvas'); qc.invalidateQueries({ queryKey: ['settings'] }) },
    onError: () => toast.error('Erro ao salvar'),
  })

  const setValue = (key: string, value: unknown) => setValues(prev => ({ ...prev, [key]: value }))

  const getEventList = (): string[] => {
    const v = values['notifications.events.telegram']
    if (Array.isArray(v)) return v as string[]
    if (typeof v === 'string') { try { return JSON.parse(v) } catch { return [] } }
    return ['device_offline', 'signal_critical']
  }

  const toggleEvent = (evt: string) => {
    const list = getEventList()
    setValue('notifications.events.telegram', list.includes(evt) ? list.filter(e => e !== evt) : [...list, evt])
  }

  const testTelegram = async () => {
    setTesting(true); setTestResult(null)
    try {
      await settingsApi.updateMany(values)
      const res = await settingsApi.testTelegram()
      setTestResult(res.data)
      res.data?.ok ? toast.success('Mensagem enviada!') : toast.error(res.data?.error || 'Falha')
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Erro'
      setTestResult({ ok: false, error: msg }); toast.error(msg)
    } finally { setTesting(false) }
  }

  const registerWebhook = async () => {
    const url = (values['telegram.bot.publicUrl'] as string || '').trim()
    if (!url) { toast.error('Informe a URL pública antes de registrar'); return }
    setRegistering(true); setRegResult(null)
    try {
      await settingsApi.updateMany(values)
      const result = await telegramBotApi.registerWebhook(url)
      setRegResult(result)
      result.ok ? toast.success('Webhook registrado!') : toast.error(result.description || 'Falha')
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro'
      setRegResult({ ok: false, description: msg }); toast.error(msg)
    } finally { setRegistering(false) }
  }

  const loadWebhookInfo = async () => {
    setLoadingInfo(true)
    try { const info = await telegramBotApi.getWebhookInfo(); setWebhookInfo(info?.result || info) }
    catch { setWebhookInfo(null) }
    finally { setLoadingInfo(false) }
  }

  if (isLoading) return <LoadingScreen />

  const eventList = getEventList()

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Notificações Telegram ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-500" />
            <CardTitle>Notificações — Telegram</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Habilitar */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Habilitar Telegram</label>
            <button
              onClick={() => setValue('notifications.telegram.enabled', !values['notifications.telegram.enabled'])}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${values['notifications.telegram.enabled'] ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${values['notifications.telegram.enabled'] ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <p className="text-xs text-slate-400 mt-1">Envia alertas críticos via bot do Telegram</p>
          </div>

          {/* Bot Token */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Bot Token</label>
            <input
              type="password"
              value={(values['notifications.telegram.botToken'] as string) || ''}
              onChange={e => setValue('notifications.telegram.botToken', e.target.value)}
              placeholder="123456:ABC-DEF..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-xs text-slate-400 mt-1">Obtenha com @BotFather no Telegram</p>
          </div>

          {/* Chat ID */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Chat ID</label>
            <input
              type="text"
              value={(values['notifications.telegram.chatId'] as string) || ''}
              onChange={e => setValue('notifications.telegram.chatId', e.target.value)}
              placeholder="-100123456789"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-xs text-slate-400 mt-1">ID do grupo ou canal que receberá os alertas</p>
          </div>

          {/* Eventos */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Eventos que disparam notificação</p>
            <div className="flex flex-wrap gap-2">
              {ALERT_EVENTS.map(evt => {
                const active = eventList.includes(evt.value)
                return (
                  <button key={evt.value} type="button" onClick={() => toggleEvent(evt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${active ? evt.color + ' shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'}`}
                  >
                    {active ? '✓ ' : ''}{evt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Testar */}
          <div className="pt-2">
            <button onClick={testTelegram} disabled={testing}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium text-sm rounded-lg transition-colors"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
              Testar Telegram
            </button>
            <TestResult result={testResult} />
          </div>
        </CardContent>
      </Card>

      {/* ── Bot de Autoatendimento ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-slate-500" />
            <CardTitle>Bot de Autoatendimento (Telegram)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Como funciona o autoatendimento</p>
              <p className="text-xs mt-1 text-blue-700">
                O bot usa o mesmo token configurado acima. O assinante envia uma mensagem para o bot,
                informa o login PPPoE e pode trocar a senha WiFi. O sistema busca o dispositivo no
                GenieACS via integração IXC e aplica a alteração via TR-069 automaticamente.
              </p>
              <p className="text-xs mt-1 text-blue-700">
                <strong>Comandos:</strong> /start • /wifi (trocar senha) • /status • /cancelar • /ajuda
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Habilitar Bot de Autoatendimento</label>
            <button
              onClick={() => setValue('telegram.bot.enabled', !values['telegram.bot.enabled'])}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${values['telegram.bot.enabled'] ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${values['telegram.bot.enabled'] ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <p className="text-xs text-slate-400 mt-1">Usa o mesmo Bot Token configurado acima</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">URL Pública do Sistema</label>
            <input
              type="url"
              value={(values['telegram.bot.publicUrl'] as string) || ''}
              onChange={e => setValue('telegram.bot.publicUrl', e.target.value)}
              placeholder="https://acs.suaempresa.com.br"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-xs text-slate-400 mt-1">
              O Telegram enviará mensagens para:{' '}
              <code className="bg-slate-100 px-1 rounded text-xs">
                {(values['telegram.bot.publicUrl'] as string) || 'https://...'}/api/v1/telegram/webhook
              </code>
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={registerWebhook} disabled={registering}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              Registrar Webhook no Telegram
            </button>
            <button onClick={loadWebhookInfo} disabled={loadingInfo}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {loadingInfo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Info className="w-4 h-4" />}
              Ver Status do Webhook
            </button>
          </div>

          {regResult && (
            <div className={`flex items-start gap-2 p-2.5 rounded-lg text-sm ${regResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {regResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{regResult.ok ? 'Webhook registrado com sucesso!' : regResult.description}</span>
            </div>
          )}

          {webhookInfo && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono space-y-1">
              <p className="font-semibold text-slate-700 font-sans text-sm mb-2">Status atual do webhook:</p>
              <p><span className="text-slate-500">URL:</span> {webhookInfo.url || '(não registrado)'}</p>
              {webhookInfo.pending_update_count !== undefined && (
                <p><span className="text-slate-500">Mensagens pendentes:</span> {webhookInfo.pending_update_count}</p>
              )}
              {webhookInfo.last_error_message && (
                <p className="text-red-600"><span className="text-slate-500">Último erro:</span> {webhookInfo.last_error_message}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Botão Salvar ─────────────────────────────────────────────────────── */}
      <div className="flex justify-end">
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
