import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { licenseApi } from '../api'
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Clock,
  RefreshCw,
  Key,
  User,
  Mail,
  Package,
  Monitor,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'

type LicenseStatus = 'active' | 'expired' | 'invalid' | 'trial' | 'pending'

interface LicenseInfo {
  status: LicenseStatus
  key: string
  holderName: string
  holderEmail: string
  plan: string
  expiresAt: string | null
  daysRemaining: number | null
  maxDevices: number
  lastCheckedAt: string | null
  instanceId: string
  message: string
}

function StatusBadge({ status }: { status: LicenseStatus }) {
  const map: Record<LicenseStatus, { icon: React.ElementType; label: string; cls: string }> = {
    active:  { icon: ShieldCheck,  label: 'Ativa',      cls: 'bg-green-100 text-green-800 border-green-200' },
    expired: { icon: ShieldAlert,  label: 'Expirada',   cls: 'bg-red-100 text-red-800 border-red-200' },
    invalid: { icon: ShieldOff,    label: 'Inválida',   cls: 'bg-red-100 text-red-800 border-red-200' },
    trial:   { icon: Clock,        label: 'Trial',      cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    pending: { icon: Clock,        label: 'Pendente',   cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  }
  const { icon: Icon, label, cls } = map[status] ?? map.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${cls}`}>
      <Icon className="w-4 h-4" />
      {label}
    </span>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <span className="text-sm text-gray-500 w-40 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800 font-mono">{value}</span>
    </div>
  )
}

export default function LicensePage() {
  const qc = useQueryClient()
  const [activationKey, setActivationKey] = useState('')
  const [showActivation, setShowActivation] = useState(false)

  const { data: license, isLoading } = useQuery<LicenseInfo>({
    queryKey: ['license'],
    queryFn: () => licenseApi.getInfo(),
    refetchOnWindowFocus: false,
    refetchInterval: 60000,
  })

  const activateMutation = useMutation({
    mutationFn: (key: string) => licenseApi.activate(key),
    onSuccess: (data: LicenseInfo) => {
      qc.setQueryData(['license'], data)
      toast.success('Licença ativada com sucesso!')
      setActivationKey('')
      setShowActivation(false)
    },
    onError: (err: Error) => {
      toast.error(`Erro ao ativar licença: ${err.message}`)
    },
  })

  const refreshMutation = useMutation({
    mutationFn: () => licenseApi.refresh(),
    onSuccess: (data: LicenseInfo) => {
      qc.setQueryData(['license'], data)
      toast.success('Licença atualizada!')
    },
    onError: (err: Error) => {
      toast.error(`Erro ao atualizar licença: ${err.message}`)
    },
  })

  const removeMutation = useMutation({
    mutationFn: () => licenseApi.remove(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['license'] })
      toast.success('Licença removida.')
    },
  })

  const formatDate = (iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  }

  const isExpiringSoon = license?.daysRemaining !== null && (license?.daysRemaining ?? 99) <= 7
  const isProblematic = license?.status === 'expired' || license?.status === 'invalid'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Licença do Sistema</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie a chave de licença do BR10 ACS.
          </p>
        </div>
        <ShieldCheck className="w-8 h-8 text-blue-500" />
      </div>

      {/* Status Banner */}
      {isProblematic && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-800">
            <strong>Atenção:</strong> {license?.message}
          </div>
        </div>
      )}
      {isExpiringSoon && !isProblematic && (
        <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-800">
            <strong>Atenção:</strong> {license?.message}
          </div>
        </div>
      )}

      {/* License Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Status da Licença</h2>
          {license && <StatusBadge status={license.status} />}
        </div>

        {license && (
          <div className="space-y-0">
            <InfoRow icon={Key}     label="Chave"           value={license.key || '—'} />
            <InfoRow icon={User}    label="Titular"         value={license.holderName} />
            <InfoRow icon={Mail}    label="E-mail"          value={license.holderEmail} />
            <InfoRow icon={Package} label="Plano"           value={license.plan} />
            <InfoRow icon={Monitor} label="Máx. dispositivos" value={license.maxDevices > 0 ? String(license.maxDevices) : 'Ilimitado'} />
            <InfoRow icon={Clock}   label="Expira em"       value={formatDate(license.expiresAt)} />
            <InfoRow icon={Clock}   label="Última verificação" value={formatDate(license.lastCheckedAt)} />
            <InfoRow icon={Monitor} label="ID da instalação" value={license.instanceId} />
          </div>
        )}

        {license?.daysRemaining !== null && license?.daysRemaining !== undefined && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Validade</span>
              <span>{license.daysRemaining} dia(s) restantes</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  license.daysRemaining <= 7
                    ? 'bg-red-500'
                    : license.daysRemaining <= 14
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, (license.daysRemaining / 30) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {license?.message && (
          <p className="text-sm text-gray-500 italic">{license.message}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          Verificar Licença
        </button>

        <button
          onClick={() => setShowActivation((v) => !v)}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          <Key className="w-4 h-4" />
          {showActivation ? 'Cancelar' : 'Ativar Nova Chave'}
        </button>

        {license?.key && (
          <button
            onClick={() => {
              if (confirm('Tem certeza que deseja remover a licença?')) {
                removeMutation.mutate()
              }
            }}
            disabled={removeMutation.isPending}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Remover Licença
          </button>
        )}
      </div>

      {/* Activation Form */}
      {showActivation && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Ativar Chave de Licença</h2>
          <p className="text-sm text-gray-500">
            Insira a chave de licença fornecida pela BR10 Consultoria. A chave será validada
            automaticamente no servidor de licenças.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={activationKey}
              onChange={(e) => setActivationKey(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && activationKey.trim()) {
                  activateMutation.mutate(activationKey.trim())
                }
              }}
            />
            <button
              onClick={() => activateMutation.mutate(activationKey.trim())}
              disabled={!activationKey.trim() || activateMutation.isPending}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {activateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Ativar
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Como obter uma licença:</strong> Entre em contato com a BR10 Consultoria para
          adquirir ou renovar sua licença. A licença é válida por 30 dias e renovável mensalmente.
          Após a expiração, o sistema continuará funcionando em modo trial (máx. 10 dispositivos).
        </p>
      </div>
    </div>
  )
}
