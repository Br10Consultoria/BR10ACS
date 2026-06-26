import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Activity, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'
import { massOpsApi } from '@/api'
import { Card, Badge, LoadingScreen, Table, Th, Td } from '@/components/ui'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'

const statusVariant: Record<string, 'blue' | 'green' | 'red' | 'yellow' | 'gray'> = {
  pending: 'yellow',
  running: 'blue',
  completed: 'green',
  failed: 'red',
  cancelled: 'gray',
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  running: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
  completed: <CheckCircle className="w-3.5 h-3.5" />,
  failed: <XCircle className="w-3.5 h-3.5" />,
}

export default function MassOpsPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [opType, setOpType] = useState('reboot')
  const [filter, setFilter] = useState('')

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['mass-ops'],
    queryFn: () => massOpsApi.list().then(r => r.data),
    refetchInterval: 10000,
  })

  const ops: Record<string, unknown>[] = data?.massOps || data || []

  const createMutation = useMutation({
    mutationFn: () => massOpsApi.create({
      type: opType,
      filter: filter ? { search: filter } : {},
      name: `${opType} — ${new Date().toLocaleString('pt-BR')}`,
    }),
    onSuccess: () => {
      toast.success('Operação em massa criada')
      qc.invalidateQueries({ queryKey: ['mass-ops'] })
      setShowModal(false)
    },
    onError: () => toast.error('Erro ao criar operação'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => massOpsApi.cancel(id),
    onSuccess: () => {
      toast.success('Operação cancelada')
      qc.invalidateQueries({ queryKey: ['mass-ops'] })
    },
  })

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Activity className="w-4 h-4" />
          <span>Gerencie operações em lote nos dispositivos</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Operação
          </button>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8"><LoadingScreen /></div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Operação</Th>
                <Th>Tipo</Th>
                <Th>Status</Th>
                <Th>Progresso</Th>
                <Th>Criado</Th>
                <Th>Ações</Th>
              </tr>
            </thead>
            <tbody>
              {ops.map((op) => {
                const id = (op._id || op.id) as string
                const status = (op.status as string) || 'pending'
                const total = (op.totalDevices as number) || 0
                const done = (op.processedDevices as number) || 0
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                return (
                  <tr key={id} className="hover:bg-slate-50 transition-colors">
                    <Td className="font-medium text-slate-700">{(op.name as string) || id.slice(-8)}</Td>
                    <Td><Badge variant="blue">{(op.type as string) || '—'}</Badge></Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        {statusIcons[status]}
                        <Badge variant={statusVariant[status] || 'gray'}>{status}</Badge>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{done}/{total}</span>
                      </div>
                    </Td>
                    <Td className="text-xs text-slate-500">
                      {op.createdAt ? formatDistanceToNow(new Date(op.createdAt as string), { addSuffix: true, locale: ptBR }) : '—'}
                    </Td>
                    <Td>
                      {(status === 'pending' || status === 'running') && (
                        <button
                          onClick={() => cancelMutation.mutate(id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Cancelar
                        </button>
                      )}
                    </Td>
                  </tr>
                )
              })}
              {ops.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">
                    Nenhuma operação encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Nova Operação em Massa</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de operação</label>
                <select
                  value={opType}
                  onChange={(e) => setOpType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="reboot">Reboot</option>
                  <option value="factory_reset">Factory Reset</option>
                  <option value="connection_request">Connection Request</option>
                  <option value="refresh_params">Atualizar Parâmetros</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Filtro de dispositivos <span className="text-slate-400 font-normal">(deixe em branco para todos)</span>
                </label>
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Ex: Intelbras, 1200R, 192.168..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <strong>Atenção:</strong> Esta operação será executada em todos os dispositivos que correspondem ao filtro. Confirme antes de prosseguir.
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? 'Criando...' : 'Criar Operação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
