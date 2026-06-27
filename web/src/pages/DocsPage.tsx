import { useState } from 'react'
import { BookOpen, ExternalLink, ChevronRight, Code2, Zap, Database, Shield, Globe } from 'lucide-react'

// Seções da documentação renderizadas diretamente em React (sem iframe)
const sections = [
  {
    id: 'overview',
    title: 'Visão Geral',
    icon: Globe,
    color: 'blue',
    content: (
      <div className="space-y-4">
        <p className="text-slate-600 text-sm leading-relaxed">
          O <strong>BR10 ACS</strong> expõe uma API REST interna para integração com ERPs, consulta de ONTs,
          usuários RADIUS e dados de fibra óptica. Todos os endpoints requerem autenticação JWT.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Endpoints IXC', value: '5', color: 'bg-blue-50 text-blue-700 border-blue-100' },
            { label: 'Tabelas IXC', value: '2', color: 'bg-purple-50 text-purple-700 border-purple-100' },
            { label: 'Timeout', value: '12s', color: 'bg-amber-50 text-amber-700 border-amber-100' },
            { label: 'Auth', value: 'JWT', color: 'bg-green-50 text-green-700 border-green-100' },
          ].map(m => (
            <div key={m.label} className={`rounded-xl border p-3 ${m.color}`}>
              <div className="text-2xl font-bold">{m.value}</div>
              <div className="text-xs font-medium mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">URL Base</div>
          <code className="text-sm font-mono text-slate-800">https://seu-acs.empresa.com.br/v1</code>
        </div>
      </div>
    ),
  },
  {
    id: 'auth',
    title: 'Autenticação',
    icon: Shield,
    color: 'green',
    content: (
      <div className="space-y-4">
        <p className="text-slate-600 text-sm leading-relaxed">
          Todos os endpoints requerem o header <code className="bg-slate-100 px-1 rounded text-xs">Authorization: Bearer &lt;token&gt;</code>.
          O token JWT é obtido via <code className="bg-slate-100 px-1 rounded text-xs">POST /auth/login</code>.
        </p>
        <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
          <pre className="text-xs text-slate-100 font-mono whitespace-pre">{`// Login
POST /v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "sua-senha"
}

// Resposta
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "...", "name": "Admin", "role": "admin" }
}

// Usar o token
GET /v1/devices
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...`}</pre>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-xs text-amber-700">
            <strong>IXC Soft:</strong> A autenticação com o IXC usa Basic Auth com o formato{' '}
            <code className="bg-amber-100 px-1 rounded">userId:token</code> (ex:{' '}
            <code className="bg-amber-100 px-1 rounded">6:4dacdb8e47193e...</code>). Esse token é armazenado
            criptografado na configuração da integração.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'ixc-rad-user',
    title: 'GET /ixc/rad-user',
    icon: Database,
    color: 'purple',
    content: (
      <div className="space-y-4">
        <p className="text-slate-600 text-sm">
          Busca usuário RADIUS na tabela <code className="bg-slate-100 px-1 rounded text-xs">radusuarios</code> do IXC Soft.
          Retorna dados do contrato, status, plano e informações de login.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-600">Parâmetro</th>
                <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-600">Tipo</th>
                <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-600">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['login', 'query string', 'Login PPPoE / usuário RADIUS'],
                ['mac', 'query string', 'MAC address da ONT ou roteador'],
                ['id', 'query string', 'ID interno do registro radusuarios'],
              ].map(([p, t, d]) => (
                <tr key={p} className="hover:bg-slate-50">
                  <td className="px-3 py-2 border border-slate-200 font-mono text-purple-700">{p}</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-500">{t}</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
          <pre className="text-xs text-slate-100 font-mono whitespace-pre">{`// cURL
curl -X GET \\
  "https://acs.empresa.com.br/v1/integrations/{integrationId}/ixc/rad-user?login=joao.silva" \\
  -H "Authorization: Bearer {token}"

// JavaScript
const res = await fetch(
  \`/v1/integrations/\${integrationId}/ixc/rad-user?login=\${pppoeLogin}\`,
  { headers: { Authorization: \`Bearer \${token}\` } }
)
const data = await res.json()
// data.login, data.id_cliente, data.ativo, data.tipo_contrato...`}</pre>
        </div>
        <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
          <div className="text-xs text-slate-400 mb-2 font-medium">Resposta (200 OK)</div>
          <pre className="text-xs text-slate-100 font-mono whitespace-pre">{`{
  "id": "12345",
  "login": "joao.silva",
  "id_cliente": "987",
  "ativo": "S",           // S = ativo, N = inativo/suspenso
  "tipo_contrato": "F",   // F = fibra, R = rádio, C = cabo
  "plano": "500MB Fibra",
  "mac": "AA:BB:CC:DD:EE:FF",
  "ip": "100.64.0.208",
  "online": 1             // 1 = online, 0 = offline
}`}</pre>
        </div>
      </div>
    ),
  },
  {
    id: 'ixc-ont-fibra',
    title: 'GET /ixc/ont-fibra',
    icon: Database,
    color: 'indigo',
    content: (
      <div className="space-y-4">
        <p className="text-slate-600 text-sm">
          Busca ONT fibra na tabela <code className="bg-slate-100 px-1 rounded text-xs">radpop_radio_cliente_fibra</code> do IXC Soft.
          Retorna dados técnicos da ONT: MAC, sinal RX/TX, temperatura, voltagem e OLT associada.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-600">Parâmetro</th>
                <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-600">Tipo</th>
                <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-600">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['mac', 'query string', 'MAC address da ONT (ex: AA:BB:CC:DD:EE:FF)'],
                ['numero_ont', 'query string', 'Número da ONT no IXC'],
                ['id_contrato', 'query string', 'ID do contrato no IXC'],
                ['id_login', 'query string', 'ID do registro radusuarios'],
              ].map(([p, t, d]) => (
                <tr key={p} className="hover:bg-slate-50">
                  <td className="px-3 py-2 border border-slate-200 font-mono text-indigo-700">{p}</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-500">{t}</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
          <pre className="text-xs text-slate-100 font-mono whitespace-pre">{`// Busca por MAC da ONT
GET /v1/integrations/{id}/ixc/ont-fibra?mac=AA:BB:CC:DD:EE:FF

// Resposta
{
  "id": "456",
  "mac": "AA:BB:CC:DD:EE:FF",
  "numero_ont": "ONT-001",
  "sinal_rx": "-18.5",     // dBm
  "sinal_tx": "2.3",       // dBm
  "temperatura": "45.2",   // °C
  "voltagem": "3.28",      // V
  "id_olt": "1",
  "id_contrato": "987",
  "ativo": "S"
}`}</pre>
        </div>
      </div>
    ),
  },
  {
    id: 'ixc-ont-complete',
    title: 'GET /ixc/ont-complete',
    icon: Zap,
    color: 'emerald',
    content: (
      <div className="space-y-4">
        <p className="text-slate-600 text-sm">
          Busca unificada que combina <code className="bg-slate-100 px-1 rounded text-xs">radusuarios</code> +{' '}
          <code className="bg-slate-100 px-1 rounded text-xs">radpop_radio_cliente_fibra</code> em uma única chamada.
          Ideal para a tela de detalhes do dispositivo.
        </p>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
          <p className="text-xs text-emerald-700">
            <strong>Fallback automático:</strong> Se não encontrar pelo login, tenta pelo MAC. Se não encontrar a ONT fibra,
            retorna apenas os dados do usuário RADIUS sem erro.
          </p>
        </div>
        <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
          <pre className="text-xs text-slate-100 font-mono whitespace-pre">{`GET /v1/integrations/{id}/ixc/ont-complete?login=joao.silva

// Resposta combinada
{
  "radUser": {
    "id": "12345",
    "login": "joao.silva",
    "id_cliente": "987",
    "ativo": "S",
    "plano": "500MB Fibra"
  },
  "ontFibra": {
    "id": "456",
    "mac": "AA:BB:CC:DD:EE:FF",
    "sinal_rx": "-18.5",
    "sinal_tx": "2.3",
    "temperatura": "45.2"
  }
}`}</pre>
        </div>
      </div>
    ),
  },
  {
    id: 'ixc-onts-contract',
    title: 'GET /ixc/onts-by-contract',
    icon: Database,
    color: 'orange',
    content: (
      <div className="space-y-4">
        <p className="text-slate-600 text-sm">
          Lista todas as ONTs associadas a um contrato no IXC Soft. Útil para clientes com múltiplas ONTs.
        </p>
        <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
          <pre className="text-xs text-slate-100 font-mono whitespace-pre">{`GET /v1/integrations/{id}/ixc/onts-by-contract/987

// Resposta
[
  {
    "id": "456",
    "mac": "AA:BB:CC:DD:EE:FF",
    "numero_ont": "ONT-001",
    "sinal_rx": "-18.5",
    "ativo": "S"
  },
  {
    "id": "457",
    "mac": "BB:CC:DD:EE:FF:00",
    "numero_ont": "ONT-002",
    "sinal_rx": "-22.1",
    "ativo": "S"
  }
]`}</pre>
        </div>
      </div>
    ),
  },
  {
    id: 'ixc-signal',
    title: 'PUT /ixc/ont-signal/:ontId',
    icon: Zap,
    color: 'rose',
    content: (
      <div className="space-y-4">
        <p className="text-slate-600 text-sm">
          Atualiza os dados de sinal de uma ONT no IXC Soft. Chamado automaticamente pelo collector quando
          coleta dados de sinal do GenieACS.
        </p>
        <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
          <pre className="text-xs text-slate-100 font-mono whitespace-pre">{`PUT /v1/integrations/{id}/ixc/ont-signal/456
Content-Type: application/json

{
  "sinal_rx": -18.5,
  "sinal_tx": 2.3,
  "temperatura": 45.2,
  "voltagem": 3.28
}

// Resposta
{
  "ok": true,
  "message": "Sinal atualizado com sucesso"
}`}</pre>
        </div>
      </div>
    ),
  },
  {
    id: 'integrations-crud',
    title: 'CRUD de Integrações',
    icon: Code2,
    color: 'slate',
    content: (
      <div className="space-y-4">
        <p className="text-slate-600 text-sm">
          Endpoints para gerenciar integrações ERP (IXC, SGP, MK-Auth, Hubsoft, Voalle, etc.).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-600">Método</th>
                <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-600">Endpoint</th>
                <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-600">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['GET', '/v1/integrations', 'Lista todas as integrações'],
                ['POST', '/v1/integrations', 'Cria nova integração'],
                ['GET', '/v1/integrations/:id', 'Detalhe de uma integração'],
                ['PUT', '/v1/integrations/:id', 'Atualiza integração'],
                ['DELETE', '/v1/integrations/:id', 'Remove integração'],
                ['POST', '/v1/integrations/:id/test', 'Testa conexão com o ERP'],
                ['GET', '/v1/integrations/:id/lookup', 'Consulta cliente no ERP'],
                ['POST', '/v1/integrations/:id/action/:action', 'Executa ação no ERP (suspender, reativar, OS)'],
                ['POST', '/v1/integrations/parse-collection', 'Analisa coleção de API .js'],
              ].map(([m, ep, d]) => (
                <tr key={ep} className="hover:bg-slate-50">
                  <td className="px-3 py-2 border border-slate-200">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      m === 'GET' ? 'bg-blue-100 text-blue-700' :
                      m === 'POST' ? 'bg-green-100 text-green-700' :
                      m === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{m}</span>
                  </td>
                  <td className="px-3 py-2 border border-slate-200 font-mono text-slate-700">{ep}</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
          <div className="text-xs text-slate-400 mb-2 font-medium">Exemplo: Criar integração IXC</div>
          <pre className="text-xs text-slate-100 font-mono whitespace-pre">{`POST /v1/integrations
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "IXC - Produção",
  "type": "ixc",
  "enabled": true,
  "config": {
    "baseUrl": "https://suaempresa.ixcsoft.com.br",
    "apiKey": "6:4dacdb8e47193e8cbbabe508...",
    "authType": "basic"
  }
}`}</pre>
        </div>
        <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
          <div className="text-xs text-slate-400 mb-2 font-medium">Adaptadores disponíveis (type)</div>
          <pre className="text-xs text-slate-100 font-mono whitespace-pre">{`ixc        → IXC Soft (Basic Auth userId:token)
ixc-csnet  → IXC CSNet (alias)
sgp        → SGP (Bearer Token)
mkauth     → MK-Auth (Basic Auth)
hubsoft    → Hubsoft (Bearer Token)
voalle     → Voalle (Bearer Token)
custom     → Customizado (endpoints manuais)`}</pre>
        </div>
      </div>
    ),
  },
  {
    id: 'lookup',
    title: 'Lookup Genérico',
    icon: Code2,
    color: 'teal',
    content: (
      <div className="space-y-4">
        <p className="text-slate-600 text-sm">
          Endpoint normalizado que funciona com qualquer ERP configurado. Retorna dados do cliente
          independente do adaptador usado.
        </p>
        <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
          <pre className="text-xs text-slate-100 font-mono whitespace-pre">{`// Busca por PPPoE (qualquer ERP)
GET /v1/integrations/{id}/lookup?pppoe=joao.silva

// Busca por serial
GET /v1/integrations/{id}/lookup?serial=ITBS12345678

// Busca por CPF
GET /v1/integrations/{id}/lookup?cpf=12345678901

// Busca IXC por login RADIUS
GET /v1/integrations/{id}/lookup?login=joao.silva

// Busca IXC por MAC da ONT
GET /v1/integrations/{id}/lookup?mac=AA:BB:CC:DD:EE:FF

// Resposta normalizada (todos os ERPs)
{
  "found": true,
  "id": "987",
  "name": "João Silva",
  "cpf": "123.456.789-01",
  "status": "Ativo",
  "plan": "500MB Fibra",
  "address": "Rua das Flores, 123",
  "phone": "(11) 99999-9999",
  "email": "joao@email.com",
  "profileUrl": "https://ixc.empresa.com.br/clientes/987"
}`}</pre>
        </div>
      </div>
    ),
  },
  {
    id: 'actions',
    title: 'Ações ERP',
    icon: Zap,
    color: 'red',
    content: (
      <div className="space-y-4">
        <p className="text-slate-600 text-sm">
          Executa ações no ERP como suspender contrato, reativar e abrir ordem de serviço.
          Os endpoints de ação podem ser customizados por integração.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-600">Ação</th>
                <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-600">Endpoint padrão IXC</th>
                <th className="text-left px-3 py-2 border border-slate-200 font-semibold text-slate-600">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['suspend', 'POST /api/clientes/{id}/suspender', 'Suspende o contrato'],
                ['reactivate', 'POST /api/clientes/{id}/reativar', 'Reativa o contrato'],
                ['open_ticket', 'POST /api/os', 'Abre ordem de serviço'],
              ].map(([a, ep, d]) => (
                <tr key={a} className="hover:bg-slate-50">
                  <td className="px-3 py-2 border border-slate-200 font-mono text-red-700">{a}</td>
                  <td className="px-3 py-2 border border-slate-200 font-mono text-slate-600 text-xs">{ep}</td>
                  <td className="px-3 py-2 border border-slate-200 text-slate-600">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl bg-slate-900 p-4 overflow-x-auto">
          <pre className="text-xs text-slate-100 font-mono whitespace-pre">{`// Suspender contrato
POST /v1/integrations/{id}/action/suspend
Authorization: Bearer {token}
Content-Type: application/json

{ "customerId": "987" }

// Resposta
{
  "ok": true,
  "message": "Contrato suspenso com sucesso"
}`}</pre>
        </div>
      </div>
    ),
  },
]

const colorMap: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  purple: 'bg-purple-100 text-purple-700',
  indigo: 'bg-indigo-100 text-indigo-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  orange: 'bg-orange-100 text-orange-700',
  rose: 'bg-rose-100 text-rose-700',
  slate: 'bg-slate-100 text-slate-700',
  teal: 'bg-teal-100 text-teal-700',
  red: 'bg-red-100 text-red-700',
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('overview')
  const current = sections.find(s => s.id === activeSection) || sections[0]

  return (
    <div className="flex gap-0 h-[calc(100vh-5rem)] -m-6 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 overflow-y-auto">
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-slate-800 text-sm">Documentação API</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">BR10 ACS — v1</p>
        </div>
        <nav className="px-2 py-3 space-y-0.5">
          {sections.map(s => {
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                  activeSection === s.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">{s.title}</span>
                {activeSection === s.id && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
              </button>
            )
          })}
        </nav>
        <div className="px-4 py-3 border-t border-slate-100 mt-2">
          <a
            href="/docs/ixc-api-docs.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-blue-600 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Abrir versão completa
          </a>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[current.color] || 'bg-slate-100 text-slate-700'}`}>
              <current.icon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{current.title}</h1>
              <p className="text-xs text-slate-400 font-mono">BR10 ACS API Reference</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            {current.content}
          </div>
          {/* Navigation */}
          <div className="flex justify-between mt-6">
            {sections.findIndex(s => s.id === activeSection) > 0 ? (
              <button
                onClick={() => setActiveSection(sections[sections.findIndex(s => s.id === activeSection) - 1].id)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-white transition-colors"
              >
                ← Anterior
              </button>
            ) : <div />}
            {sections.findIndex(s => s.id === activeSection) < sections.length - 1 ? (
              <button
                onClick={() => setActiveSection(sections[sections.findIndex(s => s.id === activeSection) + 1].id)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Próximo →
              </button>
            ) : <div />}
          </div>
        </div>
      </main>
    </div>
  )
}
