/**
 * Adaptadores ERP pré-configurados para o BR10ACS.
 *
 * Cada adaptador define:
 *  - label: nome amigável
 *  - authType: como autenticar ('apikey_header' | 'basic' | 'bearer' | 'apikey_query')
 *  - defaultBaseUrl: URL padrão (pode ser sobrescrita pelo usuário)
 *  - endpoints: mapeamento de operações para paths de API
 *  - fieldMap: mapeamento de campos da resposta para campos padronizados BR10ACS
 *  - lookupParam: qual campo usar para busca (pppoe | serial | cpf)
 */

export interface ErpEndpointConfig {
  method: 'GET' | 'POST';
  path: string; // suporta {pppoe}, {serial}, {cpf} como placeholders
  queryParam?: string; // nome do query param se a busca for por query string
  bodyTemplate?: Record<string, unknown>; // para POST
}

export interface ErpFieldMap {
  name?: string;       // nome do cliente
  cpf?: string;        // CPF/CNPJ
  status?: string;     // status do contrato (ativo, suspenso, etc.)
  plan?: string;       // nome do plano
  address?: string;    // endereço
  phone?: string;      // telefone
  email?: string;      // e-mail
  profileUrl?: string; // URL para abrir no ERP (template com {id})
  idField?: string;    // campo que contém o ID do cliente no ERP
}

export interface ErpAdapter {
  label: string;
  description: string;
  authType: 'apikey_header' | 'basic' | 'bearer' | 'apikey_query';
  authHeaderName?: string;   // ex: 'Authorization', 'ixcsoft-token'
  authQueryParam?: string;   // ex: 'key' para MK-Auth
  defaultBaseUrl: string;
  lookupParam: 'pppoe' | 'serial' | 'cpf';
  customerEndpoint: ErpEndpointConfig;
  fieldMap: ErpFieldMap;
  docsUrl?: string;
}

export const ERP_ADAPTERS: Record<string, ErpAdapter> = {
  sgp: {
    label: 'SGP',
    description: 'Sistema de Gestão para Provedores (SGP)',
    authType: 'apikey_header',
    authHeaderName: 'Authorization',
    defaultBaseUrl: 'https://app.sgp.net.br',
    lookupParam: 'pppoe',
    customerEndpoint: {
      method: 'GET',
      path: '/api/v2/clientes',
      queryParam: 'login_pppoe',
    },
    fieldMap: {
      name: 'nome',
      cpf: 'cpf_cnpj',
      status: 'status',
      plan: 'plano',
      address: 'endereco',
      phone: 'telefone',
      email: 'email',
      idField: 'id',
      profileUrl: '/admin/clientes/{id}',
    },
    docsUrl: 'https://developers.sgp.net.br',
  },

  ixc: {
    label: 'IXC Soft',
    description: 'IXC Soft — sistema de gestão para ISPs',
    authType: 'basic',
    defaultBaseUrl: 'https://suaempresa.ixcsoft.com.br',
    lookupParam: 'pppoe',
    customerEndpoint: {
      method: 'GET',
      path: '/webservice/v1/cliente',
      queryParam: 'login_pppoe',
    },
    fieldMap: {
      name: 'razao',
      cpf: 'cnpj_cpf',
      status: 'ativo',
      plan: 'contrato_plano',
      address: 'endereco',
      phone: 'fone_celular',
      email: 'email',
      idField: 'id',
      profileUrl: '/index.php?modulo=clientes&acao=visualizar&id={id}',
    },
    docsUrl: 'https://wiki.ixcsoft.com.br/index.php/API_IXC_Soft',
  },

  mkauth: {
    label: 'MK-Auth',
    description: 'MK-Auth — sistema de autenticação e gestão para ISPs',
    authType: 'apikey_query',
    authQueryParam: 'key',
    defaultBaseUrl: 'http://seu-mkauth.local',
    lookupParam: 'pppoe',
    customerEndpoint: {
      method: 'GET',
      path: '/api/cliente.php',
      queryParam: 'login',
    },
    fieldMap: {
      name: 'nome',
      cpf: 'cpf',
      status: 'status',
      plan: 'plano',
      address: 'endereco',
      phone: 'celular',
      email: 'email',
      idField: 'id',
      profileUrl: '/admin/clientes.php?id={id}',
    },
  },

  hubsoft: {
    label: 'Hubsoft',
    description: 'Hubsoft — plataforma de gestão para provedores',
    authType: 'bearer',
    defaultBaseUrl: 'https://api.hubsoft.com.br',
    lookupParam: 'pppoe',
    customerEndpoint: {
      method: 'GET',
      path: '/api/v1/subscribers',
      queryParam: 'username',
    },
    fieldMap: {
      name: 'name',
      cpf: 'document',
      status: 'status',
      plan: 'plan_name',
      address: 'address',
      phone: 'phone',
      email: 'email',
      idField: 'id',
      profileUrl: '/subscribers/{id}',
    },
    docsUrl: 'https://developers.hubsoft.com.br',
  },

  leaf: {
    label: 'Leaf',
    description: 'Leaf — sistema de gestão para ISPs',
    authType: 'apikey_header',
    authHeaderName: 'X-API-Key',
    defaultBaseUrl: 'https://api.leaf.com.br',
    lookupParam: 'pppoe',
    customerEndpoint: {
      method: 'GET',
      path: '/api/clientes',
      queryParam: 'pppoe',
    },
    fieldMap: {
      name: 'nome',
      cpf: 'cpf_cnpj',
      status: 'status',
      plan: 'plano',
      address: 'endereco',
      phone: 'telefone',
      email: 'email',
      idField: 'id',
      profileUrl: '/clientes/{id}',
    },
  },

  spify: {
    label: 'Spify',
    description: 'Spify — plataforma de gestão para provedores',
    authType: 'bearer',
    defaultBaseUrl: 'https://api.spify.com.br',
    lookupParam: 'pppoe',
    customerEndpoint: {
      method: 'GET',
      path: '/api/v1/customers',
      queryParam: 'pppoe',
    },
    fieldMap: {
      name: 'name',
      cpf: 'document',
      status: 'status',
      plan: 'plan',
      address: 'address',
      phone: 'phone',
      email: 'email',
      idField: 'id',
      profileUrl: '/customers/{id}',
    },
  },

  custom: {
    label: 'Personalizado',
    description: 'Conector genérico — configure manualmente os endpoints e campos',
    authType: 'apikey_header',
    authHeaderName: 'Authorization',
    defaultBaseUrl: 'https://seu-erp.com',
    lookupParam: 'pppoe',
    customerEndpoint: {
      method: 'GET',
      path: '/api/clientes',
      queryParam: 'pppoe',
    },
    fieldMap: {
      name: 'nome',
      cpf: 'cpf',
      status: 'status',
      plan: 'plano',
      idField: 'id',
    },
  },
};
