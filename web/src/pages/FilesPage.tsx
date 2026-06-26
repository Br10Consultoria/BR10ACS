import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Trash2, HardDrive, FileCode } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { filesApi } from '@/api'
import toast from 'react-hot-toast'

interface GenieFile {
  _id: string
  length?: number
  metadata?: {
    fileType?: string
    oui?: string
    productClass?: string
    version?: string
  }
  uploadDate?: string
}

const FILE_TYPES = [
  { value: '1 Firmware Upgrade Image', label: 'Firmware' },
  { value: '2 Web Content', label: 'Web Content' },
  { value: '3 Vendor Configuration File', label: 'Configuração' },
  { value: '4 Tone File', label: 'Tom de Chamada' },
  { value: '5 Ringer File', label: 'Ringer' },
]

function formatBytes(bytes?: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export default function FilesPage() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileType, setFileType] = useState('1 Firmware Upgrade Image')
  const [uploading, setUploading] = useState(false)

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['files'],
    queryFn: () => filesApi.listFiles().then((r) => r.data as GenieFile[]),
  })

  const deleteMut = useMutation({
    mutationFn: (name: string) => filesApi.deleteFile(name),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files'] }); toast.success('Arquivo removido') },
    onError: () => toast.error('Erro ao remover arquivo'),
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await filesApi.uploadFile(formData, fileType)
      qc.invalidateQueries({ queryKey: ['files'] })
      toast.success(`Arquivo "${file.name}" enviado com sucesso`)
    } catch {
      toast.error('Erro ao enviar arquivo')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-5">
      {/* Upload */}
      <Card>
        <CardHeader><CardTitle>Upload de Arquivo</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-xs text-slate-500 mb-1">Tipo de arquivo</label>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FILE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label} — {t.value}</option>
                ))}
              </select>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleUpload}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                  uploading
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Enviando...' : 'Selecionar e Enviar'}
              </label>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Arquivos enviados ficam disponíveis no GenieACS para atualização de firmware e configuração remota via TR-069.
          </p>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle>Arquivos no GenieACS ({files.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">Carregando arquivos...</div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <HardDrive className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhum arquivo no GenieACS</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tamanho</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f._id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileCode className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="font-mono text-xs text-slate-700 break-all">{f._id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{f.metadata?.fileType || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{formatBytes(f.length)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {f.uploadDate ? new Date(f.uploadDate).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteMut.mutate(f._id)}
                        className="text-red-400 hover:text-red-600 p-1 rounded"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
