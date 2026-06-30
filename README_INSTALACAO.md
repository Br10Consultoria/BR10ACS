# Guia de Instalação do Servidor BR10ACS (Servidor Novo)

Este guia orienta a instalação completa do **BR10ACS** e todos os seus serviços dependentes em um servidor limpo (sem containers pré-existentes).

A instalação agora é 100% automatizada e orquestrada por um único script.

## 1. Requisitos do Sistema

- **Sistema Operacional:** Ubuntu 22.04 LTS ou 24.04 LTS (recomendado)
- **Processador:** 2 vCPUs ou mais
  - *Nota sobre AVX:* Processadores modernos possuem instruções AVX. Se você estiver usando VMs antigas, Proxmox sem repasse de CPU host, ou KVM antigo, o script detectará automaticamente a falta de AVX e usará o MongoDB 4.4 em vez do 7.0.
- **Memória RAM:** 4GB ou mais
- **Armazenamento:** 20GB ou mais de espaço livre
- **Acesso:** Usuário `root` ou com privilégios `sudo`

## 2. Passo a Passo da Instalação

Acesse o servidor via SSH e execute os comandos abaixo:

### Passo 2.1: Instalar o Git
```bash
sudo apt update
sudo apt install -y git
```

### Passo 2.2: Clonar o Repositório
```bash
git clone https://github.com/Br10Consultoria/BR10ACS.git
cd BR10ACS
```

### Passo 2.3: Executar o Instalador Automático
O script `instalar.sh` fará todo o trabalho pesado para você:
```bash
chmod +x instalar.sh
sudo ./instalar.sh
```

## 3. O que o script instalador faz?

1. **Detecta a CPU:** Verifica se há suporte a instruções AVX para definir a versão correta do MongoDB.
2. **Instala o Docker:** Baixa e instala o Docker e o plugin Docker Compose (se não estiverem instalados).
3. **Gera Senhas Seguras:** Cria um arquivo `.env` preenchendo automaticamente senhas criptografadas para MongoDB, Redis, JWT e tokens.
4. **Constrói e Inicia:** Faz o build da API do BR10ACS e sobe todos os 7 containers na mesma rede isolada (`br10acs_net`).
5. **Aguardar Saúde:** Monitora os containers até que o banco de dados e a API estejam prontos para receber conexões.

## 4. Acesso ao Sistema

Ao final da instalação, o script exibirá um resumo na tela.

- **Acesso à Interface Web:** `http://SEU_IP_DO_SERVIDOR:8080`
- **URL CWMP (para as ONTs):** `http://SEU_IP_DO_SERVIDOR:7547`

As senhas geradas automaticamente estão salvas no arquivo `.env` na pasta do projeto. Guarde este arquivo com segurança.

## 5. Comandos Úteis de Manutenção

Se precisar gerenciar o servidor no futuro:

- **Ver logs da API:** `docker compose logs -f br10acs-api`
- **Ver status dos containers:** `docker compose ps`
- **Reiniciar todos os serviços:** `docker compose restart`
- **Parar o servidor:** `docker compose down`

## 6. Configuração da IA (Opcional)

Se desejar usar o recurso de Análise Inteligente de ONTs:
1. Acesse o sistema web
2. Vá em **Análise IA** > **Configurar IA**
3. Insira sua chave de API da OpenAI (`sk-proj-...`)
4. A chave será salva criptografada no banco de dados, sem necessidade de editar arquivos no servidor.
