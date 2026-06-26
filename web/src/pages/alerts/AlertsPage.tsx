import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { alertsApi } from '../../api'
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui'

type AlertType = 'device_offline' | 'device_online' | 'signal_critical' | 'signal_recovered'
type AlertSeverity = 'info' | 'warning' | 'critical'

interface Alert {
  _id: string
  deviceId: string
  deviceSerial?: string
  deviceModel?: string
  pppLogin?: string
  type: AlertType
  severity: AlertSeverity
  message: string
  metadata?: Record<string, unknown>
  acknowledged: boolean
  acknowledgedAt?: string
  notified: boolean
  createdAt: string
}

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  info: 'bg-green-100 text-green-700 border-green-200',
}

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  critical: 'bg-red-500 text-white',
  warning: 'bg-yellow-500 text-white',
  info: 'bg-green-500 text-white',
}

const TYPE_LABELS: Record<AlertType, string> = {
  device_offline: 'Dispositivo Offline',
  device_online: 'Dispositivo Online',
  signal_critical: 'Sinal Crítico',
  signal_recovered: 'Sinal Recuperado',
}

const TYPE_ICONS: Record<AlertType, string> = {
  device_offline: '🔴',
  device_online: '🟢',
  signal_critical: '🟡',
  signal_recovered: '🟢',
}

export default function AlertsPage() {
  const queryClient = useQueryClient()
  const [showAcknowledged, setShowAcknowledged] = useState(false)
  const [filterType, setFilterType] = useState<AlertType | ''>('')
  const [page, setPage] = useState(1)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['alerts', showAcknowledged, filterType, page],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 50 }
      if (!showAcknowledged) params.acknowledged = false
      if (filterType) params.type = filterType
      const res = await alertsApi.list(params)
      return res.data as { data: Alert[]; total: number; page: number; pages: number }
    },
    refetchInterval: 30000,
  })

  const { data: countData } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: async () => {
      const res = await alertsApi.countUnacknowledged()
      return res.data as { count: number }
    },
    refetchInterval: 30000,
  })

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => alertsApi.acknowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alerts-count'] })
    },
  })

  const acknowledgeAllMutation = useMutation({
    mutationFn: () => alertsApi.acknowledgeAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      queryClient.invalidateQueries({ queryKey: ['alerts-count'] })
    },
  })

  const alerts = data?.data ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1
  const unreadCount = countData?.count ?? 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Alertas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Notificações de dispositivos offline e sinal crítico
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {unreadCount} não lidos
            </span>
          )}
          <button
            onClick={() => acknowledgeAllMutation.mutate()}
            disabled={acknowledgeAllMutation.isPending || unreadCount === 0}
            className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Reconhecer todos
          </button>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-3 items-center">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showAcknowledged}
                onChange={e => { setShowAcknowledged(e.target.checked); setPage(1) }}
                className="rounded"
              />
              Mostrar reconhecidos
            </label>
            <select
              value={filterType}
              onChange={e => { setFilterType(e.target.value as AlertType | ''); setPage(1) }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white"
            >
              <option value="">Todos os tipos</option>
              <option value="device_offline">Dispositivo Offline</option>
              <option value="device_online">Dispositivo Online</option>
              <option value="signal_critical">Sinal Crítico</option>
              <option value="signal_recovered">Sinal Recuperado</option>
            </select>
            <span className="text-sm text-slate-500 ml-auto">
              {total} alerta{total !== 1 ? 's' : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lista de alertas */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Alertas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Carregando alertas...</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              {showAcknowledged ? 'Nenhum alerta encontrado.' : 'Nenhum alerta pendente.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {alerts.map(alert => (
                <div
                  key={alert._id}
                  className={`p-4 flex items-start gap-4 transition-colors ${
                    alert.acknowledged ? 'opacity-60 bg-slate-50' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Ícone */}
                  <span className="text-2xl mt-0.5 flex-shrink-0">
                    {TYPE_ICONS[alert.type]}
                  </span>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_BADGE[alert.severity]}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {TYPE_LABELS[alert.type]}
                      </span>
                      {alert.notified && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          Notificado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 mt-1">{alert.message}</p>
                    <div className="flex flex-wrap gap-4 mt-1 text-xs text-slate-400">
                      {alert.deviceSerial && (
                        <span>Serial: <span className="text-slate-600 font-mono">{alert.deviceSerial}</span></span>
                      )}
                      {alert.pppLogin && (
                        <span>PPPoE: <span className="text-slate-600 font-mono">{alert.pppLogin}</span></span>
                      )}
                      {alert.deviceModel && (
                        <span>Modelo: <span className="text-slate-600">{alert.deviceModel}</span></span>
                      )}
                      <span>
                        {new Date(alert.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Bahia' })}
                      </span>
                    </div>
                  </div>

                  {/* Ação */}
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeMutation.mutate(alert._id)}
                      disabled={acknowledgeMutation.isPending}
                      className="flex-shrink-0 text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                    >
                      Reconhecer
                    </button>
                  )}
                  {alert.acknowledged && (
                    <span className="flex-shrink-0 text-xs text-slate-400 italic">
                      Reconhecido
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginação */}
      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
          >
            Anterior
          </button>
          <span className="px-3 py-1.5 text-sm text-slate-600">
            {page} / {pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
