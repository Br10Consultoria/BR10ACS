# Integração WhatsApp Business (Atendente Digital)

O BR10ACS possui uma integração nativa com a **WhatsApp Business Cloud API (Meta)**, permitindo que os clientes do provedor realizem autoatendimento diretamente pelo WhatsApp, sem intervenção humana.

## Funcionalidades do Atendente Digital

- **Identificação Segura**: O cliente se identifica informando o Login PPPoE ou CPF/CNPJ. O sistema valida contra a base do ERP (IXC).
- **Troca de Senha WiFi**: Altera a senha das redes 2.4GHz e 5GHz via TR-069.
- **Troca de Senha PPPoE**: Atualiza as credenciais PPPoE diretamente na ONT.
- **Status da Conexão**: Exibe sinal óptico, IP WAN, status da porta e uptime.
- **Reboot Remoto**: Permite reiniciar a ONT com confirmação.
- **Dados do Contrato**: Consulta plano, vencimento e status financeiro no IXC.

## Arquitetura

A integração utiliza a **Graph API v20.0+** da Meta e opera 100% via Webhooks.

1. **Recepção**: O cliente envia uma mensagem. A Meta chama o endpoint `POST /api/v1/whatsapp/webhook`.
2. **Sessão**: O BR10ACS cria/atualiza uma sessão no MongoDB (coleção `whatsapp_sessions`), com expiração de 1 hora.
3. **Fluxo (State Machine)**: O estado da conversa dita a próxima ação (ex: `AWAITING_LOGIN`, `AWAITING_WIFI_PASSWORD`, `MAIN_MENU`).
4. **Integração IXC**: Para identificar o cliente, o módulo consome o `IxcService` (`lookupRadUser` e `lookupOntComplete`).
5. **Ação TR-069**: Com o `deviceId` em mãos, o bot comanda o `GenieAcsService` (ex: `setParameterValues` ou `reboot`).
6. **Resposta**: O bot responde ao cliente usando o endpoint `/messages` da Graph API.

---

## Como Configurar (Passo a Passo)

### 1. Criar o App na Meta for Developers
1. Acesse [developers.facebook.com](https://developers.facebook.com) e crie um App do tipo **Business**.
2. Adicione o produto **WhatsApp** ao seu App.
3. Em **WhatsApp → Configuração da API**, copie o **Phone Number ID**.
4. Crie um Token Permanente (System User Access Token) com a permissão `whatsapp_business_messaging`.

### 2. Configurar no BR10ACS
1. Acesse o painel do BR10ACS e vá em **Administração → WhatsApp Bot**.
2. Preencha o **Phone Number ID** e o **Access Token**.
3. Clique em **Gerar** no campo "Verify Token" e copie o valor.
4. Salve as configurações e clique em **Verificar Conexão** para testar.

### 3. Configurar o Webhook na Meta
1. Volte ao painel da Meta, em **WhatsApp → Configuração**.
2. Clique em **Configurar Webhook**.
3. **URL de Retorno**: `https://<seu-dominio-br10acs>/api/v1/whatsapp/webhook`
4. **Token de Verificação**: Cole o "Verify Token" gerado no BR10ACS.
5. Em "Campos de Webhook", inscreva-se em **`messages`**.

---

## API REST Reference

Todos os endpoints estão sob o prefixo `/api/v1/whatsapp`.

| Endpoint | Método | Auth | Descrição |
|---|---|---|---|
| `/webhook` | `GET` | Público | Validação inicial do Webhook pela Meta (hub.challenge). |
| `/webhook` | `POST` | Público | Recebe as mensagens e eventos do WhatsApp. |
| `/config` | `GET` | JWT (Admin) | Retorna as configurações atuais (mascarando o token). |
| `/config` | `PUT` | JWT (Admin) | Atualiza as configurações e credenciais da API. |
| `/info` | `GET` | JWT (Admin) | Valida a conexão com a Meta e retorna dados do número. |
| `/stats` | `GET` | JWT (Admin) | Retorna o total de sessões e sessões ativas (última hora). |
| `/test-message` | `POST` | JWT (Admin) | Envia uma mensagem de teste para um número específico. |

### Payload de Teste (`POST /test-message`)
```json
{
  "phone": "5511999999999",
  "message": "Mensagem de teste opcional"
}
```

---

## Logs e Auditoria

Todas as ações críticas realizadas pelos clientes via WhatsApp geram logs de auditoria na categoria `SYSTEM` e podem ser visualizadas na página de Logs do sistema:

- `whatsapp_wifi_password_change`: "Senha WiFi alterada via WhatsApp (rede: SSID, cliente: login)"
- `whatsapp_pppoe_password_change`: "Senha PPPoE alterada via WhatsApp (cliente: login)"
- `whatsapp_reboot`: "Reboot solicitado via WhatsApp (cliente: login)"

O histórico completo de mensagens trocadas com o bot fica armazenado no documento da sessão na coleção `whatsapp_sessions`.
