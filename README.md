# BR10ACS

**Sistema de Gerenciamento ACS TR-069 — Br10 Consultoria**

BR10ACS é um sistema de gerenciamento de CPEs (Customer Premises Equipment) baseado no protocolo TR-069, construído com arquitetura moderna e escalável.

---

## Arquitetura

| Camada | Tecnologia | Função |
|---|---|---|
| **API** | NestJS + TypeScript | Lógica de negócio, REST API, WebSocket |
| **Banco de dados** | MongoDB (`br10`) | Dados da aplicação (separado do banco `genieacs`) |
| **Cache / Filas** | Redis | Sessões, cache, filas de operações |
| **Engine CWMP** | GenieACS | Comunicação TR-069 com CPEs (acesso exclusivo via API REST NBI) |

> O BR10ACS **nunca acessa diretamente** o banco de dados do GenieACS. Toda comunicação é feita exclusivamente via API REST NBI (porta 7557).

---

## Módulos

| Módulo | Endpoints | Descrição |
|---|---|---|
| **Auth** | `/api/v1/auth` | Login, logout, refresh token, JWT |
| **Users** | `/api/v1/users` | CRUD de usuários, roles, permissões |
| **Devices** | `/api/v1/devices` | Listagem, detalhe, parâmetros brutos, TimeSeries |
| **Diagnostics** | `/api/v1/devices/:id/diagnostics` | Ping, traceroute, speedtest via TR-069 |
| **AutoConfig** | `/api/v1/autoconfig` | Provisionamento automático por perfil |
| **Logs** | `/api/v1/logs` | Logs estruturados por categoria e dispositivo |
| **MassOps** | `/api/v1/mass-ops` | Operações em massa (reboot, set param, firmware) |
| **Settings** | `/api/v1/settings` | Configurações globais do sistema |
| **Integrations** | `/api/v1/integrations` | Webhooks, ERP, notificações |
| **ApiClients** | `/api/v1/api-clients` | Chaves de API externas |

---

## Roles e Permissões

| Role | Nível | Permissões |
|---|---|---|
| `super_admin` | 4 | Acesso total, incluindo gerenciamento de usuários e purga de logs |
| `admin` | 3 | Gerenciamento de dispositivos, configurações e integrações |
| `operator` | 2 | Operações em dispositivos (reboot, diagnósticos, tags) |
| `viewer` | 1 | Somente leitura |

---

## Instalação rápida

### Pré-requisitos

- Docker + Docker Compose
- GenieACS rodando (CWMP na porta 7547, NBI na porta 7557)

### 1. Clonar e configurar

```bash
git clone https://github.com/Br10Consultoria/BR10ACS.git
cd BR10ACS
cp api/.env.example api/.env
# Editar api/.env com as configurações do seu ambiente
```

### 2. Iniciar com Docker Compose

```bash
# Se o GenieACS já tem MongoDB, use o MongoDB existente:
# Edite MONGODB_URI no docker-compose.yml para apontar para o MongoDB do GenieACS
# e remova o serviço mongodb do docker-compose.yml

docker compose up -d
```

### 3. Acessar

- **API**: `http://localhost:3100/api`
- **Swagger**: `http://localhost:3100/api/docs`
- **Login padrão**: `admin` / `Admin@br10acs` (altere imediatamente!)

---

## Desenvolvimento local

```bash
cd api
pnpm install
cp .env.example .env
# Configure .env com MongoDB e Redis locais
pnpm run start:dev
```

---

## Variáveis de ambiente principais

| Variável | Descrição | Padrão |
|---|---|---|
| `MONGODB_URI` | URI do MongoDB (banco `br10`) | `mongodb://localhost:27017/br10` |
| `REDIS_HOST` | Host do Redis | `localhost` |
| `GENIEACS_NBI_URL` | URL da API NBI do GenieACS | `http://localhost:7557` |
| `JWT_SECRET` | Segredo para assinar tokens JWT | — |
| `ENCRYPTION_KEY` | Chave de criptografia (32 chars) | — |

---

## Coleções MongoDB (`br10`)

`users`, `settings`, `logs`, `timeseries`, `diagnostic_logs`, `auto_configs`, `mass_ops`, `integrations`, `api_clients`

---

## Documentação da API

Com o servidor rodando, acesse `/api/docs` para a documentação Swagger interativa completa.
