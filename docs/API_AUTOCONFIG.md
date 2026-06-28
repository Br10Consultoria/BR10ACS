# Referência da API: AutoConfig — Reconfiguração Automática de ONT

Este documento descreve os endpoints REST do módulo **AutoConfig** do BR10ACS, com foco na funcionalidade de reconfiguração automática de ONTs após reset de fábrica via evento TR-069 `BOOTSTRAP` e variáveis dinâmicas integradas ao IXC Soft.

> **Autenticação:** Todos os endpoints requerem o header `Authorization: Bearer <token>` obtido via `POST /api/v1/auth/login`. Os endpoints de escrita exigem perfil `ADMIN` ou `SUPER_ADMIN`.

---

## Endpoints

### `GET /api/v1/autoconfig`

Retorna todas as regras de AutoConfig cadastradas, ordenadas por prioridade decrescente.

**Resposta `200 OK`:**

```json
[
  {
    "_id": "6673a1b2c3d4e5f6a7b8c9d0",
    "name": "Reconfigurar ONT após reset",
    "enabled": true,
    "priority": 90,
    "conditions": {
      "oui": "E8:65:D4",
      "tr069Event": "BOOTSTRAP"
    },
    "parameters": [
      {
        "name": "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username",
        "value": "${ixc.pppoe_login}",
        "type": "xsd:string"
      },
      {
        "name": "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password",
        "value": "${ixc.pppoe_password}",
        "type": "xsd:string"
      }
    ],
    "tagsToAdd": ["reconfigurado"],
    "ixcIntegrationId": null,
    "stats": {
      "applied": 14,
      "errors": 0,
      "lastApplied": "2026-06-27T20:00:00.000Z"
    }
  }
]
```

---

### `POST /api/v1/autoconfig`

Cria uma nova regra de AutoConfig. Requer perfil `ADMIN` ou `SUPER_ADMIN`.

**Corpo da requisição:**

```json
{
  "name": "Reconfigurar ONT após reset",
  "priority": 90,
  "enabled": true,
  "conditions": {
    "oui": "E8:65:D4",
    "model": "1200R",
    "firmwareVersion": "",
    "serialPattern": "",
    "tr069Event": "BOOTSTRAP"
  },
  "parameters": [
    {
      "name": "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username",
      "value": "${ixc.pppoe_login}",
      "type": "xsd:string"
    },
    {
      "name": "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password",
      "value": "${ixc.pppoe_password}",
      "type": "xsd:string"
    },
    {
      "name": "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
      "value": "${ixc.wifi_ssid}",
      "type": "xsd:string"
    },
    {
      "name": "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey",
      "value": "${ixc.wifi_password}",
      "type": "xsd:string"
    }
  ],
  "tagsToAdd": ["reconfigurado"],
  "ixcIntegrationId": null
}
```

**Campos do objeto `conditions`:**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `oui` | `string` | Não | OUI do fabricante (ex: `E8:65:D4` para Intelbras). Correspondência exata. |
| `model` | `string` | Não | Modelo do equipamento. Correspondência parcial (contém). |
| `firmwareVersion` | `string` | Não | Versão do firmware. Correspondência parcial (contém). |
| `serialPattern` | `string` | Não | Regex aplicada ao serial number. Ex: `^ITBS.*` |
| `tr069Event` | `string` | Não | Evento TR-069 que aciona a regra. Ver tabela de eventos abaixo. |

**Valores válidos para `tr069Event`:**

| Valor | Evento TR-069 | Quando ocorre |
|---|---|---|
| `BOOTSTRAP` | `0 BOOTSTRAP` | ONT ligou após reset de fábrica (primeira comunicação) |
| `BOOT` | `1 BOOT` | ONT reiniciou normalmente (reboot sem reset) |
| `PERIODIC` | `2 PERIODIC` | Inform periódico (conforme `PeriodicInformInterval`) |
| `VALUE_CHANGE` | `4 VALUE CHANGE` | Um parâmetro monitorado mudou de valor |
| `ANY` | Qualquer evento | Regra aplicada em qualquer tipo de inform |
| *(ausente)* | Qualquer evento | Comportamento idêntico a `ANY` |

**Resposta `201 Created`:** objeto da regra criada.

---

### `PUT /api/v1/autoconfig/:id`

Atualiza uma regra existente. Aceita os mesmos campos do `POST`. Requer perfil `ADMIN` ou `SUPER_ADMIN`.

**Resposta `200 OK`:** objeto da regra atualizada.

---

### `DELETE /api/v1/autoconfig/:id`

Remove uma regra. Requer perfil `ADMIN` ou `SUPER_ADMIN`.

**Resposta `204 No Content`.**

---

### `GET /api/v1/autoconfig/dry-run/:deviceId`

Simula quais regras seriam aplicadas a um dispositivo **sem executar nenhuma ação**. Útil para validar regras antes de ativá-las.

**Parâmetros:**

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `deviceId` | `string` | ID do dispositivo no GenieACS (ex: `E8:65:D4-1200R-ITBS4458240D`) |

**Resposta `200 OK`:**

```json
{
  "deviceId": "E8:65:D4-1200R-ITBS4458240D",
  "manufacturer": "INTELBRAS",
  "model": "1200R",
  "oui": "E8:65:D4",
  "matches": [
    {
      "rule": "Reconfigurar ONT após reset",
      "id": "6673a1b2c3d4e5f6a7b8c9d0",
      "parameters": 4,
      "tags": ["reconfigurado"],
      "hasVariables": true
    }
  ],
  "total": 1
}
```

---

### `POST /api/v1/autoconfig/apply/:deviceId`

Aplica as regras de AutoConfig a um dispositivo específico **imediatamente**. Este endpoint é chamado internamente pelo sistema quando o GenieACS notifica um evento `BOOTSTRAP`. Pode ser chamado manualmente para forçar a reconfiguração.

**Parâmetros:**

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `deviceId` | `string` | ID do dispositivo no GenieACS |

**Resposta `200 OK`:**

```json
{
  "applied": 1,
  "skipped": 0,
  "errors": 0,
  "rules": ["Reconfigurar ONT após reset"]
}
```

---

### `POST /api/v1/autoconfig/apply-all`

Força a execução de todas as regras em todos os dispositivos cadastrados. Equivale a acionar manualmente o cron job horário. Requer perfil `ADMIN` ou `SUPER_ADMIN`.

**Resposta `200 OK`:**

```json
{
  "processed": 8,
  "applied": 3,
  "errors": 0
}
```

---

### `POST /api/v1/autoconfig/apply-auto-tags`

Aplica tags automáticas (fabricante, modelo, firmware) em todos os dispositivos. As tags seguem o padrão `intelbras`, `1200r` e `fw:2.2-250203`. Requer perfil `ADMIN` ou `SUPER_ADMIN`.

**Resposta `200 OK`:**

```json
{
  "processed": 8,
  "tagged": 8
}
```

---

### `GET /api/v1/autoconfig/stats`

Retorna estatísticas globais do módulo de AutoConfig.

**Resposta `200 OK`:**

```json
{
  "totalRules": 3,
  "activeRules": 2,
  "totalApplied": 47,
  "totalErrors": 1,
  "lastApplied": "2026-06-27T21:00:00.000Z"
}
```

---

## Variáveis Dinâmicas

Ao definir o campo `value` de um parâmetro TR-069 em uma regra de AutoConfig, você pode usar variáveis dinâmicas que são resolvidas pelo `AutoConfigService` **antes** de enviar o `setParameterValues` ao GenieACS. Isso permite que a regra reconfigure a ONT com os dados reais do cliente, sem precisar hardcodar valores.

### Tabela de Variáveis

| Variável | Descrição | Fonte de Dados |
|---|---|---|
| `${ixc.pppoe_login}` | Login PPPoE do cliente | IXC Soft — busca pelo MAC da ONT em `/webservice/v1/radusuarios` |
| `${ixc.pppoe_password}` | Senha PPPoE do cliente | IXC Soft — campo `senha` ou `cleartext_password` do radusuario |
| `${ixc.wifi_ssid}` | SSID WiFi 2.4GHz | GenieACS — último valor lido do parâmetro `WLANConfiguration.1.SSID` |
| `${ixc.wifi_password}` | Senha WiFi 2.4GHz | GenieACS — último valor lido do parâmetro `WLANConfiguration.1.PreSharedKey.1.PreSharedKey` |
| `${ixc.wifi_ssid_5g}` | SSID WiFi 5GHz | GenieACS — último valor lido do parâmetro `WLANConfiguration.5.SSID` |
| `${ixc.vlan_pppoe}` | VLAN PPPoE do contrato | IXC Soft — campo `vlan` do contrato do cliente |
| `${device.serialNumber}` | Serial number da ONT | GenieACS — campo `DeviceID.SerialNumber` |
| `${device.manufacturer}` | Fabricante da ONT | GenieACS — campo `DeviceID.Manufacturer` |
| `${device.model}` | Modelo da ONT | GenieACS — campo `DeviceID.ProductClass` |
| `${device.softwareVersion}` | Versão do firmware | GenieACS — campo `DeviceInfo.SoftwareVersion` |
| `${param.CAMINHO_COMPLETO}` | Qualquer parâmetro TR-069 | GenieACS — substitui `CAMINHO_COMPLETO` pelo path TR-069 desejado |

### Comportamento de Fallback

Se uma variável não puder ser resolvida (ex: IXC não retornou o login, ou o parâmetro não existe no GenieACS), o valor **permanece como está** — a variável literal é enviada ao GenieACS. Como o GenieACS valida o tipo do parâmetro, um valor inválido como `${ixc.pppoe_login}` será rejeitado e o parâmetro **não será alterado** na ONT. Isso garante que uma falha na consulta ao IXC nunca sobrescreva uma configuração válida com um valor vazio.

### Exemplo: Reconfiguração Completa com Variáveis

```json
{
  "name": "Reconfigurar ONT Intelbras após reset",
  "priority": 90,
  "enabled": true,
  "conditions": {
    "oui": "E8:65:D4",
    "tr069Event": "BOOTSTRAP"
  },
  "parameters": [
    {
      "name": "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username",
      "value": "${ixc.pppoe_login}",
      "type": "xsd:string"
    },
    {
      "name": "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password",
      "value": "${ixc.pppoe_password}",
      "type": "xsd:string"
    },
    {
      "name": "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ConnectionTrigger",
      "value": "AlwaysOn",
      "type": "xsd:string"
    },
    {
      "name": "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
      "value": "${ixc.wifi_ssid}",
      "type": "xsd:string"
    },
    {
      "name": "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey",
      "value": "${ixc.wifi_password}",
      "type": "xsd:string"
    },
    {
      "name": "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID",
      "value": "${ixc.wifi_ssid_5g}",
      "type": "xsd:string"
    },
    {
      "name": "InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.PreSharedKey",
      "value": "${ixc.wifi_password}",
      "type": "xsd:string"
    }
  ],
  "tagsToAdd": ["reconfigurado"],
  "ixcIntegrationId": null
}
```

---

## Fluxo Interno: Reconfiguração Pós-Reset

O diagrama abaixo descreve o fluxo interno completo quando uma ONT envia o evento `BOOTSTRAP`:

```
ONT reseta
    │
    ▼
GenieACS recebe "0 BOOTSTRAP"
    │
    ▼
BR10ACS CollectorService detecta o evento
    │
    ▼
AutoConfigService.applyToDevice(deviceId, 'BOOTSTRAP')
    │
    ├── matchesConditions(rule, device, 'BOOTSTRAP')
    │       ├── Verifica OUI / modelo / firmware / serial
    │       └── Verifica tr069Event === 'BOOTSTRAP' ✓
    │
    ├── resolveParameterValues(parameters, deviceId, ixcIntegrationId)
    │       ├── buildVariableContext(deviceId, ixcIntegrationId)
    │       │       ├── GenieACS: lê parâmetros atuais da ONT (SSID, WiFi, etc.)
    │       │       ├── IxcService.lookupRadUser(mac) → obtém login PPPoE
    │       │       └── IxcService.getRadUserPassword(login) → obtém senha PPPoE
    │       └── interpolate(value, context) → substitui ${...} pelos valores reais
    │
    ├── GenieAcsService.setParameterValues(deviceId, resolvedParameters)
    │       └── TR-069: setParameterValues enviado à ONT
    │
    └── GenieAcsService.addTag(deviceId, 'reconfigurado')

ONT reconecta com PPPoE e WiFi configurados ✓
```

---

## Configuração Necessária

Para que a reconfiguração automática funcione, os seguintes pré-requisitos devem estar atendidos:

| Requisito | Onde Configurar | Observação |
|---|---|---|
| Integração IXC ativa | `Configurações → Integrações` | Token de API com permissão de leitura em `radusuarios` |
| ONT com URL do ACS no firmware | Firmware de fábrica da operadora | A ONT precisa saber o endereço do ACS após o reset |
| Regra de AutoConfig com evento `BOOTSTRAP` | `Ferramentas → AutoConfig` | Criar conforme exemplo acima |
| IP do servidor ACS acessível pela ONT | Infraestrutura de rede | VLAN de gerência ou DHCP Option 43 |

---

## Notas sobre a API do IXC Soft

O campo de senha PPPoE no IXC Soft pode variar conforme a versão e as permissões do token de API. O `IxcService.getRadUserPassword()` tenta os seguintes campos nessa ordem:

1. `senha`
2. `password`
3. `cleartext_password`
4. `rad_passwd`

Se nenhum campo retornar valor, a variável `${ixc.pppoe_password}` não é substituída e o parâmetro de senha na ONT não é alterado. Para verificar quais campos estão disponíveis na sua versão do IXC, acesse `GET /webservice/v1/radusuarios?limit=1` com o token de API e inspecione o JSON retornado.
