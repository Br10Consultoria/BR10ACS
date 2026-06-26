# ─── Stage 1: Build do Frontend React ────────────────────────────────────────
FROM node:22-alpine AS web-builder

WORKDIR /web

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

# Copiar dependências do frontend
COPY web/package.json web/pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile --ignore-scripts

# Copiar código do frontend
COPY web/ ./

RUN pnpm run build

# ─── Stage 2: Build do Backend NestJS ────────────────────────────────────────
FROM node:22-alpine AS api-builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

COPY api/package.json api/pnpm-lock.yaml* ./

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY api/tsconfig.json ./
COPY api/src ./src

RUN pnpm run build

# ─── Stage 3: Imagem de produção ─────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

# Dependências de produção do backend
COPY api/package.json api/pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Backend compilado
COPY --from=api-builder /app/dist ./dist
COPY --from=api-builder /app/tsconfig.json ./

# Frontend compilado (servido pelo ServeStaticModule)
COPY --from=web-builder /web/dist ./web/dist

# Diretório de dados persistentes
RUN mkdir -p /app/data

# Instalar wget para healthcheck
RUN apk add --no-cache wget

# Usuário não-root para segurança
RUN addgroup -S br10acs && adduser -S br10acs -G br10acs
RUN chown -R br10acs:br10acs /app
USER br10acs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "-r", "tsconfig-paths/register", "dist/main"]
