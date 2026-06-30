#!/usr/bin/env bash
# =============================================================================
# BR10ACS — Script de Atualização
# Para servidores com containers já em execução
#
# Uso:
#   chmod +x atualizar.sh
#   sudo ./atualizar.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${CYAN}[BR10ACS]${NC} $*"; }
success() { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
error()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }
step()    { echo -e "\n${BOLD}${BLUE}══ $* ══${NC}"; }

[[ $EUID -ne 0 ]] && error "Execute como root: sudo ./atualizar.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "\n${BOLD}${BLUE}  BR10ACS — Atualização de Servidor Existente${NC}"
echo -e "  $(date '+%d/%m/%Y %H:%M:%S')\n"

# ─── Verificar .env ───────────────────────────────────────────────────────────
step "Verificando configuração"

[[ ! -f ".env" ]] && error ".env não encontrado. Execute ./instalar.sh para instalação inicial."
source .env 2>/dev/null || true
success ".env carregado"

# ─── Verificar novos containers necessários ───────────────────────────────────
step "Verificando containers"

MISSING_CONTAINERS=()
for svc in mongodb redis genieacs-cwmp genieacs-nbi genieacs-fs genieacs-ui br10acs-api; do
    if ! docker ps --format '{{.Names}}' | grep -q "br10acs-$svc" 2>/dev/null; then
        MISSING_CONTAINERS+=("$svc")
    fi
done

if [[ ${#MISSING_CONTAINERS[@]} -gt 0 ]]; then
    warn "Containers faltando: ${MISSING_CONTAINERS[*]}"
    log "Serão criados automaticamente na atualização"
fi

# ─── Backup do banco ──────────────────────────────────────────────────────────
step "Backup de segurança"

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if docker ps --format '{{.Names}}' | grep -q "br10acs-mongodb" 2>/dev/null; then
    log "Fazendo backup do MongoDB..."
    docker exec br10acs-mongodb mongodump \
        --username "${MONGO_ROOT_USER:-admin}" \
        --password "${MONGO_ROOT_PASSWORD}" \
        --authenticationDatabase admin \
        --db br10 \
        --out /tmp/br10_backup 2>/dev/null && \
    docker cp br10acs-mongodb:/tmp/br10_backup "$BACKUP_DIR/mongodb" 2>/dev/null && \
    success "Backup salvo em: $BACKUP_DIR/mongodb" || \
    warn "Backup falhou — continuando sem backup (verifique manualmente)"
else
    warn "MongoDB não está rodando — pulando backup"
fi

# ─── Atualizar código ─────────────────────────────────────────────────────────
step "Atualizando código"

log "Baixando atualizações do repositório..."
git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || \
    warn "git pull falhou — usando código local"

# ─── Rebuild e restart ────────────────────────────────────────────────────────
step "Reconstruindo containers"

log "Baixando novas imagens..."
docker compose pull --quiet 2>/dev/null || true

log "Reconstruindo API..."
docker compose build --quiet br10acs-api

log "Reiniciando todos os serviços..."
docker compose up -d --remove-orphans

success "Containers atualizados"

# ─── Aguardar ─────────────────────────────────────────────────────────────────
step "Aguardando serviços"

echo -n "  Aguardando API ficar saudável"
for i in $(seq 1 24); do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "br10acs-api" 2>/dev/null || echo "starting")
    [[ "$STATUS" == "healthy" ]] && echo -e " ${GREEN}✓${NC}" && break
    echo -n "."
    sleep 5
    [[ $i -eq 24 ]] && echo -e " ${YELLOW}timeout${NC}"
done

# ─── Resumo ───────────────────────────────────────────────────────────────────
step "Atualização concluída"

SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
API_PORT=${API_PORT:-8080}

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║           BR10ACS — ATUALIZAÇÃO CONCLUÍDA                   ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Interface Web: ${CYAN}http://${SERVER_IP}:${API_PORT}${NC}"
echo ""
echo -e "  ${BOLD}Status dos containers:${NC}"
docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | tail -n +2 | \
    while IFS= read -r line; do echo "    $line"; done
echo ""
