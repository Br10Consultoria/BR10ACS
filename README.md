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

## Instalação — Servidor do Zero

> **Sistema operacional recomendado:** Ubuntu Server 24.04 LTS (Noble)

### Pré-requisitos

- Ubuntu Server 24.04 LTS (instalação mínima)
- Acesso root ou sudo
- Conexão com a internet
- Portas liberadas no firewall: **8080** (interface web) e **7547** (CWMP/TR-069)

### Instalação em três comandos

```bash
# 1. Instalar git
sudo apt install -y git

# 2. Clonar o repositório
git clone https://github.com/Br10Consultoria/BR10ACS.git
cd BR10ACS

# 3. Executar o instalador automático
sudo ./instalar.sh
```

O script `instalar.sh` realiza **todo o processo automaticamente**:

| Etapa | O que faz |
|---|---|
| 1 — Detecção de CPU | Verifica suporte a AVX e seleciona `mongo:7` (com AVX) ou `mongo:4.4` (sem AVX) |
| 2 — Docker | Instala Docker Engine e Docker Compose plugin se não estiverem presentes |
| 3 — Arquivo `.env` | Gera senhas criptografadas e preenche todas as variáveis automaticamente |
| 4 — Containers | Faz build da API e sobe todos os 4 serviços |
| 5 — Health check | Aguarda todos os serviços ficarem saudáveis |
| 6 — Resumo | Exibe URL de acesso, portas e credenciais iniciais |

Ao final, acesse a interface em `http://SEU_IP:8080`.

**Credenciais padrão do primeiro acesso:**

| Campo | Valor |
|---|---|
| Usuário | `admin` |
| Senha | `Admin@br10acs` |

> **Altere a senha imediatamente após o primeiro acesso.**

---

## Atualização — Servidor com Containers Existentes

Para servidores que já possuem o BR10ACS instalado e rodando:

```bash
cd BR10ACS
git pull origin main
docker compose up -d --build br10acs-api
```

O `--build br10acs-api` reconstrói apenas a imagem da API. Os containers de MongoDB, Redis e GenieACS não são recriados e os dados são preservados nos volumes.

Para ver os logs em tempo real após a atualização:

```bash
docker compose logs -f br10acs-api
```

---

## Arquitetura dos Containers

O `docker-compose.yml` sobe **4 containers** em uma rede privada isolada (`br10acs_net`):

| Container | Imagem | Porta externa | Descrição |
|---|---|---|---|
| `br10acs-mongodb` | `mongo:7` ou `mongo:4.4` | — (apenas interno) | Banco de dados principal |
| `br10acs-redis` | `redis:7-alpine` | — (apenas interno) | Cache e filas |
| `br10acs-genieacs` | `drumsergio/genieacs:latest` | `7547` (CWMP) | Engine TR-069 (CWMP + NBI + FS + UI) |
| `br10acs-api` | Build local | `8080` | Interface web + API REST |

> **Sobre o suporte a AVX:** O MongoDB 5.0+ exige AVX no processador. O `instalar.sh` detecta automaticamente e usa `mongo:4.4` em CPUs sem AVX (VMs antigas, Proxmox/KVM legado). Para verificar manualmente: `grep -c avx /proc/cpuinfo` — se retornar `0`, use `mongo:4.4`.

---

## Funcionalidades

### Atualização de Firmware de ONTs

O botão **"Atualizar Firmware"** está disponível na aba **Informações** de cada dispositivo. Para utilizá-lo:

1. Acesse **Arquivos** no menu lateral e faça upload do arquivo de firmware (tipo `1 Firmware Upgrade Image`)
2. Abra o dispositivo desejado e vá para a aba **Informações**
3. Clique em **"Atualizar Firmware"** no card do dispositivo
4. Selecione o firmware da lista e confirme

O sistema dispara o comando `Download` via GenieACS NBI e a ONT realiza a atualização automaticamente. O dispositivo será reiniciado ao final do processo.

### Análise de IA (OpenAI)

Diagnóstico inteligente de ONTs via GPT. A chave da API pode ser configurada de duas formas:

- **Via interface web** (recomendado): acesse **Análise IA → Configurar IA** e salve a chave — ela é armazenada criptografada no banco de dados e carregada automaticamente ao iniciar o servidor
- **Via `.env`**: defina `OPENAI_API_KEY=sk-proj-...` (a chave do banco tem prioridade)

### Integração WhatsApp Business

Atendente digital via WhatsApp Cloud API (Meta). Para configurar:

1. Acesse [developers.facebook.com](https://developers.facebook.com) e crie um App do tipo **Business**
2. Adicione o produto **WhatsApp** ao App
3. Em **WhatsApp → Configuração da API**, copie o **Phone Number ID** e o **Access Token**
4. No BR10ACS, acesse **WhatsApp** no menu lateral e preencha as credenciais
5. Configure o webhook na Meta apontando para: `http://SEU_IP:8080/api/v1/whatsapp/webhook`

---

## Comandos Úteis

```bash
# Ver status de todos os containers
docker compose ps

# Ver logs da API em tempo real
docker compose logs -f br10acs-api

# Reiniciar apenas a API (sem perder dados)
docker compose restart br10acs-api

# Reiniciar todos os serviços
docker compose restart

# Parar tudo
docker compose down

# Parar e remover volumes (APAGA TODOS OS DADOS)
docker compose down -v
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
