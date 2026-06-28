# BR10ACS — Documentação Técnica

O **BR10ACS** é uma plataforma moderna de Auto Configuration Server (ACS) construída para gerenciar dispositivos TR-069 (CPEs, ONTs, roteadores) em provedores de internet (ISPs). Ele atua como uma camada inteligente sobre o GenieACS, oferecendo uma interface web moderna, integrações com ERPs, diagnóstico com IA, e automações avançadas.

## 1. Arquitetura do Sistema

O sistema utiliza uma arquitetura moderna baseada em containers Docker, separando o backend, frontend e os serviços do GenieACS.

### Stack Tecnológica
* **Backend:** Node.js, TypeScript, NestJS
* **Frontend:** React, Vite, TailwindCSS, React Query, Recharts
* **Banco de Dados:** MongoDB (armazena logs, histórico, configurações, integrações e alertas)
* **Cache/Filas:** Redis
* **Core TR-069:** GenieACS (NBI, CWMP, FS)
* **Proxy/Web Server:** Nginx

O BR10ACS **não acessa o banco de dados do GenieACS diretamente**. Toda a comunicação com o GenieACS é feita de forma segura através da sua API REST (NBI).

---

## 2. Módulos Principais do Backend

O backend (NestJS) é dividido em módulos com responsabilidades únicas:

### 2.1. Devices & Device Normalizer (`/devices`)
Gerencia a listagem, busca e interação com as CPEs.
* **DeviceNormalizer:** Traduz a árvore complexa de parâmetros TR-069 (TR-098 e TR-181) para um objeto padronizado, lidando com diferenças entre fabricantes (Intelbras, ZTE, Huawei, Nokia, etc.).

### 2.2. Collector & TimeSeries (`/collector`)
Serviço executado em background (via `setInterval` a cada 5 minutos) que varre todos os dispositivos online.
* **Função:** Coleta nível de sinal (RX/TX), temperatura, voltagem, bytes trafegados (WAN), uptime e quantidade de hosts.
* **Armazenamento:** Grava os dados na coleção `timeseries` no MongoDB.
* **Gráficos:** Esses dados são usados para renderizar os gráficos de histórico de sinal e banda consumida na interface.
* **Alertas:** Se o sinal óptico estiver fora da faixa aceitável ou o dispositivo ficar offline, o coletor gera um alerta no sistema.

### 2.3. AutoConfig (`/autoconfig`)
Sistema de provisionamento inteligente e dinâmico.
* Permite criar regras condicionais com filtros por OUI, modelo, firmware, serial (regex) e **evento TR-069** (`BOOTSTRAP`, `BOOT`, `PERIODIC`, `VALUE_CHANGE`).
* Quando um dispositivo atende às condições, o sistema aplica parâmetros TR-069 específicos ou adiciona Tags automaticamente.
* Suporta **variáveis dinâmicas** nos valores dos parâmetros: `${ixc.pppoe_login}`, `${ixc.pppoe_password}`, `${ixc.wifi_ssid}`, `${ixc.wifi_password}`, `${device.serialNumber}`, `${param.CAMINHO_TR069}` e outras. O sistema resolve as variáveis consultando o GenieACS e o IXC Soft antes de enviar o `setParameterValues` à ONT.
* Roda de forma passiva (quando um dispositivo faz Inform) e ativa (via cron job de hora em hora).
* **Reconfiguração pós-reset:** Ao criar uma regra com evento `BOOTSTRAP` e usar `${ixc.pppoe_login}` / `${ixc.pppoe_password}` nos parâmetros, a ONT é reconfigurada automaticamente após um reset de fábrica, sem intervenção humana. Ver `docs/API_AUTOCONFIG.md` e `docs/TR069_AUTOCONFIG.md` para detalhes completos.

### 2.4. Presets & Provisions (`/presets`)
Interface direta para a engine nativa do GenieACS.
* Permite gerenciar scripts de provisionamento e regras de presets do próprio GenieACS diretamente pela interface do BR10ACS.
* O método `applyTemplate` cria automaticamente os scripts base necessários para coleta de dados de novas ONTs.

### 2.5. Integrações ERP (`/integrations`)
Conecta o BR10ACS aos sistemas de gestão do provedor.
* **Adaptadores Suportados:** IXC Soft, SGP, MK-Auth, Hubsoft, Leaf, Spify e Custom.
* **Fluxo de Consulta (Lookup):** Quando ativada, a integração permite buscar os dados do cliente (Nome, Plano, Status Financeiro) diretamente no ERP usando o PPPoE, Serial ou CPF da CPE.
* **Fluxo de Ação:** O sistema suporta executar comandos de volta para o ERP. Na aba "Cliente ERP", após localizar o cliente, botões de ação nativos permitem:
  * **Suspender:** Envia comando de bloqueio/suspensão de contrato.
  * **Reativar:** Envia comando de desbloqueio/reativação.
  * **Abrir OS:** Cria um chamado de suporte técnico no ERP vinculado ao cliente.
* A comunicação é dinâmica, utilizando substituição de placeholders (`{id}`, `{pppoe}`) nos endpoints configurados.

### 2.6. Diagnósticos & IA (`/diagnostics`)
Módulo responsável por testes ativos e análise inteligente.
* **Testes Ativos:** Executa Ping e Traceroute via TR-069, suportando tanto o path TR-098 (`InternetGatewayDevice.TraceRouteDiagnostics`) quanto TR-181 (`Device.IP.Diagnostics.TraceRoute`).
* **Análise IA:** Integra-se com a API da OpenAI (GPT-4o-mini). O sistema envia os parâmetros brutos da CPE, histórico de sinal e logs recentes para a IA, que devolve um diagnóstico estruturado com problemas identificados, severidade, causa provável e recomendações de ação.

### 2.7. Logs (`/logs`)
Registra todas as ações executadas no sistema.
* Captura reboots, reset de fábrica, alterações de Wi-Fi, operações em massa e execuções do AutoConfig.
* Os logs são categorizados e vinculados ao `deviceId` para exibição no histórico individual de cada CPE.

---

## 3. Funcionalidades do Frontend

A interface web foi desenhada para ser rápida, responsiva e focada na operação de telecomunicações.

### Dashboard
* Visão geral da rede com contadores de dispositivos online/offline.
* Gráficos de distribuição por fabricante.
* **Relatório de Intervenções Recentes:** Lista as últimas ações críticas realizadas nos dispositivos (reboot, alteração de senha, firmware).

### Detalhes do Dispositivo
A tela principal de operação técnica, dividida em abas:
1. **Informações:** Resumo do dispositivo, uptime, IP, e painel de tráfego total (com mini-gráfico de banda).
2. **Sinal:** Níveis ópticos (RX/TX, Voltagem, Temperatura) e gráficos históricos de Sinal e Banda Consumida (calculada pelo delta de bytes do timeseries).
3. **Wi-Fi:** Listagem das redes 2.4GHz e 5GHz, com opção de filtrar apenas redes ativas, visualizar senhas e alterar configurações.
4. **Hosts:** Lista de dispositivos conectados à LAN/WLAN da CPE.
5. **Diagnóstico:** Execução de Ping, Traceroute, Speedtest (TR-069) e botão para Análise IA individual.
6. **Histórico:** Log de eventos específicos daquele dispositivo.
7. **Cliente ERP:** Dados do assinante buscados em tempo real na integração ativa, com botões nativos para executar ações (Suspender, Reativar, Abrir OS) diretamente no sistema de gestão.

### Análise IA (Lote)
* Página dedicada para analisar múltiplas ONTs de uma só vez.
* Permite filtrar dispositivos online/offline.
* Exibe um painel de configuração nativo para inserir a API Key da OpenAI, que é salva criptografada no banco de dados e recarrega o serviço instantaneamente sem necessidade de reiniciar containers.

### Operações em Massa (Mass Ops)
* Permite selecionar múltiplos dispositivos (por fabricante, tag, status) e agendar tarefas em lote, como Reboot, Factory Reset ou envio de comandos TR-069.

---

## 4. Fluxos de Dados e Comportamentos Importantes

### Como o Gráfico de Banda Funciona
O GenieACS não armazena histórico. O BR10ACS resolve isso com o serviço `Collector`.
1. A cada 5 minutos, o Collector lê o `TotalBytesReceived` e `TotalBytesSent` da CPE.
2. Esses valores são gravados no MongoDB (`timeseries`).
3. O frontend lê essa série temporal e calcula a diferença (delta) de bytes entre o ponto atual e o anterior.
4. O delta é dividido pelo tempo (5 minutos) para gerar a taxa em **Mbps**, que é exibida no gráfico de área na aba Sinal.

### Como a IA analisa a CPE
1. O usuário clica em "Analisar com IA".
2. O backend coleta: parâmetros atuais da CPE, últimos 10 pontos de sinal óptico, e últimos 5 logs de eventos.
3. Esses dados são formatados em um prompt JSON e enviados para a OpenAI.
4. A IA avalia limites físicos (ex: RX < -27dBm é ruim), quedas de link e alterações recentes.
5. A resposta retorna em formato estruturado (JSON) e é renderizada na interface com badges de severidade e ações recomendadas.

### Como funciona a Integração ERP (Ações)
1. Ao acessar a aba **Cliente ERP**, o sistema faz uma requisição `GET` para o endpoint de busca do ERP (ex: `/api/clientes?pppoe=user`).
2. Se o cliente for encontrado, o backend normaliza a resposta e extrai o `id` interno do cliente no ERP.
3. A interface exibe os dados e carrega os botões de ação disponíveis para aquele adaptador (ex: IXC ou SGP).
4. Ao clicar em **Suspender**, o frontend chama `POST /v1/integrations/:id/actions/suspend` passando o `customerId`.
5. O backend injeta o `customerId` na URL do ERP (ex: `/webservice/v1/cliente/{id}`) e no body da requisição (`{ ativo: 'N' }`), autentica e executa a chamada `PUT/POST`.
6. O resultado (sucesso ou falha) é registrado nas estatísticas da integração e notificado ao usuário.

### Como configurar a IA
1. Acesse o menu lateral **Diagnóstico IA**.
2. Clique no botão **Configurar IA** (ícone de engrenagem).
3. Insira sua `API Key` da OpenAI (ex: `sk-proj-...`).
4. Clique em Salvar. A chave será gravada no MongoDB (`settings`) e o cliente interno será recarregado automaticamente.

---

## 5. Manutenção e Troubleshooting

* **Logs do Sistema:** A página "Logs do Sistema" exibe todos os eventos. Filtre por "Aviso" ou "Erro" para diagnosticar falhas no AutoConfig ou Operações em Massa.
* **Falta de Histórico:** Se os gráficos de sinal ou banda estiverem vazios, certifique-se de que a CPE está online e que o fabricante expõe os parâmetros corretamente (ex: `InternetGatewayDevice.WANDevice.1.WANCommonInterfaceConfig.TotalBytesReceived`).
* **Traceroute com Timeout:** Algumas ONTs não suportam diagnósticos TR-069. O sistema tenta os paths TR-098 e TR-181. Se ambos falharem, o dispositivo não suporta a função via ACS.
