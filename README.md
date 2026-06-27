# BR10ACS
**Sistema de Gerenciamento ACS TR-069 — Br10 Consultoria**

BR10ACS é um sistema de gerenciamento de CPEs (Customer Premises Equipment) baseado no protocolo TR-069, construído com arquitetura moderna e escalável sobre NestJS, MongoDB e GenieACS.

---

## Arquitetura

| Camada | Tecnologia | Função |
|---|---|---|
| **API** | NestJS + TypeScript (Node.js 22) | Lógica de negócio, REST API, WebSocket |
| **Banco de dados** | MongoDB (`br10`) | Dados da aplicação (separado do banco `genieacs`) |
| **Cache / Filas** | Redis 7 | Sessões, cache de parâmetros, filas de operações |
| **Engine CWMP** | GenieACS | Comunicação TR-069 com CPEs (acesso exclusivo via API REST NBI) |
| **Frontend** | React + Vite (servido pelo próprio backend) | Interface web embutida no container da API |

> O BR10ACS **nunca acessa diretamente** o banco de dados do GenieACS. Toda comunicação é feita exclusivamente via API REST NBI (porta 7557).

---

## Especificações de Hardware por Escala

As tabelas abaixo consideram a **stack completa**: BR10ACS API + Redis + MongoDB + GenieACS (CWMP + NBI + FS) rodando no **mesmo servidor**. Se os serviços forem distribuídos em máquinas separadas, os requisitos por nó são menores — veja a seção [Arquitetura Distribuída](#arquitetura-distribuída).

### Premissas de cálculo

| Parâmetro | Valor padrão | Variável de ambiente |
|---|---|---|
| Intervalo de coleta (Collector) | 300 s (5 min) | `COLLECTOR_INTERVAL` |
| Intervalo de histórico (TimeSeries) | 3600 s (1 h) | `COLLECTOR_HISTORY_INTERVAL` |
| Timeout offline | 900 s (15 min) | `COLLECTOR_OFFLINE_AFTER` |
| Documentos TimeSeries por dispositivo/dia | ~24 registros | — |
| Tamanho médio de documento TimeSeries | ~500 bytes | — |
| Tamanho médio de documento Device | ~8 KB | — |
| Crescimento de logs por dispositivo/dia | ~2 KB | — |

---

### Faixa 1 — Até 1.000 dispositivos

> Adequado para provedores pequenos e médios em fase inicial.

| Componente | Mínimo | Recomendado |
|---|---|---|
| **CPU** | 2 vCPUs (2,0 GHz) | 4 vCPUs |
| **Memória RAM** | 4 GB | 8 GB |
| **Armazenamento** | 40 GB SSD | 80 GB SSD |
| **Rede** | 100 Mbps | 1 Gbps |
| **Sistema Operacional** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

**Distribuição de memória estimada:**

| Serviço | RAM alocada |
|---|---|
| GenieACS (CWMP + NBI + FS) | 512 MB – 1 GB |
| MongoDB (WiredTiger cache) | 1 GB |
| BR10ACS API (NestJS) | 256 MB – 512 MB |
| Redis | 128 MB |
| SO + buffers | 512 MB |
| **Total** | **~3,5 GB** |

**Crescimento de dados estimado:**

| Coleção | Tamanho em 1 ano |
|---|---|
| `devices` (1.000 docs × 8 KB) | ~8 MB |
| `timeseries` (1.000 × 24 × 365 × 500 B) | ~4,4 GB |
| `logs` + `alerts` | ~700 MB |
| GenieACS (banco `genieacs`) | ~2 GB |
| **Total estimado** | **~8 GB/ano** |

**Configuração recomendada do `docker-compose.yml`:**
```yaml
br10acs-redis:
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

---

### Faixa 2 — Até 2.000 dispositivos

> Provedores em crescimento com monitoramento ativo de sinal e alertas.

| Componente | Mínimo | Recomendado |
|---|---|---|
| **CPU** | 4 vCPUs (2,4 GHz) | 6 vCPUs |
| **Memória RAM** | 8 GB | 16 GB |
| **Armazenamento** | 80 GB SSD | 160 GB SSD NVMe |
| **Rede** | 100 Mbps | 1 Gbps |
| **Sistema Operacional** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

**Distribuição de memória estimada:**

| Serviço | RAM alocada |
|---|---|
| GenieACS (CWMP + NBI + FS) | 1 GB – 2 GB |
| MongoDB (WiredTiger cache) | 2 GB |
| BR10ACS API (NestJS) | 512 MB – 1 GB |
| Redis | 256 MB |
| SO + buffers | 512 MB |
| **Total** | **~6 GB** |

**Crescimento de dados estimado:**

| Coleção | Tamanho em 1 ano |
|---|---|
| `devices` (2.000 docs × 8 KB) | ~16 MB |
| `timeseries` (2.000 × 24 × 365 × 500 B) | ~8,8 GB |
| `logs` + `alerts` | ~1,4 GB |
| GenieACS (banco `genieacs`) | ~4 GB |
| **Total estimado** | **~15 GB/ano** |

**Ajustes recomendados:**
```bash
# Aumentar cache do MongoDB para 2 GB (em mongod.conf)
# storage.wiredTiger.engineConfig.cacheSizeGB: 2

# Aumentar Redis
redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru

# Reduzir frequência de coleta se necessário (diminui carga de CPU)
COLLECTOR_INTERVAL=600  # 10 min em vez de 5 min
```

---

### Faixa 3 — Até 3.000 dispositivos

> Provedores médios com operações em massa e integrações ERP ativas.

| Componente | Mínimo | Recomendado |
|---|---|---|
| **CPU** | 6 vCPUs (2,4 GHz) | 8 vCPUs |
| **Memória RAM** | 12 GB | 24 GB |
| **Armazenamento** | 120 GB SSD NVMe | 250 GB SSD NVMe |
| **Rede** | 1 Gbps | 1 Gbps |
| **Sistema Operacional** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

**Distribuição de memória estimada:**

| Serviço | RAM alocada |
|---|---|
| GenieACS (CWMP + NBI + FS) | 2 GB – 3 GB |
| MongoDB (WiredTiger cache) | 4 GB |
| BR10ACS API (NestJS) | 1 GB – 1,5 GB |
| Redis | 512 MB |
| SO + buffers | 1 GB |
| **Total** | **~10 GB** |

**Crescimento de dados estimado:**

| Coleção | Tamanho em 1 ano |
|---|---|
| `devices` (3.000 docs × 8 KB) | ~24 MB |
| `timeseries` (3.000 × 24 × 365 × 500 B) | ~13,1 GB |
| `logs` + `alerts` | ~2,1 GB |
| GenieACS (banco `genieacs`) | ~6 GB |
| **Total estimado** | **~22 GB/ano** |

**Ajustes obrigatórios nesta faixa:**
```bash
# MongoDB: aumentar cache para 4 GB
# storage.wiredTiger.engineConfig.cacheSizeGB: 4

# Habilitar TTL no MongoDB para purgar TimeSeries antigas (ex: 90 dias)
# Configurável em Settings > Retenção de Dados na interface web

# Aumentar intervalo de coleta para reduzir carga
COLLECTOR_INTERVAL=600          # 10 min
COLLECTOR_HISTORY_INTERVAL=7200 # 2 h

# Redis com mais memória
redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
```

> **Recomendação:** a partir de 3.000 dispositivos, considere separar o MongoDB em um servidor dedicado (ver [Arquitetura Distribuída](#arquitetura-distribuída)).

---

### Faixa 4 — 5.000 ou mais dispositivos

> Provedores de grande porte. **Arquitetura distribuída obrigatória.**

| Componente | Mínimo | Recomendado |
|---|---|---|
| **CPU** | 8 vCPUs (3,0 GHz) | 16 vCPUs |
| **Memória RAM** | 32 GB | 64 GB |
| **Armazenamento** | 500 GB SSD NVMe | 1 TB SSD NVMe (RAID 10) |
| **Rede** | 1 Gbps | 10 Gbps |
| **Sistema Operacional** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

> Os valores acima são para o **servidor principal** (BR10ACS API + GenieACS). MongoDB e Redis devem estar em servidores separados nesta faixa.

**Distribuição de memória estimada (servidor principal):**

| Serviço | RAM alocada |
|---|---|
| GenieACS (CWMP + NBI + FS) | 4 GB – 8 GB |
| BR10ACS API (NestJS) | 2 GB – 4 GB |
| Redis (se local) | 1 GB – 2 GB |
| SO + buffers | 2 GB |
| **Total** | **~16 GB** |

**Servidor MongoDB dedicado (recomendado):**

| Componente | Especificação |
|---|---|
| CPU | 8 vCPUs |
| RAM | 32 GB (metade para WiredTiger cache) |
| Armazenamento | 500 GB SSD NVMe |
| Replicação | Replica Set com 3 nós (1 primário + 2 secundários) |

**Crescimento de dados estimado:**

| Coleção | Tamanho em 1 ano |
|---|---|
| `devices` (5.000 docs × 8 KB) | ~40 MB |
| `timeseries` (5.000 × 24 × 365 × 500 B) | ~21,9 GB |
| `logs` + `alerts` | ~3,5 GB |
| GenieACS (banco `genieacs`) | ~10 GB |
| **Total estimado** | **~36 GB/ano** |

**Ajustes obrigatórios nesta faixa:**
```bash
# Aumentar intervalo de coleta para 15 min
COLLECTOR_INTERVAL=900
COLLECTOR_HISTORY_INTERVAL=3600

# MongoDB Replica Set + cache 16 GB
# storage.wiredTiger.engineConfig.cacheSizeGB: 16

# Redis Sentinel ou Redis Cluster para alta disponibilidade
redis-server --maxmemory 2gb

# Habilitar retenção de TimeSeries para máximo 60 dias
# (configurável em Settings > Retenção de Dados)

# GenieACS: aumentar workers
GENIEACS_CWMP_WORKER_PROCESSES=4
GENIEACS_NBI_WORKER_PROCESSES=2
```

---

### Resumo comparativo

| Faixa | CPU | RAM | Armazenamento | Arquitetura |
|---|---|---|---|---|
| **Até 1.000 dispositivos** | 2–4 vCPUs | 4–8 GB | 40–80 GB SSD | Servidor único |
| **Até 2.000 dispositivos** | 4–6 vCPUs | 8–16 GB | 80–160 GB SSD NVMe | Servidor único |
| **Até 3.000 dispositivos** | 6–8 vCPUs | 12–24 GB | 120–250 GB SSD NVMe | Servidor único (MongoDB separado recomendado) |
| **5.000+ dispositivos** | 8–16 vCPUs | 32–64 GB | 500 GB–1 TB SSD NVMe | **Distribuído obrigatório** |

---

## Arquitetura Distribuída

Para ambientes com 3.000+ dispositivos, recomenda-se separar os serviços em nós independentes:

```
┌─────────────────────────────┐     ┌──────────────────────────┐
│  Servidor Principal         │     │  Servidor MongoDB         │
│  ─────────────────────────  │     │  ─────────────────────── │
│  BR10ACS API (NestJS)       │────▶│  MongoDB 7.x              │
│  GenieACS (CWMP + NBI + FS) │     │  Replica Set (3 nós)      │
│  Redis                      │     │  WiredTiger cache: 16 GB  │
│  8–16 vCPUs / 32 GB RAM     │     │  8 vCPUs / 32 GB RAM      │
└─────────────────────────────┘     └──────────────────────────┘
```

**Configuração de rede entre nós:**
- Latência máxima recomendada entre API e MongoDB: **< 5 ms**
- Use rede privada/interna (não exponha MongoDB à internet)
- Firewall: libere apenas a porta 27017 entre os servidores

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
| **IXC** | `/api/v1/integrations/:id/ixc/*` | Consulta de ONTs, usuários RADIUS, sinal |
| **Backup** | `/api/v1/backup` | Dump MongoDB, agendamento, exportação cloud |
| **System** | `/api/v1/system/metrics` | Métricas do servidor (CPU, RAM, disco, uptime) |
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

- Docker Engine 24+ e Docker Compose v2
- GenieACS rodando (CWMP na porta 7547, NBI na porta 7557)
- MongoDB acessível (pode ser o mesmo do GenieACS)

### 1. Clonar e configurar

```bash
git clone https://github.com/Br10Consultoria/BR10ACS.git
cd BR10ACS
cp api/.env.example api/.env
nano api/.env
```

### 2. Configurar variáveis obrigatórias

```bash
# api/.env — variáveis mínimas para produção
MONGODB_URI=mongodb://geniacs-mongodb-1:27017/br10
GENIEACS_NBI_URL=http://geniacs-genieacs-nbi-1:7557
JWT_SECRET=<string-aleatória-de-64-chars>
ENCRYPTION_KEY=<string-aleatória-de-32-chars>
SESSION_SECRET=<string-aleatória-de-32-chars>
```

### 3. Iniciar com Docker Compose

```bash
docker compose up -d --build
```

### 4. Verificar saúde dos containers

```bash
docker compose ps
docker compose logs br10acs-api --tail=50
```

### 5. Acessar

- **Interface web**: `http://SEU_IP:8080`
- **API REST**: `http://SEU_IP:8080/api`
- **Swagger**: `http://SEU_IP:8080/api/docs`
- **Login padrão**: `admin` / `Admin@br10acs` — **altere imediatamente após o primeiro acesso!**

---

## Atualização

```bash
git pull origin main
docker compose up -d --build
```

---

## Variáveis de ambiente principais

| Variável | Descrição | Padrão |
|---|---|---|
| `MONGODB_URI` | URI do MongoDB (banco `br10`) | `mongodb://localhost:27017/br10` |
| `REDIS_HOST` | Host do Redis | `localhost` |
| `REDIS_PORT` | Porta do Redis | `6379` |
| `GENIEACS_NBI_URL` | URL da API NBI do GenieACS | `http://localhost:7557` |
| `GENIEACS_CWMP_URL` | URL do CWMP do GenieACS | `http://localhost:7547` |
| `JWT_SECRET` | Segredo para assinar tokens JWT | — |
| `ENCRYPTION_KEY` | Chave de criptografia (32 chars) | — |
| `COLLECTOR_INTERVAL` | Intervalo de coleta em segundos | `300` |
| `COLLECTOR_HISTORY_INTERVAL` | Intervalo de histórico em segundos | `3600` |
| `COLLECTOR_OFFLINE_AFTER` | Tempo para marcar dispositivo offline (s) | `900` |
| `LOG_LEVEL` | Nível de log (`debug`, `info`, `warn`, `error`) | `info` |

---

## Coleções MongoDB (`br10`)

`users`, `settings`, `logs`, `timeseries`, `diagnostic_logs`, `auto_configs`, `mass_ops`, `integrations`, `api_clients`, `alerts`, `backups`

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

## Documentação da API

Com o servidor rodando, acesse `/api/docs` para a documentação Swagger interativa completa.

A documentação dos endpoints IXC está disponível em `/docs` na interface web.
