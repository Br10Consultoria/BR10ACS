import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  HardDrive, Upload, Trash2, FileCode, FolderOpen, Folder,
  ChevronRight, ChevronDown, Plus, X, Search, Filter,
} from 'lucide-react'
import { filesApi } from '@/api'
import { Card, CardContent, Badge } from '@/components/ui'
import toast from 'react-hot-toast'

// ── Tipos de arquivo aceitos pelo GenieACS ─────────────────────────────────────
const FILE_TYPES = [
  { value: '1 Firmware Upgrade Image', label: 'Firmware — 1 Firmware Upgrade Image' },
  { value: '2 Web Content', label: 'Web Content — 2 Web Content' },
  { value: '3 Vendor Configuration File', label: 'Config — 3 Vendor Configuration File' },
  { value: '4 Tone File', label: 'Tone File — 4 Tone File' },
  { value: '5 Ringer File', label: 'Ringer File — 5 Ringer File' },
]

// ── Vendors conhecidos (OLT e ONT) ────────────────────────────────────────────
const VENDORS = [
  { id: 'intelbras', label: 'Intelbras', color: 'bg-blue-100 text-blue-700' },
  { id: 'huawei', label: 'Huawei', color: 'bg-red-100 text-red-700' },
  { id: 'zte', label: 'ZTE', color: 'bg-green-100 text-green-700' },
  { id: 'nokia', label: 'Nokia', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'fiberhome', label: 'FiberHome', color: 'bg-orange-100 text-orange-700' },
  { id: 'vsol', label: 'VSOL', color: 'bg-purple-100 text-purple-700' },
  { id: 'tplink', label: 'TP-Link', color: 'bg-cyan-100 text-cyan-700' },
  { id: 'datacom', label: 'Datacom', color: 'bg-teal-100 text-teal-700' },
  { id: 'parks', label: 'Parks', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'outros', label: 'Outros', color: 'bg-slate-100 text-slate-600' },
]

function detectVendor(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.includes('intelbras') || lower.includes('itbs') || lower.includes('1200r') || lower.includes('1400r') || lower.includes('gpon')) return 'intelbras'
  if (lower.includes('huawei') || lower.includes('hwtc') || lower.includes('eg8') || lower.includes('hg8')) return 'huawei'
  if (lower.includes('zte') || lower.includes('f660') || lower.includes('f670') || lower.includes('f680')) return 'zte'
  if (lower.includes('nokia') || lower.includes('alcatel') || lower.includes('g-240') || lower.includes('g240')) return 'nokia'
  if (lower.includes('fiberhome') || lower.includes('fiber') || lower.includes('an5506')) return 'fiberhome'
  if (lower.includes('vsol') || lower.includes('v2801') || lower.includes('v2802')) return 'vsol'
  if (lower.includes('tplink') || lower.includes('tp-link') || lower.includes('archer')) return 'tplink'
  if (lower.includes('datacom') || lower.includes('dm')) return 'datacom'
  if (lower.includes('parks')) return 'parks'
  return 'outros'
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

interface GenieFile {
  _id: string
  length?: number
  uploadDate?: string
  metadata?: { fileType?: string; vendor?: string; model?: string; version?: string }
}

export default function FilesPage() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileType, setFileType] = useState(FILE_TYPES[0].value)
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set(['intelbras']))
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [metaVendor, setMetaVendor] = useState('intelbras')
  const [metaModel, setMetaModel] = useState('')
  const [metaVersion, setMetaVersion] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['files'],
    queryFn: () => filesApi.listFiles().then(r => r.data),
    refetchInterval: 30000,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => filesApi.deleteFile(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files'] }); toast.success('Arquivo removido') },
    onError: () => toast.error('Erro ao remover arquivo'),
  })

  const files: GenieFile[] = data?.files || data || []

  const filtered = files.filter(f => {
    const matchSearch = !search || f._id.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || f.metadata?.fileType === typeFilter
    return matchSearch && matchType
  })

  const byVendor: Record<string, GenieFile[]> = {}
  for (const f of filtered) {
    const v = f.metadata?.vendor || detectVendor(f._id)
    if (!byVendor[v]) byVendor[v] = []
    byVendor[v].push(f)
  }

  const toggleVendor = (id: string) => {
    setExpandedVendors(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setMetaVendor(detectVendor(file.name))
    const versionMatch = file.name.match(/[\d]+[._-][\d]+[._-][\d]+/)
    setMetaVersion(versionMatch ? versionMatch[0].replace(/_/g, '.') : '')
    setMetaModel('')
  }

  const handleUpload = async () => {
    if (!pendingFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', pendingFile)
      formData.append('vendor', metaVendor)
      formData.append('model', metaModel)
      formData.append('version', metaVersion)
      await filesApi.uploadFile(formData, fileType)
      qc.invalidateQueries({ queryKey: ['files'] })
      toast.success(`"${pendingFile.name}" enviado com sucesso`)
      setPendingFile(null)
      setShowUpload(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      toast.error('Erro ao enviar arquivo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Arquivos de Firmware</h2>
          <p className="text-xs text-slate-500 mt-0.5">Organize firmwares de OLTs e ONTs por fabricante</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Arquivo
        </button>
      </div>

      {/* Modal de Upload */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Upload de Arquivo</h3>
              <button onClick={() => { setShowUpload(false); setPendingFile(null) }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-1 font-medium">Tipo de arquivo (TR-069)</label>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FILE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {!pendingFile ? (
              <div>
                <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" id="file-upload" />
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <Upload className="w-8 h-8 text-slate-300" />
                  <span className="text-sm text-slate-500">Clique para selecionar o arquivo</span>
                  <span className="text-xs text-slate-400">.bin, .img, .tar.gz, .zip, etc.</span>
                </label>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <FileCode className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate">{pendingFile.name}</div>
                    <div className="text-xs text-slate-400">{formatBytes(pendingFile.size)}</div>
                  </div>
                  <button onClick={() => { setPendingFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }} className="text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1 font-medium">Fabricante / Vendor</label>
                  <select
                    value={metaVendor}
                    onChange={(e) => setMetaVendor(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {VENDORS.map(v => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">Modelo (ex: 1200R)</label>
                    <input
                      type="text"
                      value={metaModel}
                      onChange={(e) => setMetaModel(e.target.value)}
                      placeholder="Opcional"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">Versão (ex: 2.2.250203)</label>
                    <input
                      type="text"
                      value={metaVersion}
                      onChange={(e) => setMetaVersion(e.target.value)}
                      placeholder="Opcional"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploading ? 'Enviando...' : 'Enviar para GenieACS'}
                </button>
              </div>
            )}
            <p className="text-xs text-slate-400 mt-3 text-center">
              Arquivos ficam disponíveis no GenieACS para atualização via TR-069
            </p>
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
                placeholder="Buscar por nome do arquivo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos os tipos</option>
                {FILE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas rápidas por vendor */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {VENDORS.slice(0, 5).map(v => {
          const count = (byVendor[v.id] || []).length
          return (
            <button
              key={v.id}
              onClick={() => setExpandedVendors(prev => { const n = new Set(prev); n.add(v.id); return n })}
              className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all text-left"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${v.color}`}>
                {v.label.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-xs text-slate-500">{v.label}</div>
                <div className="text-lg font-bold text-slate-800">{count}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Diretórios por vendor */}
      {isLoading ? (
        <Card><CardContent><div className="text-center py-12 text-slate-400">Carregando arquivos...</div></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-16 text-slate-400">
              <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhum arquivo encontrado</p>
              <p className="text-xs mt-1">Use o botão "Novo Arquivo" para fazer upload</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {VENDORS.map(vendor => {
            const vendorFiles = byVendor[vendor.id] || []
            if (vendorFiles.length === 0) return null
            const isExpanded = expandedVendors.has(vendor.id)
            return (
              <Card key={vendor.id}>
                <button
                  onClick={() => toggleVendor(vendor.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors rounded-t-xl"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-400" />
                  }
                  {isExpanded
                    ? <FolderOpen className="w-5 h-5 text-amber-500" />
                    : <Folder className="w-5 h-5 text-amber-400" />
                  }
                  <span className="font-semibold text-slate-700 text-sm">{vendor.label}</span>
                  <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-medium ${vendor.color}`}>
                    {vendorFiles.length} {vendorFiles.length === 1 ? 'arquivo' : 'arquivos'}
                  </span>
                </button>
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Arquivo</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Modelo</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Versão</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Tamanho</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Upload</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {vendorFiles.map((f) => (
                          <tr key={f._id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <FileCode className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                <span className="font-mono text-xs text-slate-700 break-all">{f._id}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs hidden md:table-cell">
                              {f.metadata?.model || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              {f.metadata?.version
                                ? <Badge variant="blue">{f.metadata.version}</Badge>
                                : <span className="text-slate-300 text-xs">—</span>
                              }
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {f.metadata?.fileType
                                ? f.metadata.fileType.split(' ').slice(0, 2).join(' ')
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{formatBytes(f.length)}</td>
                            <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                              {f.uploadDate ? new Date(f.uploadDate).toLocaleString('pt-BR') : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => deleteMut.mutate(f._id)}
                                disabled={deleteMut.isPending}
                                className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                                title="Remover"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-right">
          {filtered.length} arquivo{filtered.length !== 1 ? 's' : ''} no GenieACS
        </p>
      )}
    </div>
  )
}
