# Guia de Atualização do Servidor BR10ACS (Servidor Existente)

Este guia é destinado a servidores que **já possuem** o BR10ACS ou o GenieACS rodando em containers Docker.

## 1. Como Atualizar o Sistema

Para baixar as últimas novidades (como o novo botão de atualização de firmware e a correção da IA) e aplicar no servidor, criamos um script automatizado.

Acesse o servidor via SSH, vá até a pasta do projeto e execute:

```bash
cd /caminho/para/o/BR10ACS
chmod +x atualizar.sh
sudo ./atualizar.sh
```

## 2. O que o script de atualização faz?

1. **Verifica o `.env`:** Garante que suas senhas e configurações atuais sejam mantidas.
2. **Backup de Segurança:** Tenta fazer um dump do banco de dados `br10` (MongoDB) e salva na pasta `backups/` antes de mexer em qualquer coisa.
3. **Atualiza o Código:** Executa `git pull` para baixar as últimas alterações do repositório.
4. **Rebuild:** Constrói novamente a imagem Docker da API com as novidades.
5. **Reinicia:** Reinicia os containers aplicando as novas imagens, sem perder os dados (os volumes são mantidos).

## 3. Transição para a Arquitetura Unificada

Se o seu servidor antigo possuía o GenieACS rodando em uma rede separada (`geniacs_geniacs_internal`) e o BR10ACS em outra, o novo `docker-compose.yml` unifica todos os serviços na rede `br10acs_net`.

Se você quiser migrar para essa nova arquitetura limpa (recomendado):

1. Faça backup dos seus dados se necessário.
2. Pare os containers antigos: `docker compose down` (ou `docker-compose down` se for a versão antiga).
3. Execute o script de instalação do zero:
   ```bash
   sudo ./instalar.sh
   ```
   *Nota: O script perguntará se você deseja manter o `.env` atual. Responda "s" (sim) para manter suas senhas antigas.*

## 4. Nota sobre Processadores sem AVX

Se o seu servidor roda em uma VM antiga, Proxmox sem repasse de CPU host (`host` cpu type), ou KVM antigo, o processador pode não ter suporte a instruções AVX.

O MongoDB versão 5.0 ou superior **exige** AVX e o container ficará reiniciando infinitamente (restarting) se a CPU não suportar.

**Como corrigir se isso acontecer:**
1. Abra o arquivo `.env`: `nano .env`
2. Encontre a linha `MONGO_IMAGE=mongo:7` e mude para `MONGO_IMAGE=mongo:4.4`
3. Rode novamente: `docker compose up -d`

*(O script `instalar.sh` já faz essa detecção automaticamente para novas instalações).*
