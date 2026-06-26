#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# BR10ACS — Script de deploy no servidor bot-enter
# Uso: ./deploy.sh [--seed-admin]
# ─────────────────────────────────────────────────────────────────────────────

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[BR10ACS]${NC} $1"; }
warn() { echo -e "${YELLOW}[AVISO]${NC} $1"; }
err()  { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }

echo -e "\n${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        BR10ACS — Deploy              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}\n"

# ─── Verificações pré-deploy ──────────────────────────────────────────────────
log "Verificando pré-requisitos..."

[ -f "api/.env" ] || err "Arquivo api/.env não encontrado. Execute: cp api/.env.example api/.env"

# Verificar se a rede do GENIACS existe
GENIACS_NET=$(docker network ls --format "{{.Name}}" | grep -i "geniacs_default" || true)
if [ -z "$GENIACS_NET" ]; then
  warn "Rede geniacs_default não encontrada. Verificando redes disponíveis..."
  docker network ls --format "{{.Name}}" | grep -i geniacs || true
  err "Rede do GENIACS não encontrada. Verifique se os containers do GENIACS estão rodando."
fi
log "Rede geniacs_default encontrada ✓"

# Verificar se o MongoDB do GENIACS está acessível
MONGO_RUNNING=$(docker ps --format "{{.Names}}" | grep "geniacs-mongodb-1" || true)
[ -n "$MONGO_RUNNING" ] || err "Container geniacs-mongodb-1 não está rodando."
log "MongoDB do GENIACS acessível ✓"

# Verificar se o NBI está acessível
NBI_RUNNING=$(docker ps --format "{{.Names}}" | grep "geniacs-genieacs-nbi-1" || true)
[ -n "$NBI_RUNNING" ] || err "Container geniacs-genieacs-nbi-1 não está rodando."
log "GenieACS NBI acessível ✓"

# ─── Build e deploy ───────────────────────────────────────────────────────────
log "Construindo imagem Docker do BR10ACS..."
docker compose build --no-cache br10acs-api

log "Subindo containers..."
docker compose up -d

log "Aguardando BR10ACS inicializar (60s)..."
sleep 10

# Aguardar health check
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' br10acs-api 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    log "BR10ACS está saudável ✓"
    break
  fi
  echo -n "."
  sleep 5
  WAITED=$((WAITED + 5))
done

if [ "$STATUS" != "healthy" ]; then
  warn "Health check ainda não passou. Verificando logs..."
  docker logs br10acs-api --tail=30
fi

# ─── Seed do admin (opcional) ─────────────────────────────────────────────────
if [ "$1" = "--seed-admin" ]; then
  log "Criando usuário admin inicial..."
  docker exec -it br10acs-api node -r tsconfig-paths/register dist/scripts/seed-admin.js
fi

# ─── Status final ─────────────────────────────────────────────────────────────
echo ""
log "═══════════════════════════════════════"
log "Deploy concluído!"
log "═══════════════════════════════════════"
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "br10acs|geniacs|NAMES"
echo ""
log "API:     http://$(hostname -I | awk '{print $1}'):8080/api"
log "Swagger: http://$(hostname -I | awk '{print $1}'):8080/api/docs"
log "Health:  http://$(hostname -I | awk '{print $1}'):8080/api/health"
echo ""
