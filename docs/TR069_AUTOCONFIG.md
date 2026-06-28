# Documentação Técnica: TR-069, Tags e AutoConfiguração

Este documento explica como o BR10ACS gerencia parâmetros TR-069, o uso de tags no GenieACS, e como configurar regras de provisionamento automático (AutoConfig) para reconfigurar ONTs após um reset de fábrica.

## 1. Sincronização de Parâmetros TR-069

Quando uma ONT é sincronizada (botão "Refresh" ou "Sync" no ACS), o GenieACS envia um comando `GetParameterValues` via protocolo TR-069 para o equipamento.

### Onde os parâmetros ficam armazenados?
- **Banco de Dados do GenieACS (MongoDB interno):** Todos os parâmetros lidos da ONT são armazenados na coleção `devices` do banco de dados do GenieACS.
- **Cache e TimeSeries (BR10ACS):** O backend do BR10ACS (via `CollectorService`) lê periodicamente esses dados do GenieACS e salva snapshots no banco de dados próprio (`br10_acs`, coleção `timeseries`). Isso é usado para gerar os gráficos de sinal óptico, tráfego e uso de CPU/RAM ao longo do tempo.

### Para que são utilizados posteriormente?
- **Histórico e Gráficos:** Para visualizar se o sinal óptico degradou na última semana ou se o tráfego aumentou.
- **Análise de IA:** O módulo de IA lê os parâmetros cacheados para sugerir diagnósticos (ex: "Sinal óptico crítico, verificar atenuação").
- **Condições de AutoConfig:** As regras de provisionamento automático avaliam os parâmetros armazenados (como `SoftwareVersion` ou `Manufacturer`) para decidir se uma regra deve ser aplicada.

---

## 2. O Papel das Tags no GenieACS

As tags são rótulos de texto simples anexados a um dispositivo no GenieACS.

### Utilidade das Tags
1. **Filtros Visuais:** Permitem encontrar facilmente grupos de dispositivos na listagem (ex: buscar todos com a tag `intelbras`).
2. **Condições de AutoConfig:** Você pode criar uma regra que só é aplicada se o dispositivo tiver (ou não tiver) uma determinada tag.
3. **Controle de Estado:** O principal uso em provisionamento é usar tags como "flags" de estado. Por exemplo, quando a ONT é configurada pela primeira vez, o ACS adiciona a tag `provisioned`. Se a ONT resetar e perder a configuração PPPoE, mas ainda tiver a tag `provisioned`, o sistema sabe que ela foi resetada e precisa ser reconfigurada.

### Tags Automáticas (Implementadas)
O BR10ACS agora aplica tags automaticamente em todos os dispositivos a cada hora (ou via endpoint manual), baseadas nos parâmetros lidos:
- **Fabricante:** Ex: `intelbras`, `huawei`, `zte`
- **Modelo:** Ex: `1200r`, `hg8245q2`
- **Firmware:** Ex: `fw:2.2-250203` (o prefixo `fw:` evita colisões com outras tags).

*(Nota: O bug onde o firmware era inserido incorretamente como tag no registro do dispositivo foi corrigido. Agora as tags de firmware usam o formato `fw:versao` e são gerenciadas pelo `AutoConfigService`.)*

---

## 3. Reconfiguração Automática Pós-Reset

Quando uma ONT sofre um reset de fábrica, ela perde as configurações de PPPoE, WiFi, etc. No entanto, ela **não perde a URL do ACS** (se estiver no firmware de fábrica da operadora/customizado) ou é descoberta novamente via DHCP Option 43/VLAN de gerência.

### Como o TR-069 identifica a ONT resetada?
Quando a ONT reseta e volta a falar com o ACS, ela envia um evento TR-069 chamado `0 BOOTSTRAP` ou `1 BOOT`.
O GenieACS identifica o equipamento unicamente pelo seu **Número de Série** (Serial Number) e **OUI** (MAC do fabricante). Mesmo resetada, a ONT envia o mesmo Serial.
Como o Serial é o mesmo, o GenieACS reconhece que é o mesmo dispositivo que já estava no banco de dados.

### Como recuperar os dados antigos (PPPoE, WiFi)?
O GenieACS em si **não guarda** o histórico do login PPPoE para reconfiguração nativa se o parâmetro for sobrescrito por vazio no reset.
Para automatizar isso, o fluxo correto é usar a **Integração com o ERP (IXC, SGP, etc.)**.

**Fluxo de AutoConfig com ERP:**
1. A ONT reseta e envia `0 BOOTSTRAP`.
2. O BR10ACS tem uma regra de AutoConfig configurada para rodar no evento `BOOTSTRAP`.
3. A regra identifica o Serial da ONT.
4. O `AutoConfigService` consulta a integração IXC usando o MAC da ONT: *"Qual é o login PPPoE e a senha WiFi do cliente que tem a ONT com este Serial/MAC?"*
5. O IXC retorna o login PPPoE. O serviço então consulta o IXC novamente para obter a senha PPPoE (`getRadUserPassword`).
6. O `AutoConfigService` resolve as variáveis dinâmicas (ex: `${ixc.pppoe_login}`) nos parâmetros da regra.
7. O BR10ACS envia os comandos TR-069 (`setParameterValues`) para reconfigurar o PPPoE e o WiFi.
8. O BR10ACS adiciona as tags configuradas (ex: `reconfigurado`).

### Variáveis Dinâmicas Suportadas

Ao configurar uma regra de AutoConfig, você pode usar variáveis dinâmicas no campo **Valor** dos parâmetros. O sistema as substitui pelo valor real antes de enviar à ONT.

| Variável | Descrição | Fonte |
|---|---|---|
| `${ixc.pppoe_login}` | Login PPPoE do cliente | IXC Soft (busca pelo MAC da ONT) |
| `${ixc.pppoe_password}` | Senha PPPoE do cliente | IXC Soft (busca no `radusuarios`) |
| `${ixc.wifi_ssid}` | SSID WiFi 2.4GHz anterior | GenieACS (último valor salvo) |
| `${ixc.wifi_password}` | Senha WiFi anterior | GenieACS (último valor salvo) |
| `${ixc.wifi_ssid_5g}` | SSID WiFi 5GHz anterior | GenieACS (último valor salvo) |
| `${ixc.vlan_pppoe}` | VLAN PPPoE cadastrada | IXC Soft |
| `${device.serialNumber}` | Serial number da ONT | GenieACS |
| `${device.manufacturer}` | Fabricante da ONT | GenieACS |
| `${device.model}` | Modelo da ONT | GenieACS |
| `${device.softwareVersion}` | Versão do firmware | GenieACS |
| `${param.CAMINHO}` | Qualquer parâmetro TR-069 | GenieACS (último valor salvo) |

> **Nota de Fallback:** Se o IXC não retornar um valor (ex: senha não encontrada), a variável **não é substituída**. O GenieACS recebe o valor literal `${ixc.pppoe_password}` e, como medida de segurança do protocolo, o parâmetro na ONT não é alterado, mantendo o valor que já tinha antes do reset.

### Modelos de Parâmetros de Auto-Configuração

Para configurar uma regra de AutoConfig no painel do BR10ACS, você precisa definir os caminhos TR-069 corretos para o fabricante. Abaixo estão os parâmetros mais comuns:

#### 1. Configuração de PPPoE (TR-098 Genérico / Intelbras / ZTE)
| Parâmetro TR-069 | Tipo | Valor Exemplo | Descrição |
|---|---|---|---|
| `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username` | string | `cliente@provedor` | Login PPPoE |
| `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password` | string | `senha123` | Senha PPPoE |
| `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ConnectionTrigger` | string | `AlwaysOn` | Manter conectado |
| `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_BROADCOM_COM_VlanMuxID` | int | `100` | VLAN ID (se aplicável) |

#### 2. Configuração de WiFi 2.4GHz (TR-098 Genérico)
| Parâmetro TR-069 | Tipo | Valor Exemplo | Descrição |
|---|---|---|---|
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID` | string | `PROVEDOR_WIFI` | Nome da Rede (SSID) |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey` | string | `senha_wifi_123` | Senha do WiFi |

#### 3. Configuração de WiFi 5GHz (TR-098 Genérico)
| Parâmetro TR-069 | Tipo | Valor Exemplo | Descrição |
|---|---|---|---|
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID` | string | `PROVEDOR_WIFI_5G` | Nome da Rede 5G (SSID) |
| `InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.PreSharedKey` | string | `senha_wifi_123` | Senha do WiFi 5G |

*(Nota: O índice `.5.` para 5GHz varia por fabricante. Intelbras e ZTE costumam usar `.5.`, Huawei costuma usar `.2.` ou TR-181 `Device.WiFi.SSID.2.`).*

---

## 4. Como Configurar uma Regra Prática no Painel

Para criar uma regra que reconfigura ONTs resetadas automaticamente buscando dados no IXC:

1. Vá em **Ferramentas → AutoConfig**.
2. Clique em **Nova Regra**.
3. **Identificação:** Dê o nome `Reconfigurar ONT após reset`. Prioridade: `90`. Status: `Ativa`.
4. **Condições:**
   - Fabricante / OUI: Selecione `INTELBRAS` (ou o fabricante desejado).
   - Evento TR-069 (Gatilho): Selecione **`BOOTSTRAP — ONT ligou após reset de fábrica`**.
   - ID da Integração IXC: Deixe vazio (usa a padrão) ou preencha se tiver múltiplas integrações.
5. **Ações (Parâmetros TR-069):**
   - Adicione os parâmetros usando as variáveis dinâmicas:
     - `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username` = `${ixc.pppoe_login}`
     - `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password` = `${ixc.pppoe_password}`
     - `InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID` = `${ixc.wifi_ssid}`
     - `InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey` = `${ixc.wifi_password}`
6. **Tags a Adicionar:**
   - Digite `reconfigurado` e aperte Enter.
7. Clique em **Criar Regra**.

Quando a ONT resetar e comunicar com o ACS (evento `0 BOOTSTRAP`), a regra será acionada, os dados serão buscados no IXC, os parâmetros aplicados na ONT, e a tag `reconfigurado` inserida.
