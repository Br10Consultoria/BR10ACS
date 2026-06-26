import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Edit, Shield, User } from 'lucide-react'
import { usersApi } from '@/api'
import { Card, Badge, LoadingScreen, Table, Th, Td } from '@/components/ui'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const roleLabels: Record<string, { label: string; variant: 'blue' | 'purple' | 'gray' | 'green' }> = {
  super_admin: { label: 'Super Admin', variant: 'purple' },
  admin: { label: 'Admin', variant: 'blue' },
  operator: { label: 'Operador', variant: 'green' },
  viewer: { label: 'Visualizador', variant: 'gray' },
}

type UserForm = Record<string, string> & {
  username: string
  name: string
  email: string
  password: string
  role: string
}

const emptyForm: UserForm = { username: '', name: '', email: '', password: '', role: 'operator' }

export default function UsersPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data),
  })

  const users: Record<string, unknown>[] = data?.users || data || []

  const createMutation = useMutation({
    mutationFn: (data: UserForm) => editId
      ? usersApi.update(editId, data)
      : usersApi.create(data),
    onSuccess: () => {
      toast.success(editId ? 'Usuário atualizado' : 'Usuário criado')
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowModal(false)
      setForm(emptyForm)
      setEditId(null)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Erro ao salvar usuário')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      toast.success('Usuário removido')
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast.error('Erro ao remover usuário'),
  })

  const openEdit = (user: Record<string, unknown>) => {
    setForm({
      username: (user.username as string) || '',
      name: (user.name as string) || '',
      email: (user.email as string) || '',
      password: '',
      role: (user.role as string) || 'operator',
    })
    setEditId(user._id as string || user.id as string)
    setShowModal(true)
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Usuário
        </button>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-8"><LoadingScreen /></div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Usuário</Th>
                <Th>Nome</Th>
                <Th>E-mail</Th>
                <Th>Perfil</Th>
                <Th>Status</Th>
                <Th>Criado em</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const id = (user._id || user.id) as string
                const role = (user.role as string) || 'viewer'
                const roleInfo = roleLabels[role] || { label: role, variant: 'gray' as const }
                return (
                  <tr key={id} className="hover:bg-slate-50 transition-colors">
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="font-medium text-slate-700">{user.username as string}</span>
                      </div>
                    </Td>
                    <Td>{(user.name as string) || '—'}</Td>
                    <Td className="text-slate-500">{(user.email as string) || '—'}</Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-slate-400" />
                        <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>
                      </div>
                    </Td>
                    <Td>
                      <Badge variant={(user.isActive as boolean) ? 'green' : 'red'}>
                        {(user.isActive as boolean) ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </Td>
                    <Td className="text-slate-500 text-xs">
                      {user.createdAt ? format(new Date(user.createdAt as string), 'dd/MM/yyyy') : '—'}
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(user)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm('Remover usuário?')) deleteMutation.mutate(id) }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                    Nenhum usuário encontrado
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
              <h3 className="font-semibold text-slate-800">{editId ? 'Editar Usuário' : 'Novo Usuário'}</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              {[
                { key: 'username', label: 'Usuário', type: 'text', placeholder: 'usuario' },
                { key: 'name', label: 'Nome completo', type: 'text', placeholder: 'João Silva' },
                { key: 'email', label: 'E-mail', type: 'email', placeholder: 'joao@empresa.com' },
                { key: 'password', label: editId ? 'Nova senha (deixe em branco para manter)' : 'Senha', type: 'password', placeholder: '••••••••' },
              ].map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof UserForm]}
                    onChange={(e) => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Perfil</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="operator">Operador</option>
                  <option value="viewer">Visualizador (somente leitura)</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); setForm(emptyForm); setEditId(null) }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
