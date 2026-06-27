import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, Filter, RefreshCw, Router, Clock, Wifi, WifiOff, Trash2,
  ChevronLeft, ChevronRight, X, SlidersHorizontal, FileSpreadsheet, FileText,
} from 'lucide-react'
import { devicesApi, exportApi } from '@/api'
import { Card, CardContent, Badge, LoadingScreen, Table, Th, Td } from '@/components/ui'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'

const KNOWN_MANUFACTURERS = [
  'INTELBRAS', 'HUAWEI', 'ZTE', 'NOKIA', 'FIBERHOME', 'VSOL', 'TP-LINK', 'DATACOM', 'PARKS',
]

export default function DevicesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [manufacturerFilter, setManufacturerFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const [firmwareFilter, setFirmwareFilter] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [page, setPage] = useState(1)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const limit = 20

  const hasAdvancedFilters = !!(manufacturerFilter || modelFilter || firmwareFilter)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['devices', search, statusFilter, manufacturerFilter, modelFilter, firmwareFilter, page],
    queryFn: () => devicesApi.list({
      search: search || undefined,
      online: statusFilter === 'all' ? undefined : statusFilter === 'online',
      manufacturer: manufacturerFilter || undefined,
      model: modelFilter || undefined,
      page,
      limit,
    }).then(r => r.data),
    refetchInterval: 30000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => devicesApi.delete(id),
    onSuccess: () => {
      toast.success('Dispositivo removido do ACS')
      setConfirmDelete(null)
      qc.invalidateQueries({ queryKey: ['devices'] })
    },
    onError: () => toast.error('Erro ao remover dispositivo'),
  })

  const devices: Record<string, unknown>[] = data?.data || data?.devices || data || []
  const total: number = data?.total || devices.length
  const totalPages = Math.ceil(total / limit)

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setManufacturerFilter('')
    setModelFilter('')
    setFirmwareFilter('')
    setPage(1)
  }

  const activeFilterCount = [
    search,
    statusFilter !== 'all' ? statusFilter : '',
    manufacturerFilter,
    modelFilter,
    firmwareFilter,
  ].filter(Boolean).length

  return (
    <div className="space-y-5">
      {/* Modal de confirmação de exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Remover dispositivo?</h3>
                <p className="text-xs text-slate-500 font-mono">{confirmDelete}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              O dispositivo será removido do GenieACS. Ele voltará a aparecer se conectar novamente ao ACS.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por serial, IP, PPPoE..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as 'all' | 'online' | 'offline'); setPage(1) }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos os status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
                hasAdvancedFilters
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros avançados
              {hasAdvancedFilters && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {[manufacturerFilter, modelFilter, firmwareFilter].filter(Boolean).length}
                </span>
              )}
            </button>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Limpar ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Filtros avançados */}
          {showAdvanced && (
            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-medium">Fabricante</label>
                <select
                  value={manufacturerFilter}
                  onChange={(e) => { setManufacturerFilter(e.target.value); setPage(1) }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos os fabricantes</option>
                  {KNOWN_MANUFACTURERS.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-medium">Modelo</label>
                <input
                  type="text"
                  placeholder="Ex: 1200R, HG8145V5..."
                  value={modelFilter}
                  onChange={(e) => { setModelFilter(e.target.value); setPage(1) }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 font-medium">Firmware / Versão</label>
                <input
                  type="text"
                  placeholder="Ex: 2.2-250203..."
                  value={firmwareFilter}
                  onChange={(e) => { setFirmwareFilter(e.target.value); setPage(1) }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Router className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">
              {isLoading ? 'Carregando...' : `${total} dispositivo${total !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && !isLoading && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Atualizando...
              </span>
            )}
            <button
              onClick={() => exportApi.downloadExcel({
                ...(manufacturerFilter ? { manufacturer: manufacturerFilter } : {}),
                ...(modelFilter ? { model: modelFilter } : {}),
                ...(statusFilter !== 'all' ? { online: String(statusFilter === 'online') } : {}),
              })}
              title="Exportar Excel"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              onClick={() => exportApi.downloadPdf({
                ...(manufacturerFilter ? { manufacturer: manufacturerFilter } : {}),
                ...(modelFilter ? { model: modelFilter } : {}),
                ...(statusFilter !== 'all' ? { online: String(statusFilter === 'online') } : {}),
              })}
              title="Exportar PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>

        {isLoading ? (
          <CardContent><LoadingScreen /></CardContent>
        ) : devices.length === 0 ? (
          <CardContent>
            <div className="text-center py-12 text-slate-400">
              <Router className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>Nenhum dispositivo encontrado</p>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="mt-2 text-xs text-blue-500 hover:text-blue-700">
                  Limpar filtros
                </button>
              )}
            </div>
          </CardContent>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Status</Th>
                  <Th>Serial</Th>
                  <Th>Fabricante / Modelo</Th>
                  <Th>Firmware</Th>
                  <Th>PPPoE / IP</Th>
                  <Th>Hosts</Th>
                  <Th>Último Inform</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d: Record<string, unknown>) => {
                  const id = (d._id as string) || (d.id as string)
                  const serial = (d.serialNumber as string) || id?.split('-').pop() || '—'
                  const online = d.online as boolean
                  const lastInform = d.lastInform as string
                  const manufacturer = (d.manufacturer as string) || '—'
                  const model = (d.model as string) || '—'
                  const firmware = (d.softwareVersion as string) || ''
                  const pppLogin = (d.pppLogin as string) || ''
                  const ipv4 = (d.ipv4 as string) || ''
                  const hosts = ((d.hosts as unknown[]) || []).length

                  return (
                    <tr key={id} className="hover:bg-slate-50 transition-colors">
                      <Td>
                        <div className="flex items-center gap-1.5">
                          {online
                            ? <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                            : <WifiOff className="w-3.5 h-3.5 text-red-400" />
                          }
                          <Badge variant={online ? 'green' : 'red'}>
                            {online ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                      </Td>
                      <Td>
                        <Link to={`/devices/${id}`} className="text-blue-600 hover:text-blue-700 font-mono text-xs font-medium">
                          {serial}
                        </Link>
                      </Td>
                      <Td>
                        <div>
                          <div className="text-xs font-medium text-slate-700">{manufacturer}</div>
                          <div className="text-xs text-slate-400">{model}</div>
                        </div>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs text-slate-500">
                          {firmware || <span className="text-slate-300">—</span>}
                        </span>
                      </Td>
                      <Td>
                        <div className="text-xs">
                          {pppLogin && <div className="text-slate-700 font-medium">{pppLogin}</div>}
                          {ipv4 && <div className="font-mono text-slate-400">{ipv4}</div>}
                          {!pppLogin && !ipv4 && <span className="text-slate-300">—</span>}
                        </div>
                      </Td>
                      <Td>
                        {hosts > 0
                          ? <Badge variant="blue">{hosts}</Badge>
                          : <span className="text-slate-300 text-xs">—</span>
                        }
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">
                            {lastInform
                              ? formatDistanceToNow(new Date(lastInform), { addSuffix: true, locale: ptBR })
                              : '—'}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <button
                          onClick={() => setConfirmDelete(id)}
                          className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-xs text-slate-500">
                  Página {page} de {totalPages} — {total} dispositivos
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-medium text-slate-700 px-2">{page}</span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
