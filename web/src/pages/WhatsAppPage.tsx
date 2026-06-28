import { useState, useEffect } from 'react'
import { whatsappApi } from '../api'

// ── Ícones inline ──────────────────────────────────────────────────────────────
const IconWhatsApp = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
)

const IconCheck = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
  </svg>
)

const IconInfo = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
  </svg>
)

// ── Tipos ──────────────────────────────────────────────────────────────────────
interface WaConfig {
  enabled: boolean
  phoneNumberId: string
  verifyToken: string
  welcomeMessage: string
  businessName: string
  hasAccessToken: boolean
  // campos de edição (não vêm da API)
  accessToken?: string
}

interface WaStats {
  totalSessions: number
  activeSessions: number
}

interface WaInfo {
  configured: boolean
  phoneNumber?: {
    id: string
    display_phone_number?: string
    verified_name?: string
    quality_rating?: string
  }
  error?: string
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const [config, setConfig] = useState<WaConfig>({
    enabled: false,
    phoneNumberId: '',
    verifyToken: '',
    welcomeMessage: '',
    businessName: '',
    hasAccessToken: false,
    accessToken: '',
  })
  const [stats, setStats] = useState<WaStats | null>(null)
  const [info, setInfo] = useState<WaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [infoLoading, setInfoLoading] = useState(false)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [cfg, st] = await Promise.all([
        whatsappApi.getConfig(),
        whatsappApi.getStats().catch(() => null),
      ])
      setConfig({ ...cfg, accessToken: '' })
      setStats(st)
    } catch (e) {
      showToast('error', 'Erro ao carregar configurações do WhatsApp.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        enabled: config.enabled,
        phoneNumberId: config.phoneNumberId,
        verifyToken: config.verifyToken,
        welcomeMessage: config.welcomeMessage,
        businessName: config.businessName,
      }
      // Só envia o accessToken se o usuário preencheu
      if (config.accessToken && config.accessToken.trim()) {
        payload.accessToken = config.accessToken.trim()
      }
      await whatsappApi.saveConfig(payload)
      showToast('success', 'Configurações salvas com sucesso!')
      setConfig(c => ({ ...c, accessToken: '', hasAccessToken: true }))
    } catch (e) {
      showToast('error', 'Erro ao salvar configurações.')
    } finally {
      setSaving(false)
    }
  }

  const handleCheckInfo = async () => {
    setInfoLoading(true)
    try {
      const result = await whatsappApi.getInfo()
      setInfo(result)
      if (result.configured) {
        showToast('success', 'Conexão com a Meta verificada com sucesso!')
      } else {
        showToast('error', result.error || 'Não foi possível verificar a conexão.')
      }
    } catch (e) {
      showToast('error', 'Erro ao verificar conexão com a Meta.')
    } finally {
      setInfoLoading(false)
    }
  }

  const handleTestMessage = async () => {
    if (!testPhone.trim()) {
      showToast('error', 'Informe o número de telefone para o teste.')
      return
    }
    setTestLoading(true)
    try {
      await whatsappApi.sendTestMessage(testPhone.trim(), testMsg || undefined)
      showToast('success', `Mensagem de teste enviada para ${testPhone}!`)
    } catch (e) {
      showToast('error', 'Erro ao enviar mensagem de teste. Verifique as configurações.')
    } finally {
      setTestLoading(false)
    }
  }

  const generateVerifyToken = () => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    setConfig(c => ({ ...c, verifyToken: token }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all
          ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <IconCheck /> : <IconInfo />}
          {toast.text}
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400">
          <IconWhatsApp />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">WhatsApp Business</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Atendente digital via WhatsApp Cloud API (Meta)
          </p>
        </div>
        <div className="ml-auto">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {config.enabled ? 'Ativo' : 'Inativo'}
            </span>
            <div
              onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer
                ${config.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                ${config.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </label>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total de Sessões</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalSessions}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sessões Ativas</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.activeSessions}</p>
          </div>
        </div>
      )}

      {/* Informações da Meta */}
      {info && (
        <div className={`rounded-xl border p-4 ${info.configured
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`font-semibold text-sm ${info.configured ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {info.configured ? '✅ Conectado à Meta' : '❌ Não conectado'}
            </span>
          </div>
          {info.phoneNumber && (
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {info.phoneNumber.display_phone_number && (
                <p>📱 Número: <strong>{info.phoneNumber.display_phone_number}</strong></p>
              )}
              {info.phoneNumber.verified_name && (
                <p>🏢 Nome verificado: <strong>{info.phoneNumber.verified_name}</strong></p>
              )}
              {info.phoneNumber.quality_rating && (
                <p>⭐ Qualidade: <strong>{info.phoneNumber.quality_rating}</strong></p>
              )}
            </div>
          )}
          {info.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{info.error}</p>
          )}
        </div>
      )}

      {/* Configurações principais */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900 dark:text-white">Credenciais da API</h2>

        {/* Guia rápido */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-semibold flex items-center gap-1"><IconInfo /> Como obter as credenciais:</p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>Acesse <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="underline">developers.facebook.com</a> e crie um App do tipo "Business"</li>
            <li>Adicione o produto "WhatsApp" ao seu App</li>
            <li>Em <strong>WhatsApp → Configuração da API</strong>, copie o <strong>Phone Number ID</strong> e o <strong>Access Token</strong></li>
            <li>Configure o webhook com a URL: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">https://seu-dominio.com/api/v1/whatsapp/webhook</code></li>
            <li>Use o <strong>Verify Token</strong> gerado abaixo no campo de verificação do webhook</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={config.phoneNumberId}
              onChange={e => setConfig(c => ({ ...c, phoneNumberId: e.target.value }))}
              placeholder="Ex: 123456789012345"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1">Encontrado em: Meta for Developers → WhatsApp → Configuração da API</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Access Token (Permanent Token) <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={config.accessToken || ''}
              onChange={e => setConfig(c => ({ ...c, accessToken: e.target.value }))}
              placeholder={config.hasAccessToken ? '••••••••••••••••••••••••••••••••' : 'Cole o token aqui'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {config.hasAccessToken && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">✅ Token configurado. Deixe em branco para manter o atual.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Verify Token (para o webhook) <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={config.verifyToken}
                onChange={e => setConfig(c => ({ ...c, verifyToken: e.target.value }))}
                placeholder="Token de verificação do webhook"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={generateVerifyToken}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors"
              >
                Gerar
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Use este token no campo "Verify Token" ao configurar o webhook na Meta</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nome da Empresa (exibido nas mensagens)
            </label>
            <input
              type="text"
              value={config.businessName}
              onChange={e => setConfig(c => ({ ...c, businessName: e.target.value }))}
              placeholder="Ex: Provedor Internet XYZ"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <IconCheck />
            )}
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>

          <button
            onClick={handleCheckInfo}
            disabled={infoLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {infoLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <IconInfo />
            )}
            {infoLoading ? 'Verificando...' : 'Verificar Conexão'}
          </button>
        </div>
      </div>

      {/* Configuração do Webhook */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Configuração do Webhook</h2>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3">
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">URL do Webhook:</p>
              <code className="block bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-xs break-all">
                https://seu-dominio.com/api/v1/whatsapp/webhook
              </code>
            </div>
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Campos de assinatura obrigatórios:</p>
              <code className="block bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-xs">messages</code>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Configure esses valores em: <strong>Meta for Developers → Seu App → WhatsApp → Configuração → Webhook</strong>
          </p>
        </div>
      </div>

      {/* Funcionalidades do Bot */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Funcionalidades do Atendente Digital</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: '📶', title: 'Trocar senha WiFi', desc: 'Altera senha de redes 2.4GHz e 5GHz via TR-069' },
            { icon: '🔑', title: 'Trocar senha PPPoE', desc: 'Atualiza credenciais PPPoE diretamente na ONT' },
            { icon: '📡', title: 'Status da conexão', desc: 'Exibe sinal óptico, IP WAN e uptime' },
            { icon: '🔄', title: 'Reboot remoto', desc: 'Reinicia a ONT com confirmação do cliente' },
            { icon: '📋', title: 'Dados do contrato', desc: 'Consulta plano, vencimento e status no IXC' },
            { icon: '🔐', title: 'Identificação segura', desc: 'Verifica login PPPoE ou CPF antes de qualquer ação' },
          ].map(f => (
            <div key={f.title} className="flex gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <span className="text-xl">{f.icon}</span>
              <div>
                <p className="font-medium text-sm text-gray-800 dark:text-gray-200">{f.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Teste de mensagem */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white">Enviar Mensagem de Teste</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Envia uma mensagem simples para validar se as credenciais estão corretas.
        </p>
        <div className="flex gap-2">
          <input
            type="tel"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            placeholder="55119XXXXXXXX (com código do país)"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={handleTestMessage}
            disabled={testLoading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {testLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
            ) : (
              <IconWhatsApp />
            )}
            {testLoading ? 'Enviando...' : 'Enviar Teste'}
          </button>
        </div>
        <input
          type="text"
          value={testMsg}
          onChange={e => setTestMsg(e.target.value)}
          placeholder="Mensagem personalizada (opcional)"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
    </div>
  )
}
