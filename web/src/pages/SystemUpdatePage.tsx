import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { systemApi } from '../api'
import {
  RefreshCw,
  GitBranch,
  CheckCircle,
  XCircle,
  Clock,
  Terminal,
  AlertTriangle,
  Download,
} from 'lucide-react'

interface LogLine {
  type: 'info' | 'success' | 'error' | 'warn' | 'done'
  message: string
  ts: string
}

export default function SystemUpdatePage() {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [updating, setUpdating] = useState(false)
  const [updateDone, setUpdateDone] = useState<'success' | 'error' | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  const { data: version, refetch: refetchVersion } = useQuery({
    queryKey: ['system-version'],
    queryFn: () => systemApi.getVersion(),
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  const startUpdate = () => {
    if (updating) return
    setLogs([])
    setUpdateDone(null)
    setUpdating(true)

    const url = systemApi.getUpdateStreamUrl()
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (event) => {
      try {
        const line: LogLine = JSON.parse(event.data)
        setLogs((prev) => [...prev, line])
        if (line.type === 'done') {
          setUpdating(false)
          setUpdateDone(line.message.includes('sucesso') ? 'success' : 'error')
          es.close()
          refetchVersion()
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      setUpdating(false)
      setUpdateDone('error')
      setLogs((prev) => [
        ...prev,
        {
          type: 'error',
          message: 'Conexão com o servidor perdida durante a atualização.',
          ts: new Date().toISOString(),
        },
      ])
      es.close()
    }
  }

  const stopUpdate = () => {
    esRef.current?.close()
    setUpdating(false)
  }

  const logColor = (type: LogLine['type']) => {
    switch (type) {
      case 'success': return 'text-green-400'
      case 'error':   return 'text-red-400'
      case 'warn':    return 'text-yellow-400'
      case 'done':    return 'text-blue-400 font-bold'
      default:        return 'text-gray-300'
    }
  }

  const logPrefix = (type: LogLine['type']) => {
    switch (type) {
      case 'success': return '✔'
      case 'error':   return '✘'
      case 'warn':    return '⚠'
      case 'done':    return '●'
      default:        return '›'
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atualização do Sistema</h1>
          <p className="text-sm text-gray-500 mt-1">
            Baixa a versão mais recente do GitHub e reconstrói os containers automaticamente.
          </p>
        </div>
        <Download className="w-8 h-8 text-blue-500" />
      </div>

      {/* Version Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Versão instalada</p>
            <p className="font-mono font-semibold text-gray-800">
              {version?.currentVersion ?? '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Último commit</p>
            <p className="font-mono text-sm text-gray-700">
              {version?.lastCommitHash ? version.lastCommitHash.slice(0, 8) : '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Branch</p>
            <p className="font-mono text-sm text-gray-700">
              {version?.branch ?? 'main'}
            </p>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-yellow-800">
          <strong>Atenção:</strong> A atualização irá reconstruir o container da API. O sistema ficará
          indisponível por aproximadamente <strong>1–3 minutos</strong>. Os dados e configurações são
          preservados. Recomenda-se fazer um backup antes de atualizar.
        </div>
      </div>

      {/* Action Button */}
      <div className="flex gap-3">
        <button
          onClick={startUpdate}
          disabled={updating}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
          {updating ? 'Atualizando...' : 'Atualizar Agora'}
        </button>
        {updating && (
          <button
            onClick={stopUpdate}
            className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold px-4 py-3 rounded-lg transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Cancelar
          </button>
        )}
      </div>

      {/* Result Banner */}
      {updateDone === 'success' && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800 font-medium">
            Sistema atualizado com sucesso! A página será recarregada em instantes.
          </span>
        </div>
      )}
      {updateDone === 'error' && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
          <XCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800 font-medium">
            Ocorreu um erro durante a atualização. Verifique os logs abaixo.
          </span>
        </div>
      )}

      {/* Log Terminal */}
      {logs.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
            <Terminal className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400 font-mono">Log de atualização</span>
            {updating && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Em execução
              </span>
            )}
          </div>
          <div className="p-4 font-mono text-xs space-y-0.5 max-h-96 overflow-y-auto">
            {logs.map((line, i) => (
              <div key={i} className={`flex gap-2 ${logColor(line.type)}`}>
                <span className="flex-shrink-0 w-4 text-center">{logPrefix(line.type)}</span>
                <span>{line.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}
