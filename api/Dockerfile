FROM node:22-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar arquivos de dependências
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Instalar dependências
RUN pnpm install --frozen-lockfile

# Copiar código fonte
COPY tsconfig.json ./
COPY src ./src

# Compilar TypeScript
RUN pnpm run build

# ─── Imagem de produção ───────────────────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar apenas o necessário para produção
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/tsconfig.json ./

# Criar diretório de dados
RUN mkdir -p /app/data

# Usuário não-root
RUN addgroup -S br10acs && adduser -S br10acs -G br10acs
RUN chown -R br10acs:br10acs /app
USER br10acs

EXPOSE 3000

CMD ["node", "-r", "tsconfig-paths/register", "dist/main"]
