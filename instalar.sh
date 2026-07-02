#!/usr/bin/env bash
# =============================================================================
# BR10ACS — Script Orquestrador de Instalação
# Versão: 2.0.0
#
# Uso:
#   chmod +x instalar.sh
#   sudo ./instalar.sh
#
# O script:
#   1. Detecta suporte a AVX no processador
#   2. Instala Docker + Docker Compose (se não instalado)
#   3. Gera senhas criptografadas e preenche o .env automaticamente
#   4. Sobe todos os containers (MongoDB, Redis, GenieACS, BR10ACS)
#   5. Aguarda todos os serviços ficarem saudáveis
#   6. Exibe resumo com URLs e credenciais
# =============================================================================

set -euo pipefail

# ─── Cores ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${CYAN}[BR10ACS]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}══ $* ══${NC}"; }

# ─── Verificações iniciais ────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Execute como root: sudo ./instalar.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "\n${BOLD}${BLUE}"
echo "  ██████╗ ██████╗  ██╗ ██████╗      █████╗  ██████╗███████╗"
echo "  ██╔══██╗██╔══██╗███║██╔═████╗    ██╔══██╗██╔════╝██╔════╝"
echo "  ██████╔╝██████╔╝╚██║██║██╔██║    ███████║██║     ███████╗"
echo "  ██╔══██╗██╔══██╗ ██║████╔╝██║    ██╔══██║██║     ╚════██║"
echo "  ██████╔╝██║  ██║ ██║╚██████╔╝    ██║  ██║╚██████╗███████║"
echo "  ╚═════╝ ╚═╝  ╚═╝ ╚═╝ ╚═════╝     ╚═╝  ╚═╝ ╚═════╝╚══════╝"
echo -e "${NC}"
echo -e "  ${BOLD}Instalador Automático — Servidor do Zero${NC}"
echo -e "  $(date '+%d/%m/%Y %H:%M:%S')\n"

# ─── ETAPA 1: Detectar AVX ────────────────────────────────────────────────────
step "Etapa 1/6 — Detecção de CPU e suporte a AVX"

AVX_SUPPORTED=false
if grep -q "avx" /proc/cpuinfo 2>/dev/null; then
    AVX_SUPPORTED=true
    success "CPU com suporte a AVX detectado — usando MongoDB 7 (recomendado)"
    MONGO_IMAGE="mongo:7"
else
    warn "CPU SEM suporte a AVX detectado (VM antiga, Proxmox, KVM legado)"
    warn "Usando MongoDB 4.4 para compatibilidade"
    MONGO_IMAGE="mongo:4.4"
fi

CPU_MODEL=$(grep -m1 "model name" /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || echo "Desconhecido")
log "CPU: $CPU_MODEL"
log "MongoDB: $MONGO_IMAGE"

# ─── ETAPA 2: Instalar Docker ─────────────────────────────────────────────────
step "Etapa 2/6 — Instalação do Docker"

install_docker() {
    log "Instalando dependências..."
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg lsb-release

    log "Adicionando repositório oficial do Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
        gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    systemctl enable docker --quiet
    systemctl start docker

    success "Docker instalado com sucesso"
}

if command -v docker &>/dev/null; then
    DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    success "Docker já instalado: $DOCKER_VERSION"
else
    warn "Docker não encontrado — instalando..."
    install_docker
fi

# Verificar docker compose (plugin v2)
if docker compose version &>/dev/null 2>&1; then
    COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "v2.x")
    success "Docker Compose: $COMPOSE_VERSION"
else
    warn "Docker Compose plugin não encontrado — instalando..."
    apt-get install -y -qq docker-compose-plugin
    success "Docker Compose instalado"
fi

# ─── ETAPA 3: Gerar .env ──────────────────────────────────────────────────────
step "Etapa 3/6 — Configuração do arquivo .env"

# Função para gerar senha segura
gen_password() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -dc 'A-Za-z0-9@#$%&*' | head -c $length
}

# Função para gerar chave hex
gen_hex() {
    local length=${1:-32}
    openssl rand -hex $length | head -c $length
}

# Detectar IP do servidor
SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")

if [[ -f ".env" ]]; then
    warn "Arquivo .env já existe."
    echo -n "  Deseja regenerar as senhas e manter as configurações existentes? [s/N] "
    read -r REGEN
    if [[ "${REGEN,,}" != "s" ]]; then
        log "Mantendo .env existente."
        # Lê MONGO_IMAGE do .env existente se definido
        if grep -q "^MONGO_IMAGE=" .env; then
            MONGO_IMAGE=$(grep "^MONGO_IMAGE=" .env | cut -d= -f2)
            log "MONGO_IMAGE do .env existente: $MONGO_IMAGE"
        else
            # Atualiza MONGO_IMAGE no .env existente
            echo "" >> .env
            echo "MONGO_IMAGE=$MONGO_IMAGE" >> .env
        fi
        ENV_EXISTS=true
    else
        cp .env ".env.backup.$(date +%Y%m%d_%H%M%S)"
        ENV_EXISTS=false
    fi
else
    ENV_EXISTS=false
fi

if [[ "$ENV_EXISTS" != "true" ]]; then
    log "Gerando senhas seguras..."

    MONGO_ROOT_PASS=$(gen_password 24)
    REDIS_PASS=$(gen_password 24)
    JWT_SECRET=$(gen_hex 32)
    JWT_REFRESH_SECRET=$(gen_hex 32)
    ENCRYPTION_KEY=$(gen_hex 16)   # 32 chars hex = 16 bytes
    SESSION_SECRET=$(gen_hex 32)

    log "Criando .env com senhas geradas automaticamente..."

    cat > .env << ENVEOF
# =============================================================================
# BR10ACS — Configuração de Produção
# Gerado automaticamente em: $(date '+%d/%m/%Y %H:%M:%S')
# ATENÇÃO: Não compartilhe este arquivo. Contém senhas e segredos.
# =============================================================================

# ─── Aplicação ────────────────────────────────────────────────────────────────
NODE_ENV=production
APP_NAME=BR10ACS
TZ=America/Sao_Paulo

# ─── Portas públicas ──────────────────────────────────────────────────────────
API_PORT=8080
CWMP_PORT=7547

# ─── MongoDB ──────────────────────────────────────────────────────────────────
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=${MONGO_ROOT_PASS}
MONGO_IMAGE=${MONGO_IMAGE}

# ─── Redis ────────────────────────────────────────────────────────────────────
REDIS_PASSWORD=${REDIS_PASS}

# ─── JWT / Segurança ──────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_EXPIRES_IN=7d

# ─── Criptografia ─────────────────────────────────────────────────────────────
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# ─── Sessão ───────────────────────────────────────────────────────────────────
SESSION_SECRET=${SESSION_SECRET}
SESSION_EXPIRE_SECONDS=3600

# ─── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGINS=http://${SERVER_IP}:8080,http://localhost:8080,http://localhost:3000

# ─── GenieACS ─────────────────────────────────────────────────────────────────
GENIEACS_NBI_USERNAME=
GENIEACS_NBI_PASSWORD=

# ─── Coletor de dados ─────────────────────────────────────────────────────────
COLLECTOR_INTERVAL=300
COLLECTOR_HISTORY_INTERVAL=3600
COLLECTOR_OFFLINE_AFTER=900

# ─── Logs ─────────────────────────────────────────────────────────────────────
LOG_LEVEL=info

# ─── Swagger ──────────────────────────────────────────────────────────────────
SWAGGER_ENABLED=true
SWAGGER_PATH=api/docs

# ─── OpenAI (opcional — pode ser configurado pela interface web) ───────────────
# OPENAI_API_KEY=sk-proj-...
# OPENAI_API_BASE=https://api.openai.com/v1

# ─── Telegram Bot (opcional) ──────────────────────────────────────────────────
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_CHAT_ID=

# ─── WhatsApp Business (opcional) ─────────────────────────────────────────────
# WHATSAPP_API_URL=
# WHATSAPP_API_TOKEN=
# WHATSAPP_PHONE_NUMBER_ID=

# ─── Atualização do Sistema ────────────────────────────────────────────────────────────────────────────────────
PROJECT_DIR=${SCRIPT_DIR}
ENVEOF

    success ".env criado com senhas seguras"
    chmod 600 .env
fi

# ─── ETAPA 4: Build e subida dos containers ───────────────────────────────────
step "Etapa 4/6 — Build e inicialização dos containers"

log "Baixando imagens Docker (pode demorar na primeira execução)..."
docker compose pull --quiet 2>/dev/null || true

log "Construindo imagem da API..."
docker compose build --quiet br10acs-api

log "Iniciando todos os serviços..."
docker compose up -d --remove-orphans

success "Containers iniciados"

# ─── ETAPA 5: Aguardar serviços ───────────────────────────────────────────────
step "Etapa 5/6 — Aguardando serviços ficarem saudáveis"

wait_healthy() {
    local service=$1
    local max_wait=${2:-120}
    local elapsed=0
    local interval=5

    echo -n "  Aguardando $service"
    while [[ $elapsed -lt $max_wait ]]; do
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "br10acs-$service" 2>/dev/null || true)
        RUNNING=$(docker inspect --format='{{.State.Running}}' "br10acs-$service" 2>/dev/null || echo "false")
        # healthy: container com healthcheck passou
        # string vazia ou none + running: container sem healthcheck (ex: Redis) — considera saudável se estiver rodando
        if [[ "$HEALTH" == "healthy" ]] || { [[ -z "$HEALTH" || "$HEALTH" == "none" ]] && [[ "$RUNNING" == "true" ]]; }; then
            echo -e " ${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    echo -e " ${YELLOW}timeout (verificar logs: docker logs br10acs-$service)${NC}"
    return 1
}

wait_healthy "mongodb" 120
wait_healthy "redis" 30
sleep 10  # Aguarda GenieACS inicializar
wait_healthy "api" 120

# ─── ETAPA 6: Resumo ──────────────────────────────────────────────────────────
step "Etapa 6/6 — Instalação concluída"

# Lê valores do .env para exibição
source .env 2>/dev/null || true
API_PORT=${API_PORT:-8080}
CWMP_PORT=${CWMP_PORT:-7547}

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║           BR10ACS — INSTALAÇÃO CONCLUÍDA COM SUCESSO        ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Acesso à Interface Web:${NC}"
echo -e "    URL: ${CYAN}http://${SERVER_IP}:${API_PORT}${NC}"
echo ""
echo -e "  ${BOLD}Portas dos Serviços:${NC}"
echo -e "    API / Interface Web : ${CYAN}${SERVER_IP}:${API_PORT}${NC}"
echo -e "    CWMP (TR-069 ONTs)  : ${CYAN}${SERVER_IP}:${CWMP_PORT}${NC}"
echo -e "    GenieACS NBI        : ${CYAN}127.0.0.1:7557${NC} (apenas local)"
echo -e "    GenieACS UI         : ${CYAN}127.0.0.1:3000${NC} (apenas local)"
echo ""
echo -e "  ${BOLD}Containers ativos:${NC}"
docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | tail -n +2 | \
    while IFS= read -r line; do echo "    $line"; done
echo ""
echo -e "  ${BOLD}${YELLOW}IMPORTANTE — Guarde estas informações com segurança:${NC}"
echo -e "  ${YELLOW}As senhas estão salvas em: $(pwd)/.env${NC}"
echo ""
echo -e "  ${BOLD}Comandos úteis:${NC}"
echo -e "    Ver logs:     ${CYAN}docker compose logs -f br10acs-api${NC}"
echo -e "    Reiniciar:    ${CYAN}docker compose restart${NC}"
echo -e "    Parar:        ${CYAN}docker compose down${NC}"
echo -e "    Atualizar:    ${CYAN}git pull && docker compose up -d --build${NC}"
echo ""
echo -e "  ${BOLD}Documentação:${NC}"
echo -e "    README Servidor Novo:      ${CYAN}README_INSTALACAO.md${NC}"
echo -e "    README Servidor Existente: ${CYAN}README_ATUALIZACAO.md${NC}"
echo ""
