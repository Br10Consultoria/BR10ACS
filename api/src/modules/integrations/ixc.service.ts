/**
 * IxcService — Serviço dedicado para interação avançada com a API do IXC Soft.
 *
 * Endpoints cobertos:
 *   - /webservice/v1/radusuarios       — Usuários RADIUS (logins PPPoE/FTTH)
 *   - /webservice/v1/radpop_radio_cliente_fibra — ONTs autorizadas (fibra)
 *   - /webservice/v1/cliente           — Dados cadastrais do cliente
 *
 * Autenticação: Basic Auth com token no formato "userId:token"
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios, { AxiosRequestConfig } from 'axios';
import { Integration, IntegrationDocument } from './schemas/integration.schema';

// ── Tipos de resposta da API IXC ─────────────────────────────────────────────

export interface IxcListResponse<T> {
  total: string;
  registros: T[];
}

export interface IxcRadUsuario {
  id: string;
  login: string;
  ativo: string;           // 'S' | 'N'
  online: string;          // 'SS' | 'SN' | 'NS' | 'NN'
  ip: string;
  mac: string;
  onu_mac: string;
  id_cliente: string;
  id_contrato: string;
  id_concentrador: string;
  concentrador: string;
  interface: string;
  vlan: string;
  sinal_ultimo_atendimento: string;
  ultima_conexao_inicial: string;
  ultima_conexao_final: string;
  motivo_desconexao: string;
  download_atual: string;
  upload_atual: string;
  tempo_conectado: string;
  id_transmissor: string;
  modelo_tranmissor: string;
  ftth_porta: string;
  onu_numero: string;
  tipo_equipamento: string;
}

export interface IxcOntFibra {
  id: string;
  nome: string;
  mac: string;
  ponid: string;
  onu_numero: string;
  gemport: string;
  service_port: string;
  vlan: string;
  vlan_pppoe: string;
  vlan_dhcp: string;
  vlan_tr69: string;
  ip_gerencia: string;
  sinal_rx: string;
  sinal_tx: string;
  temperatura: string;
  voltagem: string;
  data_sinal: string;
  causa_ultima_queda: string;
  versao: string;
  id_contrato: string;
  id_login: string;
  id_transmissor: string;
  id_caixa_ftth: string;
  porta_ftth: string;
  id_hardware: string;
  tipo_autenticacao: string;
  onu_rede_neutra: string;
  slotno: string;
  ponno: string;
  distancia_onu: string;
}

export interface IxcOntLookupResult {
  found: boolean;
  radUsuario?: Partial<IxcRadUsuario>;
  ontFibra?: Partial<IxcOntFibra>;
  error?: string;
}

// ── Serviço ───────────────────────────────────────────────────────────────────

@Injectable()
export class IxcService {
  private readonly logger = new Logger(IxcService.name);

  constructor(
    @InjectModel(Integration.name) private integrationModel: Model<IntegrationDocument>,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildAxiosCfg(integration: IntegrationDocument): AxiosRequestConfig {
    const cfg = integration.config || {};
    const baseURL = (cfg.baseUrl as string) || '';
    const token = (cfg.apiKey as string) || '';

    const encoded = Buffer.from(token).toString('base64');
    return {
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${encoded}`,
      },
      timeout: 12000,
    };
  }

  /**
   * Faz uma listagem paginada na API IXC com filtro.
   */
  private async ixcList<T>(
    axiosCfg: AxiosRequestConfig,
    endpoint: string,
    qtype: string,
    query: string,
    oper: string = '=',
    rp = 20,
  ): Promise<IxcListResponse<T>> {
    const res = await axios.get(endpoint, {
      ...axiosCfg,
      headers: {
        ...(axiosCfg.headers as Record<string, string>),
        ixcsoft: 'listar',
      },
      data: {
        qtype,
        query,
        oper,
        page: '1',
        rp: String(rp),
        sortname: qtype,
        sortorder: 'desc',
      },
    });
    return res.data as IxcListResponse<T>;
  }

  // ── Busca de usuário RADIUS por login/MAC/serial ──────────────────────────

  /**
   * Busca um usuário RADIUS no IXC por login PPPoE, MAC ou serial da ONT.
   */
  async lookupRadUser(
    integrationId: string,
    params: { login?: string; mac?: string; onuMac?: string },
  ): Promise<{ found: boolean; data?: IxcRadUsuario; error?: string }> {
    const integration = await this.integrationModel.findById(integrationId).exec();
    if (!integration) return { found: false, error: 'Integração não encontrada' };
    if (!integration.enabled) return { found: false, error: 'Integração desabilitada' };

    const axiosCfg = this.buildAxiosCfg(integration);

    let qtype = 'radusuarios.login';
    let queryVal = params.login || params.mac || params.onuMac || '';

    if (!params.login && params.mac) {
      qtype = 'radusuarios.mac';
      queryVal = params.mac;
    } else if (!params.login && !params.mac && params.onuMac) {
      qtype = 'radusuarios.onu_mac';
      queryVal = params.onuMac;
    }

    if (!queryVal) return { found: false, error: 'Informe login, mac ou onuMac' };

    try {
      const result = await this.ixcList<IxcRadUsuario>(
        axiosCfg,
        '/webservice/v1/radusuarios',
        qtype,
        queryVal,
        '=',
        5,
      );

      if (!result.registros || result.registros.length === 0) {
        return { found: false };
      }

      await this.integrationModel.findByIdAndUpdate(integrationId, {
        $inc: { 'stats.requests': 1 },
        $set: { 'stats.lastUsed': new Date() },
      });

      return { found: true, data: result.registros[0] };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro desconhecido';
      this.logger.error(`IXC radusuarios lookup falhou: ${msg}`);
      await this.integrationModel.findByIdAndUpdate(integrationId, { $inc: { 'stats.errors': 1 } });
      return { found: false, error: msg };
    }
  }

  // ── Busca de ONT fibra por MAC/serial/contrato ────────────────────────────

  /**
   * Busca uma ONT fibra no IXC por MAC, número da ONT ou ID de contrato.
   */
  async lookupOntFibra(
    integrationId: string,
    params: { mac?: string; onuNumero?: string; idContrato?: string; idLogin?: string },
  ): Promise<{ found: boolean; data?: IxcOntFibra; error?: string }> {
    const integration = await this.integrationModel.findById(integrationId).exec();
    if (!integration) return { found: false, error: 'Integração não encontrada' };
    if (!integration.enabled) return { found: false, error: 'Integração desabilitada' };

    const axiosCfg = this.buildAxiosCfg(integration);

    let qtype = 'radpop_radio_cliente_fibra.mac';
    let queryVal = '';

    if (params.mac) {
      qtype = 'radpop_radio_cliente_fibra.mac';
      queryVal = params.mac;
    } else if (params.onuNumero) {
      qtype = 'radpop_radio_cliente_fibra.onu_numero';
      queryVal = params.onuNumero;
    } else if (params.idContrato) {
      qtype = 'radpop_radio_cliente_fibra.id_contrato';
      queryVal = params.idContrato;
    } else if (params.idLogin) {
      qtype = 'radpop_radio_cliente_fibra.id_login';
      queryVal = params.idLogin;
    }

    if (!queryVal) return { found: false, error: 'Informe mac, onuNumero, idContrato ou idLogin' };

    try {
      const result = await this.ixcList<IxcOntFibra>(
        axiosCfg,
        '/webservice/v1/radpop_radio_cliente_fibra',
        qtype,
        queryVal,
        '=',
        5,
      );

      if (!result.registros || result.registros.length === 0) {
        return { found: false };
      }

      await this.integrationModel.findByIdAndUpdate(integrationId, {
        $inc: { 'stats.requests': 1 },
        $set: { 'stats.lastUsed': new Date() },
      });

      return { found: true, data: result.registros[0] };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro desconhecido';
      this.logger.error(`IXC radpop_radio_cliente_fibra lookup falhou: ${msg}`);
      await this.integrationModel.findByIdAndUpdate(integrationId, { $inc: { 'stats.errors': 1 } });
      return { found: false, error: msg };
    }
  }

  // ── Lookup completo de ONT (radusuarios + radpop_radio_cliente_fibra) ─────

  /**
   * Busca dados completos de uma ONT: primeiro no radusuarios (por login/MAC),
   * depois complementa com dados de fibra (radpop_radio_cliente_fibra).
   */
  async lookupOntComplete(
    integrationId: string,
    params: { login?: string; mac?: string; serial?: string },
  ): Promise<IxcOntLookupResult> {
    const integration = await this.integrationModel.findById(integrationId).exec();
    if (!integration) return { found: false, error: 'Integração não encontrada' };
    if (!integration.enabled) return { found: false, error: 'Integração desabilitada' };

    // 1. Busca no radusuarios
    const radResult = await this.lookupRadUser(integrationId, {
      login: params.login,
      mac: params.mac,
      onuMac: params.mac,
    });

    if (!radResult.found) {
      // Tenta diretamente no radpop_radio_cliente_fibra pelo MAC
      if (params.mac) {
        const ontResult = await this.lookupOntFibra(integrationId, { mac: params.mac });
        if (ontResult.found) {
          return { found: true, ontFibra: ontResult.data };
        }
      }
      return { found: false, error: radResult.error || 'ONT não encontrada' };
    }

    const radUser = radResult.data!;
    const result: IxcOntLookupResult = { found: true, radUsuario: radUser };

    // 2. Complementa com dados de fibra usando o id_login do radusuarios
    if (radUser.id) {
      const ontResult = await this.lookupOntFibra(integrationId, { idLogin: radUser.id });
      if (ontResult.found) {
        result.ontFibra = ontResult.data;
      }
    }

    return result;
  }

  // ── Listar ONTs de um contrato ────────────────────────────────────────────

  /**
   * Lista todas as ONTs fibra associadas a um contrato IXC.
   */
  async listOntsByContract(
    integrationId: string,
    idContrato: string,
  ): Promise<{ found: boolean; data?: IxcOntFibra[]; total?: number; error?: string }> {
    const integration = await this.integrationModel.findById(integrationId).exec();
    if (!integration) return { found: false, error: 'Integração não encontrada' };
    if (!integration.enabled) return { found: false, error: 'Integração desabilitada' };

    const axiosCfg = this.buildAxiosCfg(integration);

    try {
      const result = await this.ixcList<IxcOntFibra>(
        axiosCfg,
        '/webservice/v1/radpop_radio_cliente_fibra',
        'radpop_radio_cliente_fibra.id_contrato',
        idContrato,
        '=',
        50,
      );

      return {
        found: (result.registros?.length ?? 0) > 0,
        data: result.registros || [],
        total: parseInt(result.total || '0', 10),
      };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro desconhecido';
      return { found: false, error: msg };
    }
  }

  // ── Atualizar sinal da ONT ────────────────────────────────────────────────

  /**
   * Atualiza os dados de sinal (sinal_rx, sinal_tx, temperatura, voltagem) de uma ONT fibra.
   */
  async updateOntSignal(
    integrationId: string,
    ontId: string,
    signalData: { sinal_rx?: string; sinal_tx?: string; temperatura?: string; voltagem?: string; data_sinal?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const integration = await this.integrationModel.findById(integrationId).exec();
    if (!integration) return { ok: false, error: 'Integração não encontrada' };
    if (!integration.enabled) return { ok: false, error: 'Integração desabilitada' };

    const axiosCfg = this.buildAxiosCfg(integration);

    try {
      await axios.put(
        `/webservice/v1/radpop_radio_cliente_fibra/${ontId}`,
        { ...signalData, data_sinal: signalData.data_sinal || new Date().toISOString().slice(0, 19).replace('T', ' ') },
        axiosCfg,
      );

      await this.integrationModel.findByIdAndUpdate(integrationId, {
        $inc: { 'stats.requests': 1 },
        $set: { 'stats.lastUsed': new Date() },
      });

      return { ok: true };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro desconhecido';
      await this.integrationModel.findByIdAndUpdate(integrationId, { $inc: { 'stats.errors': 1 } });
      return { ok: false, error: msg };
    }
  }

  // ── Busca de senha PPPoE ──────────────────────────────────────────────────

  /**
   * Busca a senha PPPoE de um usuário RADIUS pelo login.
   * O IXC retorna a senha no campo `senha` do registro radusuarios.
   * ATENÇÃO: Requer que a API IXC tenha permissão de leitura do campo senha.
   */
  async getRadUserPassword(
    integrationId: string,
    login: string,
  ): Promise<{ found: boolean; password?: string; error?: string }> {
    const integration = await this.integrationModel.findById(integrationId).exec();
    if (!integration) return { found: false, error: 'Integração não encontrada' };
    if (!integration.enabled) return { found: false, error: 'Integração desabilitada' };
    const axiosCfg = this.buildAxiosCfg(integration);
    try {
      const result = await this.ixcList<IxcRadUsuario & { senha?: string; password?: string; cleartext_password?: string; rad_passwd?: string }>(
        axiosCfg,
        '/webservice/v1/radusuarios',
        'radusuarios.login',
        login,
        '=',
        1,
      );
      if (!result.registros || result.registros.length === 0) {
        return { found: false, error: 'Usuário não encontrado' };
      }
      const user = result.registros[0] as any;
      // O campo pode ser 'senha', 'password' ou 'cleartext_password' dependendo da versão do IXC
      const password: string = user.senha || user.password || user.cleartext_password || user.rad_passwd || '';
      await this.integrationModel.findByIdAndUpdate(integrationId, {
        $inc: { 'stats.requests': 1 },
        $set: { 'stats.lastUsed': new Date() },
      });
      return { found: true, password };
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro desconhecido';
      this.logger.error(`IXC getRadUserPassword falhou para login=${login}: ${msg}`);
      await this.integrationModel.findByIdAndUpdate(integrationId, { $inc: { 'stats.errors': 1 } });
      return { found: false, error: msg };
    }
  }

  // ── Importar coleção de API (auto-implementação) ──────────────────────────

  /**
   * Analisa uma coleção de API no formato Node.js (como as enviadas pelo usuário)
   * e extrai os endpoints para configuração automática da integração.
   */
  parseApiCollection(collectionContent: string): {
    endpoints: Array<{
      name: string;
      method: string;
      path: string;
      description: string;
      bodyFields?: string[];
      queryFields?: string[];
    }>;
    baseUrl?: string;
    authType?: string;
  } {
    const endpoints: Array<{
      name: string;
      method: string;
      path: string;
      description: string;
      bodyFields?: string[];
      queryFields?: string[];
    }> = [];

    // Extrai blocos de comentário e URLs
    const urlMatches = collectionContent.matchAll(/url:\s*['"`]([^'"`]+)['"`]/g);
    const methodMatches = collectionContent.matchAll(/method:\s*['"`](GET|POST|PUT|DELETE|PATCH)['"`]/gi);
    const commentMatches = collectionContent.matchAll(/\/\/([^\n]+)/g);

    const urls = [...urlMatches].map(m => m[1]);
    const methods = [...methodMatches].map(m => m[1].toUpperCase());
    const comments = [...commentMatches].map(m => m[1].trim());

    // Detecta URL base
    let baseUrl: string | undefined;
    if (urls.length > 0) {
      const firstUrl = urls[0];
      const match = firstUrl.match(/^(https?:\/\/[^/]+)/);
      if (match) baseUrl = match[1];
    }

    // Detecta tipo de autenticação
    let authType = 'basic';
    if (collectionContent.includes('Bearer ')) authType = 'bearer';
    if (collectionContent.includes('api_key') || collectionContent.includes('apikey')) authType = 'apikey_header';

    // Extrai campos do body
    const bodyBlockMatches = collectionContent.matchAll(/body\s*[=:]\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/gs);

    let i = 0;
    for (const urlMatch of urls) {
      const path = urlMatch.replace(/^https?:\/\/[^/]+/, '').replace('HOST', '');
      const method = methods[i] || 'GET';
      const comment = comments.find(c =>
        c.toLowerCase().includes('inserir') || c.toLowerCase().includes('listar') ||
        c.toLowerCase().includes('editar') || c.toLowerCase().includes('deletar') ||
        c.toLowerCase().includes('buscar')
      ) || `Endpoint ${i + 1}`;

      // Tenta extrair campos do body para este endpoint
      const bodyBlockArr = [...bodyBlockMatches];
      const bodyFields: string[] = [];
      if (bodyBlockArr[i]) {
        const fieldMatches = bodyBlockArr[i][1].matchAll(/'([^']+)'\s*:/g);
        for (const fm of fieldMatches) {
          bodyFields.push(fm[1]);
        }
      }

      endpoints.push({
        name: comment.replace(/[-—]+/, '').trim(),
        method,
        path,
        description: `${method} ${path}`,
        bodyFields: bodyFields.length > 0 ? bodyFields : undefined,
      });

      i++;
    }

    return { endpoints, baseUrl, authType };
  }
}
