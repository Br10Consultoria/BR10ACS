import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RefreshCw, Mail, Send, Loader2 } from 'lucide-react'
import { settingsApi } from '@/api'
import { Card, CardHeader, CardTitle, CardContent, LoadingScreen } from '@/components/ui'
import toast from 'react-hot-toast'

const ALERT_EVENTS = [
  { value: 'device_offline',   label: 'Dispositivo offline',      color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'device_online',    label: 'Dispositivo voltou online', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'signal_critical',  label: 'Sinal crítico (RX < -27)', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'signal_recovered', label: 'Sinal recuperado',          color: 'bg-blue-100 text-blue-700 border-blue-200' },
]

export default function EmailSettingsPage() {
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [testing, setTesting] = useState(false)

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
    const v = values['notifications.events.email']
    if (Array.isArray(v)) return v as string[]
    if (typeof v === 'string') { try { return JSON.parse(v) } catch { return [] } }
    return ['device_offline', 'signal_critical']
  }

  const toggleEvent = (evt: string) => {
    const list = getEventList()
    setValue('notifications.events.email', list.includes(evt) ? list.filter(e => e !== evt) : [...list, evt])
  }

  const testSmtp = async () => {
    setTesting(true)
    try {
      await settingsApi.updateMany(values)
      const res = await settingsApi.testSmtp()
      res.data?.ok
        ? toast.success('E-mail de teste enviado! Verifique sua caixa de entrada.')
        : toast.error(`Falha no teste SMTP: ${res.data?.error || 'erro desconhecido'}`)
    } catch (err: any) {
      toast.error(`Erro ao testar SMTP: ${err?.response?.data?.message || err?.message}`)
    } finally { setTesting(false) }
  }

  if (isLoading) return <LoadingScreen />

  const smtpFields = [
    { key: 'notifications.smtp.enabled',  label: 'Habilitar E-mail',          type: 'toggle',   hint: 'Envia alertas por e-mail via servidor SMTP' },
    { key: 'notifications.smtp.host',     label: 'Servidor SMTP',             type: 'text',     placeholder: 'smtp.gmail.com',                          hint: 'Ex: smtp.gmail.com, smtp.office365.com' },
    { key: 'notifications.smtp.port',     label: 'Porta SMTP',                type: 'number',   placeholder: '587',                                     hint: '587 (TLS/STARTTLS) · 465 (SSL) · 25 (sem criptografia)' },
    { key: 'notifications.smtp.secure',   label: 'Usar SSL/TLS (porta 465)',  type: 'toggle',   hint: 'Ative apenas se usar a porta 465. Para 587 (STARTTLS), deixe desativado.' },
    { key: 'notifications.smtp.user',     label: 'Usuário SMTP',              type: 'text',     placeholder: 'alertas@suaempresa.com',                  hint: 'Geralmente o próprio endereço de e-mail' },
    { key: 'notifications.smtp.pass',     label: 'Senha SMTP',                type: 'password', placeholder: '••••••••',                                hint: 'Para Gmail: use uma App Password, não a senha da conta' },
    { key: 'notifications.smtp.from',     label: 'Remetente',                 type: 'text',     placeholder: 'BR10ACS <alertas@suaempresa.com>',        hint: 'Endereço que aparecerá no campo "De" do e-mail' },
    { key: 'notifications.smtp.to',       label: 'Destinatário(s)',           type: 'text',     placeholder: 'noc@suaempresa.com, ti@suaempresa.com',   hint: 'Separe múltiplos destinatários com vírgula' },
  ]

  const eventList = getEventList()

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-500" />
            <CardTitle>Notificações — E-mail (SMTP)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {smtpFields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
              {field.type === 'toggle' ? (
                <button
                  onClick={() => setValue(field.key, !values[field.key])}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${values[field.key] ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${values[field.key] ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              ) : (
                <input
                  type={field.type}
                  value={(values[field.key] as string) || ''}
                  onChange={e => setValue(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              )}
              {field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}
            </div>
          ))}

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
            <button onClick={testSmtp} disabled={testing}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-medium text-sm rounded-lg transition-colors"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Testar E-mail SMTP
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
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
