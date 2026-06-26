FROM node:22-alpine AS builder

WORKDIR /app

# Instalar pnpm com versão exata
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

# Copiar arquivos de dependências
COPY package.json pnpm-lock.yaml* ./

# Instalar todas as dependências (dev + prod para build)
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copiar código fonte
COPY tsconfig.json ./
COPY src ./src

# Compilar TypeScript
RUN pnpm run build

# ─── Imagem de produção ───────────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

# Copiar apenas o necessário para produção
COPY package.json pnpm-lock.yaml* ./

# Instalar apenas dependências de produção
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copiar build compilado
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/tsconfig.json ./

# Criar diretório de dados
RUN mkdir -p /app/data

# Instalar wget para healthcheck
RUN apk add --no-cache wget

# Usuário não-root para segurança
RUN addgroup -S br10acs && adduser -S br10acs -G br10acs
RUN chown -R br10acs:br10acs /app
USER br10acs

EXPOSE 3000

CMD ["node", "-r", "tsconfig-paths/register", "dist/main"]
