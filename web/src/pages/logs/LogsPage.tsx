import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, RefreshCw, FileText, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { logsApi } from '@/api'
import { Card, Badge, LoadingScreen } from '@/components/ui'
import { format } from 'date-fns'

const levelColors: Record<string, 'green' | 'red' | 'yellow' | 'blue' | 'gray'> = {
  info: 'blue',
  warn: 'yellow',
  error: 'red',
  debug: 'gray',
}

const levelIcons: Record<string, React.JSX.Element> = {
  info: <Info className="w-3.5 h-3.5" />,
  warn: <AlertTriangle className="w-3.5 h-3.5" />,
  error: <AlertCircle className="w-3.5 h-3.5" />,
  debug: <FileText className="w-3.5 h-3.5" />,
}

export default function LogsPage() {
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('all')
  const [category, setCategory] = useState('all')

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['logs', search, level, category],
    queryFn: () => logsApi.list({
      search: search || undefined,
      level: level !== 'all' ? level : undefined,
      category: category !== 'all' ? category : undefined,
      limit: 100,
    }).then(r => r.data),
    refetchInterval: 15000,
  })

  const logs: Record<string, unknown>[] = data?.logs || data || []

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar nos logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos os níveis</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas as categorias</option>
            <option value="auth">Auth</option>
            <option value="device">Dispositivo</option>
            <option value="cwmp">CWMP</option>
            <option value="system">Sistema</option>
          </select>
          <button
            onClick={() => refetch()}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Card>

      {/* Logs */}
      <Card>
        <div className="px-5 py-3 border-b border-slate-100">
          <span className="text-sm font-medium text-slate-600">{logs.length} entradas</span>
        </div>
        {isLoading ? (
          <div className="p-8"><LoadingScreen /></div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {logs.map((log, i) => {
              const lvl = (log.level as string) || 'info'
              return (
                <div key={i} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-slate-400">{levelIcons[lvl] || levelIcons.info}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={levelColors[lvl] || 'gray'}>{lvl.toUpperCase()}</Badge>
                        {!!log.category && <Badge variant="gray">{log.category as string}</Badge>}
                        {!!log.deviceId && (
                          <span className="text-xs font-mono text-slate-400 truncate">
                            {(log.deviceId as string).split('-').pop()}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 ml-auto">
                          {log.createdAt ? format(new Date(log.createdAt as string), 'dd/MM HH:mm:ss') : '—'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 mt-1">{(log.message as string) || '—'}</p>
                      {!!log.details && (
                        <pre className="text-xs text-slate-500 mt-1 bg-slate-50 rounded p-2 overflow-x-auto">
                          {String(typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2))}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {logs.length === 0 && (
              <div className="px-5 py-12 text-center text-slate-400 text-sm">
                Nenhum log encontrado
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
