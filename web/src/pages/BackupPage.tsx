import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Database, Download, Trash2, RefreshCw, Clock, Calendar, Cloud,
  CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, Shield,
  HardDrive, Settings, Play, CloudUpload,
} from 'lucide-react'
import { backupApi } from '@/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(d: string | Date | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function formatDuration(start: string, end: string): string {
  if (!start || !end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

const DAYS_OF_WEEK = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const CLOUD_PROVIDERS = [
  { value: '', label: 'Nenhum' },
  { value: 'dropbox', label: 'Dropbox' },
  { value: 'gdrive', label: 'Google Drive' },
  { value: 's3', label: 'Amazon S3 / Wasabi / Backblaze' },
  { value: 'webhook', label: 'Webhook personalizado' },
]

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BackupPage() {
  const qc = useQueryClient()
  const [showSchedule, setShowSchedule] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: backups = [], isLoading: loadingList, refetch: refetchList } = useQuery({
    queryKey: ['backups'],
    queryFn: () => backupApi.list(),
    refetchInterval: 10_000,
  })

  const { data: schedule, isLoading: loadingSchedule } = useQuery({
    queryKey: ['backup-schedule'],
    queryFn: () => backupApi.getSchedule(),
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const runMutation = useMutation({
    mutationFn: () => backupApi.run(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['backups'] })
      if (result.status === 'success') {
        showToast('success', `Backup concluído: ${formatSize(result.sizeBytes)}`)
      } else {
        showToast('error', `Backup falhou: ${result.errorMessage}`)
      }
    },
    onError: (err: any) => showToast('error', err?.response?.data?.message || 'Erro ao executar backup'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => backupApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backups'] })
      showToast('success', 'Backup removido')
    },
  })

  const saveMutation = useMutation({
    mutationFn: (data: any) => backupApi.saveSchedule(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backup-schedule'] })
      showToast('success', 'Configurações salvas')
    },
    onError: () => showToast('error', 'Erro ao salvar configurações'),
  })

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = (id: string, filename: string) => {
    const token = localStorage.getItem('token')
    const url = backupApi.downloadUrl(id)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    // Adiciona token como query param para autenticação no download
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob)
        a.href = blobUrl
        a.click()
        URL.revokeObjectURL(blobUrl)
      })
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const successCount = backups.filter((b: any) => b.status === 'success').length
  const totalSize = backups.reduce((acc: number, b: any) => acc + (b.sizeBytes || 0), 0)
  const lastBackup = backups.find((b: any) => b.status === 'success')

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Backup do Sistema</h2>
          <p className="text-sm text-slate-500 mt-0.5">Gerencie backups do banco de dados MongoDB e exporte para a nuvem</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSchedule(s => !s)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configurações
            {showSchedule ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {runMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {runMutation.isPending ? 'Executando...' : 'Executar Backup Agora'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Database} label="Total de backups" value={String(backups.length)} color="blue" />
        <StatCard icon={CheckCircle} label="Bem-sucedidos" value={String(successCount)} color="green" />
        <StatCard icon={HardDrive} label="Espaço utilizado" value={formatSize(totalSize)} color="slate" />
        <StatCard
          icon={Clock}
          label="Último backup"
          value={lastBackup ? formatDate(lastBackup.completedAt).split(' ')[0] : 'Nunca'}
          color="amber"
        />
      </div>

      {/* Configurações de agendamento (expansível) */}
      {showSchedule && !loadingSchedule && schedule && (
        <SchedulePanel schedule={schedule} onSave={(data) => saveMutation.mutate(data)} saving={saveMutation.isPending} />
      )}

      {/* Lista de backups */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Histórico de Backups</h3>
          <button onClick={() => refetchList()} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Carregando...
          </div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Database className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">Nenhum backup realizado ainda</p>
            <p className="text-xs mt-1">Clique em "Executar Backup Agora" para criar o primeiro</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {backups.map((b: any) => (
              <BackupRow
                key={b._id}
                backup={b}
                onDownload={() => handleDownload(b._id, b.filename)}
                onDelete={() => deleteMutation.mutate(b._id)}
                deleting={deleteMutation.isPending && deleteMutation.variables === b._id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-800">{value}</p>
      </div>
    </div>
  )
}

function BackupRow({ backup, onDownload, onDelete, deleting }: {
  backup: any
  onDownload: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const statusConfig = {
    success: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Concluído' },
    error:   { icon: XCircle,     color: 'text-red-600',     bg: 'bg-red-50',     label: 'Erro' },
    running: { icon: Loader2,     color: 'text-blue-600',    bg: 'bg-blue-50',    label: 'Executando' },
  }
  const cfg = statusConfig[backup.status as keyof typeof statusConfig] || statusConfig.error
  const StatusIcon = cfg.icon

  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
      {/* Status badge */}
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} min-w-[100px]`}>
        <StatusIcon className={`w-3.5 h-3.5 ${backup.status === 'running' ? 'animate-spin' : ''}`} />
        {cfg.label}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{backup.filename}</p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
          <span>{formatDate(backup.startedAt)}</span>
          {backup.completedAt && (
            <span>Duração: {formatDuration(backup.startedAt, backup.completedAt)}</span>
          )}
          {backup.sizeBytes > 0 && <span>{formatSize(backup.sizeBytes)}</span>}
          <span className="capitalize text-slate-400">{backup.triggeredBy}</span>
        </div>
        {backup.errorMessage && (
          <p className="text-xs text-red-500 mt-0.5 truncate">{backup.errorMessage}</p>
        )}
      </div>

      {/* Cloud badge */}
      {backup.cloudUploaded && (
        <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
          <CloudUpload className="w-3 h-3" />
          {backup.cloudProvider}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1">
        {backup.status === 'success' && (
          <button
            onClick={onDownload}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Baixar backup"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onDelete}
          disabled={deleting}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          title="Remover backup"
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

function SchedulePanel({ schedule, onSave, saving }: { schedule: any; onSave: (d: any) => void; saving: boolean }) {
  const [form, setForm] = useState(schedule)

  useEffect(() => { setForm(schedule) }, [schedule])

  const set = (path: string, value: any) => {
    setForm((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev))
      const parts = path.split('.')
      let obj = next
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {}
        obj = obj[parts[i]]
      }
      obj[parts[parts.length - 1]] = value
      return next
    })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-6">
      <div className="flex items-center gap-2 text-slate-800 font-semibold">
        <Calendar className="w-4 h-4 text-blue-600" />
        Agendamento e Configurações
      </div>

      {/* Agendamentos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Diário */}
        <ScheduleBlock title="Diário" enabled={form.daily?.enabled} onToggle={v => set('daily.enabled', v)}>
          <label className="text-xs text-slate-500">Horário</label>
          <input
            type="time"
            value={form.daily?.time || '02:00'}
            onChange={e => set('daily.time', e.target.value)}
            className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </ScheduleBlock>

        {/* Semanal */}
        <ScheduleBlock title="Semanal" enabled={form.weekly?.enabled} onToggle={v => set('weekly.enabled', v)}>
          <label className="text-xs text-slate-500">Dia da semana</label>
          <select
            value={form.weekly?.dayOfWeek ?? 0}
            onChange={e => set('weekly.dayOfWeek', Number(e.target.value))}
            className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <label className="text-xs text-slate-500 mt-2 block">Horário</label>
          <input
            type="time"
            value={form.weekly?.time || '02:00'}
            onChange={e => set('weekly.time', e.target.value)}
            className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </ScheduleBlock>

        {/* Mensal */}
        <ScheduleBlock title="Mensal" enabled={form.monthly?.enabled} onToggle={v => set('monthly.enabled', v)}>
          <label className="text-xs text-slate-500">Dia do mês</label>
          <input
            type="number"
            min={1} max={28}
            value={form.monthly?.dayOfMonth ?? 1}
            onChange={e => set('monthly.dayOfMonth', Number(e.target.value))}
            className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <label className="text-xs text-slate-500 mt-2 block">Horário</label>
          <input
            type="time"
            value={form.monthly?.time || '02:00'}
            onChange={e => set('monthly.time', e.target.value)}
            className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </ScheduleBlock>
      </div>

      {/* Retenção */}
      <div className="flex items-center gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Retenção de backups</label>
          <p className="text-xs text-slate-400">Backups mais antigos que este período serão removidos automaticamente</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="number"
            min={1} max={365}
            value={form.retentionDays ?? 30}
            onChange={e => set('retentionDays', Number(e.target.value))}
            className="w-20 text-sm border border-slate-300 rounded-lg px-3 py-1.5 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-500">dias</span>
        </div>
      </div>

      {/* Cloud */}
      <div className="border-t border-slate-100 pt-5 space-y-4">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-blue-500" />
          <span className="font-medium text-slate-800 text-sm">Exportação para Nuvem</span>
          <label className="ml-auto flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.cloud?.enabled ?? false}
              onChange={e => set('cloud.enabled', e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <span className="text-sm text-slate-600">Ativar</span>
          </label>
        </div>

        {form.cloud?.enabled && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600">Provedor</label>
              <select
                value={form.cloud?.provider || ''}
                onChange={e => set('cloud.provider', e.target.value)}
                className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CLOUD_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {form.cloud?.provider === 'dropbox' && (
              <div>
                <label className="text-xs font-medium text-slate-600">Token de Acesso Dropbox</label>
                <input
                  type="password"
                  placeholder="sl.xxxxxxxx..."
                  value={form.cloud?.dropbox?.accessToken || ''}
                  onChange={e => set('cloud.dropbox.accessToken', e.target.value)}
                  className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">Gere em: <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer" className="text-blue-500 underline">dropbox.com/developers/apps</a></p>
              </div>
            )}

            {form.cloud?.provider === 'gdrive' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Service Account JSON</label>
                  <textarea
                    rows={4}
                    placeholder='{"type":"service_account","project_id":"..."}'
                    value={form.cloud?.gdrive?.serviceAccountJson || ''}
                    onChange={e => set('cloud.gdrive.serviceAccountJson', e.target.value)}
                    className="mt-1 w-full text-xs font-mono border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">ID da Pasta (opcional)</label>
                  <input
                    type="text"
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                    value={form.cloud?.gdrive?.folderId || ''}
                    onChange={e => set('cloud.gdrive.folderId', e.target.value)}
                    className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {form.cloud?.provider === 's3' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Bucket</label>
                  <input type="text" placeholder="meu-bucket-backups" value={form.cloud?.s3?.bucket || ''} onChange={e => set('cloud.s3.bucket', e.target.value)} className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Região</label>
                  <input type="text" placeholder="us-east-1" value={form.cloud?.s3?.region || ''} onChange={e => set('cloud.s3.region', e.target.value)} className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Access Key ID</label>
                  <input type="text" placeholder="AKIAIOSFODNN7EXAMPLE" value={form.cloud?.s3?.accessKeyId || ''} onChange={e => set('cloud.s3.accessKeyId', e.target.value)} className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Secret Access Key</label>
                  <input type="password" placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" value={form.cloud?.s3?.secretAccessKey || ''} onChange={e => set('cloud.s3.secretAccessKey', e.target.value)} className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}

            {form.cloud?.provider === 'webhook' && (
              <div>
                <label className="text-xs font-medium text-slate-600">URL do Webhook</label>
                <input
                  type="url"
                  placeholder="https://n8n.meuservidor.com/webhook/backup"
                  value={form.cloud?.webhookUrl || ''}
                  onChange={e => set('cloud.webhookUrl', e.target.value)}
                  className="mt-1 w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">O backup será enviado como JSON com campo <code>data</code> em Base64</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aviso de segurança */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
        <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>Os backups contêm dados sensíveis (credenciais, configurações). Mantenha os arquivos em local seguro e com acesso restrito.</span>
      </div>

      {/* Botão salvar */}
      <div className="flex justify-end">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  )
}

function ScheduleBlock({ title, enabled, onToggle, children }: {
  title: string
  enabled: boolean
  onToggle: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div className={`border rounded-xl p-4 transition-colors ${enabled ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-slate-700 text-sm">{title}</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled ?? false}
            onChange={e => onToggle(e.target.checked)}
            className="w-4 h-4 accent-blue-600"
          />
          <span className="text-xs text-slate-500">{enabled ? 'Ativo' : 'Inativo'}</span>
        </label>
      </div>
      <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>
        {children}
      </div>
    </div>
  )
}
