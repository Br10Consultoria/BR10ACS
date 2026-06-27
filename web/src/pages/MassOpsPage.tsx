import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Activity, CheckCircle, XCircle, Clock, RefreshCw, Upload, X } from 'lucide-react'
import { massOpsApi, filesApi } from '@/api'
import { Card, CardContent, Badge, LoadingScreen, Table, Th, Td } from '@/components/ui'
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

const OP_TYPES = [
  { value: 'reboot', label: 'Reboot' },
  { value: 'factory_reset', label: 'Factory Reset' },
  { value: 'connection_request', label: 'Connection Request' },
  { value: 'refresh_params', label: 'Atualizar Parâmetros' },
  { value: 'firmware_update', label: 'Atualização de Firmware' },
  { value: 'set_parameter', label: 'Definir Parâmetro TR-069' },
]

export default function MassOpsPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [opType, setOpType] = useState('reboot')
  const [manufacturerFilter, setManufacturerFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  // Firmware update
  const [firmwareFile, setFirmwareFile] = useState('')
  const [firmwareFileType, setFirmwareFileType] = useState('1 Firmware Upgrade Image')
  // Set parameter
  const [paramName, setParamName] = useState('')
  const [paramValue, setParamValue] = useState('')

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['mass-ops'],
    queryFn: () => massOpsApi.list().then(r => r.data),
    refetchInterval: 10000,
  })

  const { data: filesData } = useQuery({
    queryKey: ['files'],
    queryFn: () => filesApi.listFiles().then(r => r.data),
    enabled: showModal && opType === 'firmware_update',
  })

  const ops: Record<string, unknown>[] = data?.massOps || data || []
  const availableFiles: Record<string, unknown>[] = filesData?.files || filesData || []
  const firmwareFiles = availableFiles.filter(f => {
    const ft = (f.metadata as Record<string, unknown>)?.fileType as string || ''
    return ft.includes('1 Firmware') || ft === ''
  })

  const buildPayload = () => {
    const filters: Record<string, unknown> = {}
    if (manufacturerFilter) filters.manufacturer = manufacturerFilter
    if (modelFilter) filters.model = modelFilter

    const body: Record<string, unknown> = {
      type: opType,
      filters,
      name: `${OP_TYPES.find(o => o.value === opType)?.label || opType} — ${new Date().toLocaleString('pt-BR')}`,
    }

    if (opType === 'firmware_update') {
      body.payload = { fileName: firmwareFile, fileType: firmwareFileType }
    }
    if (opType === 'set_parameter') {
      body.payload = { name: paramName, value: paramValue }
    }

    return body
  }

  const createMutation = useMutation({
    mutationFn: () => massOpsApi.create(buildPayload()),
    onSuccess: () => {
      toast.success('Operação em massa criada')
      qc.invalidateQueries({ queryKey: ['mass-ops'] })
      setShowModal(false)
      resetModal()
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

  const resetModal = () => {
    setOpType('reboot')
    setManufacturerFilter('')
    setModelFilter('')
    setFirmwareFile('')
    setParamName('')
    setParamValue('')
  }

  const canSubmit = () => {
    if (opType === 'firmware_update' && !firmwareFile) return false
    if (opType === 'set_parameter' && (!paramName || !paramValue)) return false
    return true
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Operações em Massa</h2>
          <p className="text-xs text-slate-500 mt-0.5">Reboot, firmware, parâmetros e mais — em múltiplos dispositivos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Operação
          </button>
        </div>
      </div>

      {/* Tabela de operações */}
      <Card>
        {isLoading ? (
          <CardContent><LoadingScreen /></CardContent>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>Status</Th>
                <Th>Progresso</Th>
                <Th>Criado</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {ops.map((op) => {
                const id = (op._id as string) || (op.id as string)
                const status = (op.status as string) || 'pending'
                const done = (op.devicesProcessed as number) || 0
                const total = (op.devicesTotal as number) || 0
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                return (
                  <tr key={id} className="hover:bg-slate-50 transition-colors">
                    <Td className="font-medium text-slate-700">{(op.name as string) || id.slice(-8)}</Td>
                    <Td>
                      <Badge variant="blue">
                        {OP_TYPES.find(o => o.value === (op.type as string))?.label || (op.type as string) || '—'}
                      </Badge>
                    </Td>
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
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    Nenhuma operação encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Modal de criação */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Nova Operação em Massa</h3>
              <button onClick={() => { setShowModal(false); resetModal() }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de operação</label>
                <select
                  value={opType}
                  onChange={(e) => setOpType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {OP_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Campos específicos por tipo */}
              {opType === 'firmware_update' && (
                <div className="space-y-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
                    <Upload className="w-4 h-4" />
                    Configuração de Firmware
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">Arquivo de firmware</label>
                    <select
                      value={firmwareFile}
                      onChange={(e) => setFirmwareFile(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Selecione um arquivo...</option>
                      {firmwareFiles.map(f => (
                        <option key={f._id as string} value={f._id as string}>{f._id as string}</option>
                      ))}
                    </select>
                    {firmwareFiles.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">Nenhum firmware disponível. Faça upload em Arquivos primeiro.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">Tipo de arquivo TR-069</label>
                    <select
                      value={firmwareFileType}
                      onChange={(e) => setFirmwareFileType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="1 Firmware Upgrade Image">1 Firmware Upgrade Image</option>
                      <option value="3 Vendor Configuration File">3 Vendor Configuration File</option>
                    </select>
                  </div>
                </div>
              )}

              {opType === 'set_parameter' && (
                <div className="space-y-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <div className="text-purple-700 text-sm font-medium">Parâmetro TR-069</div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">Nome do parâmetro</label>
                    <input
                      type="text"
                      value={paramName}
                      onChange={(e) => setParamName(e.target.value)}
                      placeholder="Ex: InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1 font-medium">Valor</label>
                    <input
                      type="text"
                      value={paramValue}
                      onChange={(e) => setParamValue(e.target.value)}
                      placeholder="Novo valor"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Filtros de dispositivos */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Filtros de dispositivos
                  <span className="text-slate-400 font-normal text-xs ml-1">(deixe em branco para todos)</span>
                </label>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={manufacturerFilter}
                      onChange={(e) => setManufacturerFilter(e.target.value)}
                      placeholder="Fabricante (ex: INTELBRAS)"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={modelFilter}
                      onChange={(e) => setModelFilter(e.target.value)}
                      placeholder="Modelo (ex: 1200R)"
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <strong>Atenção:</strong> Esta operação será executada em todos os dispositivos que correspondem aos filtros. Confirme antes de prosseguir.
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); resetModal() }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !canSubmit()}
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
