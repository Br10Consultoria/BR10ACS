import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  HardDrive, Upload, Trash2, FileCode, FolderOpen, Folder,
  ChevronRight, ChevronDown, Plus, X, Search, Filter, Server, Radio,
  Router, Box,
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

// ── Fabricantes suportados ────────────────────────────────────────────────────
const VENDORS = [
  { id: 'intelbras', label: 'Intelbras', color: 'bg-blue-100 text-blue-700', abbr: 'IN' },
  { id: 'huawei',    label: 'Huawei',    color: 'bg-red-100 text-red-700',   abbr: 'HW' },
  { id: 'zte',       label: 'ZTE',       color: 'bg-green-100 text-green-700', abbr: 'ZT' },
  { id: 'nokia',     label: 'Nokia',     color: 'bg-indigo-100 text-indigo-700', abbr: 'NK' },
  { id: 'fiberhome', label: 'FiberHome', color: 'bg-orange-100 text-orange-700', abbr: 'FH' },
  { id: 'vsol',      label: 'VSOL',      color: 'bg-purple-100 text-purple-700', abbr: 'VS' },
  { id: 'tplink',    label: 'TP-Link',   color: 'bg-cyan-100 text-cyan-700',  abbr: 'TP' },
  { id: 'datacom',   label: 'Datacom',   color: 'bg-teal-100 text-teal-700',  abbr: 'DC' },
  { id: 'parks',     label: 'Parks',     color: 'bg-yellow-100 text-yellow-700', abbr: 'PK' },
  { id: 'outros',    label: 'Outros',    color: 'bg-slate-100 text-slate-600', abbr: 'OU' },
]

// ── Tipos de equipamento (segundo nível da árvore) ────────────────────────────
const EQUIP_TYPES = [
  { id: 'olt',    label: 'OLT',    icon: Server,  color: 'text-red-500',    hint: 'Optical Line Terminal' },
  { id: 'ont',    label: 'ONT',    icon: Radio,   color: 'text-blue-500',   hint: 'Optical Network Terminal' },
  { id: 'router', label: 'Router', icon: Router,  color: 'text-green-500',  hint: 'Roteador / CPE' },
  { id: 'outros', label: 'Outros', icon: Box,     color: 'text-slate-400',  hint: 'Outros equipamentos' },
]

// ── Detecção automática de vendor e tipo ─────────────────────────────────────
function detectVendor(filename: string): string {
  const l = filename.toLowerCase()
  if (l.includes('intelbras') || l.includes('itbs') || l.includes('1200r') || l.includes('1400r') || l.includes('gpon')) return 'intelbras'
  if (l.includes('huawei') || l.includes('hwtc') || l.includes('eg8') || l.includes('hg8') || l.includes('ma5')) return 'huawei'
  if (l.includes('zte') || l.includes('f660') || l.includes('f670') || l.includes('f680') || l.includes('c300') || l.includes('c320')) return 'zte'
  if (l.includes('nokia') || l.includes('alcatel') || l.includes('g-240') || l.includes('g240') || l.includes('isam')) return 'nokia'
  if (l.includes('fiberhome') || l.includes('fiber') || l.includes('an5506') || l.includes('an6000')) return 'fiberhome'
  if (l.includes('vsol') || l.includes('v2801') || l.includes('v2802') || l.includes('v1600')) return 'vsol'
  if (l.includes('tplink') || l.includes('tp-link') || l.includes('archer')) return 'tplink'
  if (l.includes('datacom') || l.includes('dm')) return 'datacom'
  if (l.includes('parks')) return 'parks'
  return 'outros'
}

function detectEquipType(filename: string, vendor: string): string {
  const l = filename.toLowerCase()
  // OLTs: equipamentos de central
  if (
    l.includes('olt') || l.includes('ma5800') || l.includes('ma5600') || l.includes('ma5683') ||
    l.includes('c300') || l.includes('c320') || l.includes('c600') || l.includes('an6000') ||
    l.includes('isam') || l.includes('7342') || l.includes('7360') || l.includes('dm4610') ||
    l.includes('dm4612') || l.includes('parks') || l.includes('v1600')
  ) return 'olt'
  // ONTs: equipamentos de cliente óptico
  if (
    l.includes('ont') || l.includes('onu') || l.includes('hg8') || l.includes('eg8') ||
    l.includes('f660') || l.includes('f670') || l.includes('f680') || l.includes('g-240') ||
    l.includes('g240') || l.includes('an5506') || l.includes('v2801') || l.includes('v2802') ||
    l.includes('itbs') || l.includes('1200r') || l.includes('1400r') || l.includes('gpon')
  ) return 'ont'
  // Roteadores
  if (
    l.includes('router') || l.includes('roteador') || l.includes('archer') || l.includes('tplink') ||
    l.includes('tp-link') || l.includes('ax') || l.includes('ac') || l.includes('wifi')
  ) return 'router'
  // Fallback por vendor
  if (vendor === 'tplink') return 'router'
  if (['intelbras', 'huawei', 'zte', 'nokia', 'fiberhome', 'vsol', 'datacom', 'parks'].includes(vendor)) return 'ont'
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
  metadata?: { fileType?: string; vendor?: string; equipType?: string; model?: string; version?: string }
}

// ── Componente de linha de arquivo ────────────────────────────────────────────
function FileRow({ f, onDelete }: { f: GenieFile; onDelete: (id: string) => void }) {
  return (
    <tr className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
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
          : <span className="text-slate-300 text-xs">—</span>}
      </td>
      <td className="px-4 py-3 text-slate-500 text-xs">
        {f.metadata?.fileType ? f.metadata.fileType.split(' ').slice(0, 2).join(' ') : '—'}
      </td>
      <td className="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{formatBytes(f.length)}</td>
      <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
        {f.uploadDate ? new Date(f.uploadDate).toLocaleString('pt-BR') : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onDelete(f._id)}
          className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
          title="Remover"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  )
}

// ── Componente de subpasta (segundo nível: OLT/ONT/Router/Outros) ─────────────
function EquipTypeFolder({
  equipType, files, onDelete,
}: { equipType: typeof EQUIP_TYPES[0]; files: GenieFile[]; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(true)
  const EtIcon = equipType.icon
  if (files.length === 0) return null
  return (
    <div className="ml-6 border-l-2 border-slate-100 mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
        <EtIcon className={`w-4 h-4 ${equipType.color}`} />
        <span className="text-sm font-medium text-slate-700">{equipType.label}</span>
        <span className="text-xs text-slate-400 ml-1">— {equipType.hint}</span>
        <span className="ml-auto text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
          {files.length}
        </span>
      </button>
      {open && (
        <div className="ml-4 border-t border-slate-100">
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
              {files.map(f => <FileRow key={f._id} f={f} onDelete={onDelete} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function FilesPage() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileType, setFileType] = useState(FILE_TYPES[0].value)
  const [uploading, setUploading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [expandedVendors, setExpandedVendors] = useState<Set<string>>(new Set(['intelbras', 'huawei', 'zte']))
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [metaVendor, setMetaVendor] = useState('intelbras')
  const [metaEquipType, setMetaEquipType] = useState('ont')
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

  // Estrutura: { vendor: { equipType: GenieFile[] } }
  const tree: Record<string, Record<string, GenieFile[]>> = {}
  for (const f of filtered) {
    const v = f.metadata?.vendor || detectVendor(f._id)
    const et = f.metadata?.equipType || detectEquipType(f._id, v)
    if (!tree[v]) tree[v] = {}
    if (!tree[v][et]) tree[v][et] = []
    tree[v][et].push(f)
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
    const vendor = detectVendor(file.name)
    setMetaVendor(vendor)
    setMetaEquipType(detectEquipType(file.name, vendor))
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
      formData.append('equipType', metaEquipType)
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
          <p className="text-xs text-slate-500 mt-0.5">
            Organizado por <strong>Fabricante → Tipo de Equipamento</strong> (OLT / ONT / Router)
          </p>
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

                {/* Fabricante + Tipo de Equipamento */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">Fabricante</label>
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
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">Tipo de Equipamento</label>
                    <select
                      value={metaEquipType}
                      onChange={(e) => setMetaEquipType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {EQUIP_TYPES.map(et => (
                        <option key={et.id} value={et.id}>{et.label} — {et.hint}</option>
                      ))}
                    </select>
                  </div>
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

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {VENDORS.slice(0, 5).map(v => {
          const count = Object.values(tree[v.id] || {}).flat().length
          return (
            <button
              key={v.id}
              onClick={() => setExpandedVendors(prev => { const n = new Set(prev); n.add(v.id); return n })}
              className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all text-left"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${v.color}`}>
                {v.abbr}
              </div>
              <div>
                <div className="text-xs text-slate-500">{v.label}</div>
                <div className="text-lg font-bold text-slate-800">{count}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Árvore de arquivos: Fabricante → Tipo de Equipamento → Arquivos */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Carregando arquivos...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <HardDrive className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhum arquivo encontrado</p>
            <p className="text-xs text-slate-400 mt-1">Faça upload de firmwares para gerenciar atualizações via TR-069</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {VENDORS.map(vendor => {
            const vendorTree = tree[vendor.id]
            if (!vendorTree) return null
            const totalFiles = Object.values(vendorTree).flat().length
            if (totalFiles === 0) return null
            const isExpanded = expandedVendors.has(vendor.id)

            return (
              <Card key={vendor.id} className="overflow-hidden">
                {/* Cabeçalho do fabricante (nível 1) */}
                <button
                  onClick={() => toggleVendor(vendor.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  {isExpanded
                    ? <FolderOpen className="w-5 h-5 text-amber-500" />
                    : <Folder className="w-5 h-5 text-amber-400" />}
                  <span className="font-semibold text-slate-700">{vendor.label}</span>
                  <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-medium ${vendor.color}`}>
                    {totalFiles} {totalFiles === 1 ? 'arquivo' : 'arquivos'}
                  </span>
                  {/* Badges de subtipos */}
                  <div className="ml-auto flex gap-1.5">
                    {EQUIP_TYPES.map(et => {
                      const count = (vendorTree[et.id] || []).length
                      if (count === 0) return null
                      const EtIcon = et.icon
                      return (
                        <span key={et.id} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          <EtIcon className={`w-3 h-3 ${et.color}`} />
                          {et.label} {count}
                        </span>
                      )
                    })}
                  </div>
                </button>

                {/* Subpastas por tipo de equipamento (nível 2) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 py-2">
                    {EQUIP_TYPES.map(et => (
                      <EquipTypeFolder
                        key={et.id}
                        equipType={et}
                        files={vendorTree[et.id] || []}
                        onDelete={(id) => deleteMut.mutate(id)}
                      />
                    ))}
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
