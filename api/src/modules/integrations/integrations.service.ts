import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios, { AxiosRequestConfig } from 'axios';
import { Integration, IntegrationDocument } from './schemas/integration.schema';
import { ERP_ADAPTERS, ErpAdapter } from './erp-adapters';

export interface CustomerLookupResult {
  found: boolean;
  raw?: Record<string, unknown>;
  normalized?: {
    id?: string;
    name?: string;
    cpf?: string;
    status?: string;
    plan?: string;
    address?: string;
    phone?: string;
    email?: string;
    profileUrl?: string;
  };
  error?: string;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    @InjectModel(Integration.name) private integrationModel: Model<IntegrationDocument>,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(): Promise<IntegrationDocument[]> {
    return this.integrationModel.find().exec();
  }

  async findById(id: string): Promise<IntegrationDocument> {
    const doc = await this.integrationModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Integração não encontrada');
    return doc;
  }

  async create(data: Partial<Integration>): Promise<IntegrationDocument> {
    return this.integrationModel.create(data);
  }

  async update(id: string, data: Partial<Integration>): Promise<IntegrationDocument> {
    const doc = await this.integrationModel
      .findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' })
      .exec();
    if (!doc) throw new NotFoundException('Integração não encontrada');
    return doc;
  }

  async remove(id: string): Promise<void> {
    await this.integrationModel.findByIdAndDelete(id).exec();
  }

  // ── Adaptadores ERP ───────────────────────────────────────────────────────

  getAdapters(): Record<string, { label: string; description: string; authType: string; docsUrl?: string }> {
    return Object.fromEntries(
      Object.entries(ERP_ADAPTERS).map(([key, a]) => [
        key,
        { label: a.label, description: a.description, authType: a.authType, docsUrl: a.docsUrl },
      ]),
    );
  }

  getAdapterDefaults(type: string): Partial<ErpAdapter> | null {
    return ERP_ADAPTERS[type] ?? null;
  }

  // ── Construção da requisição HTTP ─────────────────────────────────────────

  private buildAxiosConfig(
    integration: IntegrationDocument,
    adapter: ErpAdapter,
  ): AxiosRequestConfig {
    const cfg = integration.config || {};
    const baseURL = (cfg.baseUrl as string) || adapter.defaultBaseUrl;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const params: Record<string, string> = {};

    const authType = (cfg.authType as string) || adapter.authType;
    const apiKey = cfg.apiKey as string | undefined;
    const username = cfg.username as string | undefined;
    const password = cfg.password as string | undefined;
    const headerName = (cfg.authHeaderName as string) || adapter.authHeaderName || 'Authorization';
    const queryParam = (cfg.authQueryParam as string) || adapter.authQueryParam;

    switch (authType) {
      case 'apikey_header':
        if (apiKey) headers[headerName] = apiKey;
        break;
      case 'bearer':
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        break;
      case 'basic':
        if (username && password) {
          const encoded = Buffer.from(`${username}:${password}`).toString('base64');
          headers['Authorization'] = `Basic ${encoded}`;
        } else if (apiKey) {
          const encoded = Buffer.from(`${apiKey}:`).toString('base64');
          headers['Authorization'] = `Basic ${encoded}`;
        }
        break;
      case 'apikey_query':
        if (apiKey && queryParam) params[queryParam] = apiKey;
        break;
    }

    if (cfg.extraHeaders && typeof cfg.extraHeaders === 'object') {
      Object.assign(headers, cfg.extraHeaders as Record<string, string>);
    }

    return { baseURL, headers, params, timeout: 10000 };
  }

  // ── Lookup de cliente no ERP ──────────────────────────────────────────────

  async lookupCustomer(
    id: string,
    query: { pppoe?: string; serial?: string; cpf?: string },
  ): Promise<CustomerLookupResult> {
    const integration = await this.findById(id);
    if (!integration.enabled) {
      return { found: false, error: 'Integração desabilitada' };
    }

    const adapter = ERP_ADAPTERS[integration.type] ?? ERP_ADAPTERS['custom'];
    const cfg = integration.config || {};
    const endpoint = (cfg.customerEndpoint as typeof adapter.customerEndpoint) || adapter.customerEndpoint;
    const fieldMap = (cfg.fieldMap as typeof adapter.fieldMap) || adapter.fieldMap;

    const lookupValue = query.pppoe || query.serial || query.cpf || '';
    if (!lookupValue) {
      return { found: false, error: 'Nenhum parâmetro de busca fornecido (pppoe, serial ou cpf)' };
    }

    try {
      const axiosCfg = this.buildAxiosConfig(integration, adapter);

      let url = endpoint.path;
      url = url
        .replace('{pppoe}', encodeURIComponent(lookupValue))
        .replace('{serial}', encodeURIComponent(lookupValue))
        .replace('{cpf}', encodeURIComponent(lookupValue));

      if (endpoint.queryParam) {
        axiosCfg.params = { ...(axiosCfg.params || {}), [endpoint.queryParam]: lookupValue };
      }

      let responseData: unknown;
      if (endpoint.method === 'POST') {
        const bodyStr = JSON.stringify(endpoint.bodyTemplate || { query: lookupValue })
          .replace('{pppoe}', lookupValue)
          .replace('{serial}', lookupValue)
          .replace('{cpf}', lookupValue);
        const res = await axios.post(url, JSON.parse(bodyStr), axiosCfg);
        responseData = res.data;
      } else {
        const res = await axios.get(url, axiosCfg);
        responseData = res.data;
      }

      await this.integrationModel.findByIdAndUpdate(id, {
        $inc: { 'stats.requests': 1 },
        $set: { 'stats.lastUsed': new Date() },
      });

      const raw = this.extractRecord(responseData);
      if (!raw) return { found: false };

      const baseUrl = (cfg.baseUrl as string) || adapter.defaultBaseUrl;
      const normalized = this.normalizeCustomer(raw, fieldMap, baseUrl);
      return { found: true, raw, normalized };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`ERP lookup falhou (${integration.name}): ${msg}`);
      await this.integrationModel.findByIdAndUpdate(id, { $inc: { 'stats.errors': 1 } });
      return { found: false, error: msg };
    }
  }

  private extractRecord(data: unknown): Record<string, unknown> | null {
    if (!data) return null;
    if (Array.isArray(data)) {
      return data.length > 0 ? (data[0] as Record<string, unknown>) : null;
    }
    if (typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj['registros'])) {
        const arr = obj['registros'] as unknown[];
        return arr.length > 0 ? (arr[0] as Record<string, unknown>) : null;
      }
      if (Array.isArray(obj['data'])) {
        const arr = obj['data'] as unknown[];
        return arr.length > 0 ? (arr[0] as Record<string, unknown>) : null;
      }
      if (obj['id'] || obj['nome'] || obj['name']) return obj;
    }
    return null;
  }

  private normalizeCustomer(
    raw: Record<string, unknown>,
    fieldMap: ErpAdapter['fieldMap'],
    baseUrl: string,
  ): CustomerLookupResult['normalized'] {
    const get = (field?: string): string | undefined => {
      if (!field) return undefined;
      const parts = field.split('.');
      let val: unknown = raw;
      for (const p of parts) {
        if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
        else return undefined;
      }
      return val != null ? String(val) : undefined;
    };

    const id = get(fieldMap.idField);
    let profileUrl: string | undefined;
    if (fieldMap.profileUrl && id) {
      const urlTemplate = fieldMap.profileUrl.startsWith('http')
        ? fieldMap.profileUrl
        : `${baseUrl}${fieldMap.profileUrl}`;
      profileUrl = urlTemplate.replace('{id}', id);
    }

    return {
      id,
      name: get(fieldMap.name),
      cpf: get(fieldMap.cpf),
      status: get(fieldMap.status),
      plan: get(fieldMap.plan),
      address: get(fieldMap.address),
      phone: get(fieldMap.phone),
      email: get(fieldMap.email),
      profileUrl,
    };
  }

  // ── Teste de conexão ──────────────────────────────────────────────────────

  async testConnection(
    id: string,
  ): Promise<{ ok: boolean; statusCode?: number; message: string; latencyMs?: number }> {
    const integration = await this.findById(id);
    const adapter = ERP_ADAPTERS[integration.type] ?? ERP_ADAPTERS['custom'];
    const cfg = integration.config || {};
    const baseURL = (cfg.baseUrl as string) || adapter.defaultBaseUrl;
    const axiosCfg = this.buildAxiosConfig(integration, adapter);

    // Tenta o endpoint real de lookup com valor fictício para testar autenticação
    const endpoint = (cfg.customerEndpoint as typeof adapter.customerEndpoint) || adapter.customerEndpoint;
    if (endpoint?.path) {
      const testParams = endpoint.queryParam ? { [endpoint.queryParam]: '__test__' } : {};
      try {
        const start = Date.now();
        const res = await axios.get(endpoint.path, {
          ...axiosCfg,
          params: { ...(axiosCfg.params || {}), ...testParams },
          timeout: 8000,
          validateStatus: (s) => s < 500, // aceita 4xx como resposta válida
        });
        const latencyMs = Date.now() - start;
        const statusCode = res.status;
        if (statusCode === 401 || statusCode === 403) {
          return { ok: false, statusCode, message: 'Credenciais inválidas ou sem permissão', latencyMs };
        }
        return { ok: true, statusCode, message: 'Conexão e autenticação bem-sucedidas', latencyMs };
      } catch (err: unknown) {
        // Endpoint falhou — tenta URL base como fallback
      }
    }

    // Fallback: testa apenas a URL base
    try {
      const start = Date.now();
      const res = await axios.get(baseURL, {
        ...axiosCfg,
        timeout: 8000,
        validateStatus: () => true,
      });
      const latencyMs = Date.now() - start;
      const statusCode = res.status;
      if (statusCode === 401 || statusCode === 403) {
        return { ok: false, statusCode, message: 'Credenciais inválidas ou sem permissão', latencyMs };
      }
      return { ok: true, statusCode, message: 'URL acessível', latencyMs };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `Falha na conexão: ${msg}` };
    }
  }

  // ── Webhook (mantido para compatibilidade) ────────────────────────────────

  async testWebhook(id: string, payload: unknown): Promise<{ status: number; data: unknown }> {
    const integration = await this.findById(id);
    if (integration.type !== 'webhook') throw new Error('Integração não é do tipo webhook');
    const url = integration.config?.url as string;
    if (!url) throw new Error('URL do webhook não configurada');
    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json', ...(integration.config?.headers || {}) },
      timeout: 10000,
    });
    await this.integrationModel.findByIdAndUpdate(id, {
      $inc: { 'stats.requests': 1 },
      $set: { 'stats.lastUsed': new Date() },
    });
    return { status: res.status, data: res.data };
  }

  async sendWebhookEvent(type: string, payload: unknown): Promise<void> {
    const webhooks = await this.integrationModel.find({ type: 'webhook', enabled: true }).exec();
    for (const wh of webhooks) {
      try {
        await axios.post(
          wh.config?.url as string,
          { event: type, ...(payload as object) },
          {
            headers: { 'Content-Type': 'application/json', ...(wh.config?.headers || {}) },
            timeout: 5000,
          },
        );
        await this.integrationModel.findByIdAndUpdate(wh._id, {
          $inc: { 'stats.requests': 1 },
          $set: { 'stats.lastUsed': new Date() },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Webhook ${wh.name} falhou: ${msg}`);
        await this.integrationModel.findByIdAndUpdate(wh._id, { $inc: { 'stats.errors': 1 } });
      }
    }
  }
}
