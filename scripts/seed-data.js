#!/usr/bin/env node
/**
 * BR10ACS — Script de Seed de Dados
 * 
 * Importa para o MongoDB br10:
 *   - Fabricantes e modelos de CPEs (packages)
 *   - Configurações padrão do sistema (settings)
 *   - Perfis de permissão (roles)
 *   - Tags padrão
 *   - AutoConfig padrão por fabricante
 * 
 * Uso:
 *   node scripts/seed-data.js
 *   node scripts/seed-data.js --reset   (limpa antes de importar)
 */

'use strict';

const mongoose = require('mongoose');

// ─── Configuração ─────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/br10';
const RESET = process.argv.includes('--reset');

// ─── Dados de fabricantes e modelos (baseado nos packages do repositório) ─────
const MANUFACTURERS = [
  { oui: 'HUAWEI',                    name: 'Huawei',       country: 'CN' },
  { oui: 'HUAWEI_TECHNOLOGIES_CO_LTD',name: 'Huawei',       country: 'CN' },
  { oui: 'HWTC',                      name: 'Huawei',       country: 'CN' },
  { oui: 'NOKIA',                     name: 'Nokia',        country: 'FI' },
  { oui: 'ALCL',                      name: 'Nokia/Alcatel',country: 'FI' },
  { oui: 'ZTE',                       name: 'ZTE',          country: 'CN' },
  { oui: 'FIBERHOME',                 name: 'FiberHome',    country: 'CN' },
  { oui: 'FHTC',                      name: 'FiberHome',    country: 'CN' },
  { oui: 'TP_LINK',                   name: 'TP-Link',      country: 'CN' },
  { oui: 'INTELBRAS',                 name: 'Intelbras',    country: 'BR' },
  { oui: '808544',                    name: 'Intelbras',    country: 'BR' },
  { oui: 'VSOL',                      name: 'V-SOL',        country: 'CN' },
  { oui: 'MONU',                      name: 'V-SOL',        country: 'CN' },
  { oui: 'REALTEK',                   name: 'Realtek',      country: 'TW' },
  { oui: 'DAHUA',                     name: 'Dahua',        country: 'CN' },
  { oui: 'CDTC',                      name: 'CDTC',         country: 'CN' },
  { oui: 'CMDC',                      name: 'CMDC',         country: 'CN' },
  { oui: 'CUDY',                      name: 'Cudy',         country: 'CN' },
  { oui: 'GREATEK',                   name: 'Greatek',      country: 'BR' },
  { oui: 'HSGQ',                      name: 'HSGQ',         country: 'CN' },
  { oui: 'MERCUSYS',                  name: 'Mercusys',     country: 'CN' },
  { oui: 'MITRASTAR',                 name: 'MitraStar',    country: 'TW' },
  { oui: 'PARKS',                     name: 'Parks',        country: 'BR' },
  { oui: 'SHORELINE',                 name: 'Shoreline',    country: 'BR' },
  { oui: 'SKYWORTH',                  name: 'Skyworth',     country: 'CN' },
  { oui: 'SUMEC',                     name: 'Sumec',        country: 'CN' },
  { oui: 'XPON',                      name: 'XPON',         country: 'CN' },
  { oui: 'ZYXEL',                     name: 'Zyxel',        country: 'TW' },
];

// ─── Modelos de CPEs (baseado nos packages do repositório TR069) ───────────────
const DEVICE_MODELS = [
  // Huawei
  { oui: 'HUAWEI', model: 'HG8145X6-12',  dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'HUAWEI', model: 'EG8245H',       dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'HUAWEI', model: 'EN8255X6S',     dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'HUAWEI', model: 'EG8041V5',      dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'HUAWEI', model: 'BE32-40',       dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'HWTC',   model: 'HG104TAX15',   dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  // Nokia/Alcatel
  { oui: 'NOKIA',  model: 'G-1426G-D',    dataModel: 'DEVICE', type: 'ONU', technology: 'GPON' },
  { oui: 'ALCL',   model: 'G-1425G-B',    dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  // ZTE
  { oui: 'ZTE',    model: 'F670Y',        dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'ZTE',    model: 'F680',         dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'ZTE',    model: 'F8648P',       dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'ZTE',    model: 'H3601',        dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'ZTE',    model: 'ZXHN H3601P',  dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'ZTE',    model: 'F6600P',       dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  // FiberHome
  { oui: 'FIBERHOME', model: 'HG6144F',   dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'FIBERHOME', model: 'SR1041E',   dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'FHTC',      model: 'P20',       dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  // TP-Link
  { oui: 'TP_LINK', model: 'Archer C64',  dataModel: 'IGD', type: 'Router', technology: 'xDSL' },
  { oui: 'TP_LINK', model: 'Archer C80',  dataModel: 'IGD', type: 'Router', technology: 'xDSL' },
  { oui: 'TP_LINK', model: 'XC220-G3',   dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'TP_LINK', model: 'XX230V',      dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'TP_LINK', model: 'EB210 PRO',   dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  // Intelbras
  { oui: '808544',  model: '1200R',       dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  // V-SOL
  { oui: 'MONU',    model: 'V2804AX30',   dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'REALTEK', model: 'V2804AX',     dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  // Outros
  { oui: 'DAHUA',   model: 'RX-3000',     dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'CDTC',    model: 'FD514GS1-R550', dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'CDTC',    model: 'FD514GS1-R580', dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'CDTC',    model: 'FD714GS1-R850', dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'CUDY',    model: 'WR1300',      dataModel: 'IGD', type: 'Router', technology: 'xDSL' },
  { oui: 'GREATEK', model: 'GWR-1200AC',  dataModel: 'IGD', type: 'Router', technology: 'xDSL' },
  { oui: 'MERCUSYS',model: 'MR70X',       dataModel: 'DEVICE', type: 'Router', technology: 'xDSL' },
  { oui: 'MITRASTAR',model: 'GPT-2541GNAC-N1', dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'MITRASTAR',model: 'GPT-2731GN2A4P-N2', dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'MITRASTAR',model: 'GPT-2741GNAC-N1', dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'MITRASTAR',model: 'GPT-2741GNAC-N2', dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'PARKS',   model: 'FIBERLINK511', dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'SHORELINE',model: 'SH-1015W',   dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'SKYWORTH',model: 'XSI-G410-W6', dataModel: 'DEVICE', type: 'ONU', technology: 'GPON' },
  { oui: 'XPON',    model: 'E4L-H6201WA', dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'XPON',    model: 'SUX4G1R2W',   dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'ZYXEL',   model: 'EX3320-T1',   dataModel: 'DEVICE', type: 'ONU', technology: 'GPON' },
  { oui: 'CMDC',    model: 'H3-2S',       dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'HSGQ',    model: 'F881',        dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
  { oui: 'SUMEC',   model: 'SM162021',    dataModel: 'IGD', type: 'ONU', technology: 'GPON' },
];

// ─── Configurações padrão do sistema ─────────────────────────────────────────
const DEFAULT_SETTINGS = {
  // GenieACS
  genieacsNbiUrl: 'http://geniacs-genieacs-nbi-1:7557',
  genieacsCwmpUrl: 'http://geniacs-genieacs-cwmp-1:7547',
  // Coletor de dados
  collectorEnabled: true,
  collectorInterval: 300,        // segundos (5 min)
  collectorHistoryInterval: 3600, // segundos (1h) para histórico
  collectorOfflineAfter: 900,    // segundos (15 min)
  collectorMaxDevices: 1000,
  // Interface
  systemName: 'BR10ACS',
  systemLogo: '',
  sessionExpireTime: 3600,
  mandatory2fa: false,
  intervalChangePassword: 0,
  // Funcionalidades
  allowSoftwareUpdate: true,
  ipv6AutoProvision: 'disabled',
  periodicInterval: 1200,
  periodicIntervalHistory: 3600,
  // Notificações
  notificationsEnabled: false,
  notificationEmail: '',
  // IA
  aiEnabled: false,
  aiAutoSummary: false,
};

// ─── Perfis de permissão ──────────────────────────────────────────────────────
const DEFAULT_ROLES = [
  {
    name: 'super_admin',
    label: 'Super Administrador',
    description: 'Acesso total ao sistema, incluindo configurações críticas',
    priority: 1000,
    permissions: ['*'],
    isSystem: true,
  },
  {
    name: 'admin',
    label: 'Administrador',
    description: 'Acesso completo exceto configurações do sistema e usuários',
    priority: 800,
    permissions: [
      'devices:read', 'devices:write', 'devices:reboot', 'devices:factory_reset',
      'devices:connection_request', 'devices:set_params', 'devices:diagnostics',
      'devices:mass_ops', 'devices:autoconfig',
      'logs:read', 'integrations:read', 'integrations:write',
      'tags:read', 'tags:write',
    ],
    isSystem: true,
  },
  {
    name: 'operator',
    label: 'Operador',
    description: 'Pode visualizar e executar ações básicas nos dispositivos',
    priority: 500,
    permissions: [
      'devices:read', 'devices:reboot', 'devices:connection_request',
      'devices:diagnostics', 'logs:read', 'tags:read',
    ],
    isSystem: true,
  },
  {
    name: 'viewer',
    label: 'Visualizador',
    description: 'Somente leitura — não pode executar ações',
    priority: 100,
    permissions: ['devices:read', 'logs:read', 'tags:read'],
    isSystem: true,
  },
];

// ─── Tags padrão ──────────────────────────────────────────────────────────────
const DEFAULT_TAGS = [
  { name: 'online',        color: '#10b981', description: 'Dispositivo online' },
  { name: 'offline',       color: '#ef4444', description: 'Dispositivo offline' },
  { name: 'sem-sinal',     color: '#f59e0b', description: 'Sem leitura de sinal óptico' },
  { name: 'sinal-critico', color: '#dc2626', description: 'Sinal óptico abaixo de -27 dBm' },
  { name: 'gpon',          color: '#6366f1', description: 'Tecnologia GPON' },
  { name: 'epon',          color: '#8b5cf6', description: 'Tecnologia EPON' },
  { name: 'monitorado',    color: '#0ea5e9', description: 'Dispositivo em monitoramento especial' },
  { name: 'manutencao',    color: '#f97316', description: 'Em manutenção' },
  { name: 'novo',          color: '#84cc16', description: 'Dispositivo recém provisionado' },
];

// ─── AutoConfig padrão por fabricante ────────────────────────────────────────
const DEFAULT_AUTOCONFIGS = [
  {
    name: 'Huawei — Coleta padrão GPON',
    description: 'Coleta sinal óptico, PPPoE, Wi-Fi e hosts para ONUs Huawei',
    enabled: true,
    priority: 100,
    trigger: 'inform',
    conditions: { manufacturer: 'Huawei' },
    actions: [
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.RXPower' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.TXPower' },
      { type: 'get_param', path: 'InternetGatewayDevice.DeviceInfo.UpTime' },
    ],
  },
  {
    name: 'ZTE — Coleta padrão GPON',
    description: 'Coleta sinal óptico, PPPoE, Wi-Fi e hosts para ONUs ZTE',
    enabled: true,
    priority: 100,
    trigger: 'inform',
    conditions: { manufacturer: 'ZTE' },
    actions: [
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.X_ZTE_GponInterfaceConfig.RXPower' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.X_ZTE_GponInterfaceConfig.TXPower' },
      { type: 'get_param', path: 'InternetGatewayDevice.DeviceInfo.UpTime' },
    ],
  },
  {
    name: 'Nokia/Alcatel — Coleta padrão GPON',
    description: 'Coleta sinal óptico, PPPoE, Wi-Fi e hosts para ONUs Nokia',
    enabled: true,
    priority: 100,
    trigger: 'inform',
    conditions: { manufacturer: 'Nokia' },
    actions: [
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.X_ALCL_GponInterfaceConfig.RXPower' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.X_ALCL_GponInterfaceConfig.TXPower' },
      { type: 'get_param', path: 'InternetGatewayDevice.DeviceInfo.UpTime' },
    ],
  },
  {
    name: 'Intelbras — Coleta padrão GPON',
    description: 'Coleta sinal óptico, PPPoE, Wi-Fi e hosts para ONUs Intelbras',
    enabled: true,
    priority: 100,
    trigger: 'inform',
    conditions: { oui: '808544' },
    actions: [
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.ExternalIPAddress' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.Username' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.X_ITBS_PONInterfaceConfig.RXPower' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.X_ITBS_PONInterfaceConfig.TXPower' },
      { type: 'get_param', path: 'InternetGatewayDevice.DeviceInfo.UpTime' },
    ],
  },
  {
    name: 'FiberHome — Coleta padrão GPON',
    description: 'Coleta sinal óptico, PPPoE, Wi-Fi e hosts para ONUs FiberHome',
    enabled: true,
    priority: 100,
    trigger: 'inform',
    conditions: { manufacturer: 'FiberHome' },
    actions: [
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.X_FH_GponInterfaceConfig.RXPower' },
      { type: 'get_param', path: 'InternetGatewayDevice.WANDevice.1.X_FH_GponInterfaceConfig.TXPower' },
      { type: 'get_param', path: 'InternetGatewayDevice.DeviceInfo.UpTime' },
    ],
  },
];

// ─── Funções auxiliares ───────────────────────────────────────────────────────
function log(msg) { console.log(`[BR10ACS Seed] ${msg}`); }
function ok(msg)  { console.log(`  ✓ ${msg}`); }
function warn(msg){ console.log(`  ⚠ ${msg}`); }

async function upsertMany(db, collectionName, docs, keyField) {
  const collection = db.collection(collectionName);
  let inserted = 0, updated = 0;
  for (const doc of docs) {
    const filter = { [keyField]: doc[keyField] };
    const result = await collection.updateOne(
      filter,
      { $setOnInsert: { ...doc, createdAt: new Date() }, $set: { updatedAt: new Date() } },
      { upsert: true }
    );
    if (result.upsertedCount > 0) inserted++;
    else if (result.modifiedCount > 0) updated++;
  }
  return { inserted, updated };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('Conectando ao MongoDB...');
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  const db = mongoose.connection.db;
  log('Conectado!');

  if (RESET) {
    warn('--reset ativado: limpando collections...');
    await Promise.all([
      db.collection('manufacturers').deleteMany({}),
      db.collection('device_models').deleteMany({}),
      db.collection('settings').deleteMany({}),
      db.collection('roles').deleteMany({}),
      db.collection('tags').deleteMany({}),
      db.collection('autoconfigs').deleteMany({}),
    ]);
    warn('Collections limpas.');
  }

  // ── 1. Fabricantes ──────────────────────────────────────────────────────────
  log('Importando fabricantes...');
  const mfResult = await upsertMany(db, 'manufacturers', MANUFACTURERS, 'oui');
  ok(`Fabricantes: ${mfResult.inserted} inseridos, ${mfResult.updated} atualizados`);

  // ── 2. Modelos de dispositivos ──────────────────────────────────────────────
  log('Importando modelos de dispositivos...');
  const mdResult = await upsertMany(db, 'device_models', DEVICE_MODELS.map(m => ({
    ...m,
    key: `${m.oui}|${m.model}`,
  })), 'key');
  ok(`Modelos: ${mdResult.inserted} inseridos, ${mdResult.updated} atualizados`);

  // ── 3. Configurações padrão ─────────────────────────────────────────────────
  log('Importando configurações padrão...');
  const stCol = db.collection('settings');
  const existingSettings = await stCol.findOne({ _type: 'system' });
  if (!existingSettings) {
    await stCol.insertOne({
      _type: 'system',
      ...DEFAULT_SETTINGS,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    ok('Settings: inseridas configurações padrão');
  } else {
    // Apenas adiciona chaves que não existem ainda
    const updates = {};
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (existingSettings[key] === undefined) {
        updates[key] = value;
      }
    }
    if (Object.keys(updates).length > 0) {
      await stCol.updateOne({ _type: 'system' }, { $set: { ...updates, updatedAt: new Date() } });
      ok(`Settings: ${Object.keys(updates).length} novas chaves adicionadas`);
    } else {
      ok('Settings: já existem, nenhuma alteração necessária');
    }
  }

  // ── 4. Perfis de permissão ──────────────────────────────────────────────────
  log('Importando perfis de permissão...');
  const rolesResult = await upsertMany(db, 'roles', DEFAULT_ROLES, 'name');
  ok(`Roles: ${rolesResult.inserted} inseridas, ${rolesResult.updated} atualizadas`);

  // ── 5. Tags padrão ──────────────────────────────────────────────────────────
  log('Importando tags padrão...');
  const tagsResult = await upsertMany(db, 'tags', DEFAULT_TAGS, 'name');
  ok(`Tags: ${tagsResult.inserted} inseridas, ${tagsResult.updated} atualizadas`);

  // ── 6. AutoConfig padrão ────────────────────────────────────────────────────
  log('Importando AutoConfig padrão...');
  const acResult = await upsertMany(db, 'autoconfigs', DEFAULT_AUTOCONFIGS, 'name');
  ok(`AutoConfig: ${acResult.inserted} inseridas, ${acResult.updated} atualizadas`);

  // ── 7. Índices ───────────────────────────────────────────────────────────────
  log('Criando índices...');
  await db.collection('manufacturers').createIndex({ oui: 1 }, { unique: true });
  await db.collection('device_models').createIndex({ key: 1 }, { unique: true });
  await db.collection('device_models').createIndex({ oui: 1 });
  await db.collection('roles').createIndex({ name: 1 }, { unique: true });
  await db.collection('tags').createIndex({ name: 1 }, { unique: true });
  await db.collection('autoconfigs').createIndex({ name: 1 }, { unique: true });
  await db.collection('autoconfigs').createIndex({ enabled: 1, priority: -1 });
  ok('Índices criados');

  await mongoose.disconnect();

  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  BR10ACS Seed concluído com sucesso!');
  console.log('════════════════════════════════════════');
  console.log(`  Fabricantes:   ${MANUFACTURERS.length}`);
  console.log(`  Modelos CPEs:  ${DEVICE_MODELS.length}`);
  console.log(`  Roles:         ${DEFAULT_ROLES.length}`);
  console.log(`  Tags:          ${DEFAULT_TAGS.length}`);
  console.log(`  AutoConfigs:   ${DEFAULT_AUTOCONFIGS.length}`);
  console.log('');
  process.exit(0);
}

main().catch(err => {
  console.error('[BR10ACS Seed] ERRO:', err.message);
  process.exit(1);
});
