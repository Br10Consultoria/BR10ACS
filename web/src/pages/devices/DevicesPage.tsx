import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, Filter, RefreshCw, Router, Clock, Wifi, WifiOff, Trash2 } from 'lucide-react'
import { devicesApi } from '@/api'
import { Card, Badge, LoadingScreen, Table, Th, Td } from '@/components/ui'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function DevicesPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [page, setPage] = useState(1)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const limit = 20
  const queryClient = useQueryClient()

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['devices', search, statusFilter, page],
    queryFn: () => devicesApi.list({
      search: search || undefined,
      online: statusFilter === 'all' ? undefined : statusFilter === 'online',
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
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    },
    onError: () => toast.error('Erro ao remover dispositivo'),
  })

  const devices: Record<string, unknown>[] = data?.data || data?.devices || data || []
  const total: number = data?.total || devices.length

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
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por serial, IP, modelo, fabricante..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as 'all' | 'online' | 'offline'); setPage(1) }}
              className="border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
            <button
              onClick={() => refetch()}
              className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </Card>

      {/* Tabela */}
      <Card>
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Router className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">
              {total} dispositivo{total !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Online</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Offline</span>
          </div>
        </div>

        {isLoading ? <div className="p-8"><LoadingScreen /></div> : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Status</Th>
                  <Th>Serial</Th>
                  <Th>Fabricante / Modelo</Th>
                  <Th>Firmware</Th>
                  <Th>IP</Th>
                  <Th>Hosts</Th>
                  <Th>Último Inform</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => {
                  const id = (d._id || d.id) as string
                  const serial = (d.serialNumber || id?.split('-').pop()) as string || '—'
                  const online = d.online as boolean
                  const lastInform = d.lastInform as string
                  const hosts = ((d.hosts as unknown[]) || []).length
                  return (
                    <tr key={id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                      <Td>
                        <div className="flex items-center gap-1.5">
                          {online
                            ? <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                            : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
                          <Badge variant={online ? 'green' : 'red'}>
                            {online ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                      </Td>
                      <Td>
                        <Link
                          to={`/devices/${encodeURIComponent(id)}`}
                          className="text-blue-600 hover:text-blue-700 font-mono text-xs font-medium"
                        >
                          {serial}
                        </Link>
                      </Td>
                      <Td>
                        <div>
                          <div className="text-xs font-medium text-slate-700">{(d.manufacturer as string) || '—'}</div>
                          <div className="text-xs text-slate-400">{(d.model as string) || '—'}</div>
                        </div>
                      </Td>
                      <Td className="font-mono text-xs text-slate-500">{(d.softwareVersion as string) || '—'}</Td>
                      <Td className="font-mono text-xs">{(d.ipv4 as string) || '—'}</Td>
                      <Td>
                        {hosts > 0 ? (
                          <Badge variant="blue">{hosts} host{hosts !== 1 ? 's' : ''}</Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
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
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(id) }}
                          title="Remover dispositivo"
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </Td>
                    </tr>
                  )
                })}
                {devices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">
                      Nenhum dispositivo encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>

            {/* Paginação */}
            {total > limit && (
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Página {page} de {Math.ceil(total / limit)}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={page >= Math.ceil(total / limit)}
                    onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                  >
                    Próxima
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
