import { GenieDevice } from '../../genieacs/genieacs.service';
import { OPTICAL_SIGNAL_PATHS, TEMPERATURE_PATHS, VOLTAGE_PATHS } from './data-models';

export interface NormalizedDevice {
  id: string;
  oui: string;
  productClass: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  softwareVersion: string;
  hardwareVersion: string;
  lastInform: Date | null;
  registered: Date | null;
  tags: string[];

  // Conectividade
  online: boolean;
  state: 'online' | 'offline' | 'unknown';
  ageSeconds: number;
  offlineAfterSeconds: number;
  connectionRequestUrl: string;
  uptime: number | null;

  // Rede WAN
  ipv4: string | null;
  ipv6: string | null;
  pppLogin: string | null;
  pppGateway: string | null;
  pppDNSServers: string | null;
  pppConnectionStatus: string | null;
  pppMACAddress: string | null;
  pppTransportType: string | null;
  wanBytesReceived: number | null;
  wanBytesSent: number | null;

  // Sinal óptico
  rxPower: number | null;
  txPower: number | null;
  temperature: number | null;
  voltage: number | null;
  ponBiasCurrent: number | null;    // mA
  ponTemperature: number | null;   // °C (transceiver)
  ponVoltage: number | null;       // mV
  temperatureSensors: TemperatureSensor[];

  // Portas LAN Ethernet
  lanPorts: LanPort[];

  // Wi-Fi
  wifiNetworks: WifiNetwork[];

  // Hosts
  hosts: ConnectedHost[];

  // Sistema
  memoryFree: number | null;
  memoryTotal: number | null;
  cpuUsage: number | null;
  periodicInterval: number | null;
  acsUrl: string | null;
  connectionRequestUsername: string | null;
}

export interface TemperatureSensor {
  index: number;
  name: string;
  value: number;
  enabled: boolean;
}

export interface LanPort {
  index: number;
  name: string;
  enabled: boolean;
  maxBitRate: number | null;  // Mbps
  duplexMode: string | null;
  mac: string | null;
  bytesReceived: number | null;
  bytesSent: number | null;
  packetsReceived: number | null;
  packetsSent: number | null;
}

export interface WifiNetwork {
  index: number;
  ssid: string;
  enabled: boolean;
  status: string;
  channel: number | null;
  autoChannel: boolean;
  bandwidth: string | null;
  password: string | null;
  bssid: string | null;
  associated: number;
  transmitPower: string | null;
  band: string;
  path: string;
}

export interface ConnectedHost {
  hostname: string;
  ip: string;
  ipv6: string | null;
  mac: string;
  interfaceType: string;
  active: boolean;
  layer2Interface: string | null;
  addressSource: string | null;
}

export class DeviceNormalizer {
  private static readonly OFFLINE_THRESHOLD = 900; // 15 minutos

  static normalize(device: GenieDevice): NormalizedDevice {
    const id = device._id || '';
    const parts = id.split('-');
    const oui = parts[0] || '';
    const productClass = parts[1] || '';
    const serialNumber = parts.slice(2).join('-') || '';

    const lastInform = device._lastInform ? new Date(device._lastInform) : null;
    const registered = device._registered ? new Date(device._registered) : null;
    const ageSeconds = lastInform ? Math.floor((Date.now() - lastInform.getTime()) / 1000) : 99999;
    const offlineAfterSeconds = this.OFFLINE_THRESHOLD;
    const online = ageSeconds < offlineAfterSeconds;

    return {
      id,
      oui,
      productClass,
      serialNumber,
      manufacturer: this.extractStr(device, [
        'DeviceID._Manufacturer._value',
        'InternetGatewayDevice.DeviceInfo.Manufacturer._value',
        'Device.DeviceInfo.Manufacturer._value',
      ]) || oui,
      model: this.extractStr(device, [
        'DeviceID._ProductClass._value',
        'InternetGatewayDevice.DeviceInfo.ModelName._value',
        'Device.DeviceInfo.ModelName._value',
      ]) || productClass,
      softwareVersion: this.extractStr(device, [
        'InternetGatewayDevice.DeviceInfo.SoftwareVersion._value',
        'Device.DeviceInfo.SoftwareVersion._value',
      ]),
      hardwareVersion: this.extractStr(device, [
        'InternetGatewayDevice.DeviceInfo.HardwareVersion._value',
        'Device.DeviceInfo.HardwareVersion._value',
      ]),
      lastInform,
      registered,
      tags: device._tags || [],
      online,
      state: online ? 'online' : 'offline',
      ageSeconds,
      offlineAfterSeconds,
      connectionRequestUrl: this.extractStr(device, [
        'InternetGatewayDevice.ManagementServer.ConnectionRequestURL._value',
        'Device.ManagementServer.ConnectionRequestURL._value',
      ]),
      uptime: this.extractNum(device, [
        'InternetGatewayDevice.DeviceInfo.UpTime._value',
        'Device.DeviceInfo.UpTime._value',
      ]),

      // WAN — tenta múltiplos índices de WANConnectionDevice
      ipv4: this.extractWanPpp(device, 'ExternalIPAddress') ||
            this.extractWanIp(device, 'ExternalIPAddress'),
      ipv6: this.extractWanPpp(device, 'ExternalIPv6Address') ||
            this.extractWanIp(device, 'ExternalIPv6Address') ||
            this.extractWanIpv6Itbs(device) ||
            this.extractStr(device, [
              'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_ITBS_IPv6Address._value',
              'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.X_ITBS_IPv6Address._value',
              'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_ITBS_IPv6ExternalAddress._value',
              'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.X_ITBS_IPv6ExternalAddress._value',
              'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_ITBS_IPv6GUAFormPrefixAddress._value',
              'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.X_ITBS_IPv6GUAFormPrefixAddress._value',
              'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_ITBS_IPv6PrefixDelegationAddress._value',
              'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANPPPConnection.1.X_ITBS_IPv6PrefixDelegationAddress._value',
            ]),
      pppLogin: this.extractWanPpp(device, 'Username'),
      pppGateway: this.extractWanPpp(device, 'DefaultGateway') ||
                  this.extractWanIp(device, 'DefaultGateway'),
      pppDNSServers: this.extractWanPpp(device, 'DNSServers') ||
                     this.extractWanIp(device, 'DNSServers'),
      pppConnectionStatus: this.extractWanPpp(device, 'ConnectionStatus'),
      pppMACAddress: this.extractWanPpp(device, 'MACAddress'),
      pppTransportType: this.extractWanPpp(device, 'TransportType'),
      wanBytesReceived: this.extractWanTraffic(device, 'BytesReceived'),
      wanBytesSent: this.extractWanTraffic(device, 'BytesSent'),

      // Sinal óptico
      rxPower: this.extractOptical(device, 'RXPower') || this.extractOptical(device, 'RxPower'),
      txPower: this.extractOptical(device, 'TXPower') || this.extractOptical(device, 'TxPower'),
      temperature: this.extractFromPaths(device, TEMPERATURE_PATHS),
      voltage: this.extractFromPaths(device, VOLTAGE_PATHS),
      ponBiasCurrent: this.extractNum(device, [
        'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.BiasCurrent._value',
        'InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.BiasCurrent._value',
      ]),
      ponTemperature: this.extractNum(device, [
        'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TransceiverTemperature._value',
        'InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.TransceiverTemperature._value',
      ]),
      ponVoltage: this.extractNum(device, [
        'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.SupplyVoltage._value',
        'InternetGatewayDevice.WANDevice.1.X_GponInterfaceConfig.SupplyVoltage._value',
      ]),
      temperatureSensors: this.extractTemperatureSensors(device),

      // Portas LAN Ethernet
      lanPorts: this.extractLanPorts(device),

      // Wi-Fi
      wifiNetworks: this.extractWifiNetworks(device),

      // Hosts
      hosts: this.extractHosts(device),

      // Sistema
      memoryFree: this.extractNum(device, [
        'InternetGatewayDevice.DeviceInfo.MemoryStatus.Free._value',
        'Device.DeviceInfo.MemoryStatus.Free._value',
      ]),
      memoryTotal: this.extractNum(device, [
        'InternetGatewayDevice.DeviceInfo.MemoryStatus.Total._value',
        'Device.DeviceInfo.MemoryStatus.Total._value',
      ]),
      cpuUsage: this.extractNum(device, [
        'InternetGatewayDevice.DeviceInfo.ProcessStatus.CPUUsage._value',
        'Device.DeviceInfo.ProcessStatus.CPUUsage._value',
      ]),
      periodicInterval: this.extractNum(device, [
        'InternetGatewayDevice.ManagementServer.PeriodicInformInterval._value',
        'Device.ManagementServer.PeriodicInformInterval._value',
      ]),
      acsUrl: this.extractStr(device, [
        'InternetGatewayDevice.ManagementServer.URL._value',
        'Device.ManagementServer.URL._value',
      ]),
      connectionRequestUsername: this.extractStr(device, [
        'InternetGatewayDevice.ManagementServer.ConnectionRequestUsername._value',
        'Device.ManagementServer.ConnectionRequestUsername._value',
      ]),
    };
  }

  // ─── Extratores privados ──────────────────────────────────────────────────

  private static getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current == null) return null;
      current = current[part];
    }
    return current;
  }

  private static extractStr(device: GenieDevice, paths: string[]): string | null {
    for (const path of paths) {
      const val = this.getNestedValue(device, path);
      if (val != null && val !== '') return String(val);
    }
    return null;
  }

  private static extractNum(device: GenieDevice, paths: string[]): number | null {
    for (const path of paths) {
      const val = this.getNestedValue(device, path);
      if (val != null && val !== '') {
        const n = parseFloat(String(val));
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  private static extractFromPaths(device: GenieDevice, paths: string[]): number | null {
    for (const path of paths) {
      const val = this.getNestedValue(device, path + '._value');
      if (val != null && val !== '') {
        const n = parseFloat(String(val));
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  private static extractWanPpp(device: GenieDevice, field: string): string | null {
    // Tenta WANDevice.1 com WANConnectionDevice.1 e .2
    for (const wanIdx of ['1', '2']) {
      for (const connIdx of ['1', '2']) {
        const path = `InternetGatewayDevice.WANDevice.${wanIdx}.WANConnectionDevice.${connIdx}.WANPPPConnection.1.${field}._value`;
        const val = this.getNestedValue(device, path);
        if (val != null && val !== '') return String(val);
      }
    }
    return null;
  }

  private static extractWanIp(device: GenieDevice, field: string): string | null {
    for (const wanIdx of ['1', '2']) {
      for (const connIdx of ['1', '2']) {
        const path = `InternetGatewayDevice.WANDevice.${wanIdx}.WANConnectionDevice.${connIdx}.WANIPConnection.1.${field}._value`;
        const val = this.getNestedValue(device, path);
        if (val != null && val !== '') return String(val);
      }
    }
    return null;
  }

  private static extractWanTraffic(device: GenieDevice, field: string): number | null {
    // field = 'BytesReceived' ou 'BytesSent'
    const ethField = field.replace('Bytes', 'EthernetBytes'); // EthernetBytesReceived / EthernetBytesSent
    for (const wanIdx of ['1', '2']) {
      for (const connIdx of ['1', '2']) {
        for (const connType of ['WANPPPConnection', 'WANIPConnection']) {
          // Tenta o campo padrão e o campo Ethernet (Intelbras)
          for (const f of [field, ethField]) {
            const path = `InternetGatewayDevice.WANDevice.${wanIdx}.WANConnectionDevice.${connIdx}.${connType}.1.Stats.${f}._value`;
            const val = this.getNestedValue(device, path);
            if (val != null && val !== '') {
              const n = parseFloat(String(val));
              if (!isNaN(n) && n > 0) return n;
            }
          }
        }
      }
    }
    // Fallback: WANCommonInterfaceConfig
    const totalField = field === 'BytesReceived' ? 'TotalBytesReceived' : 'TotalBytesSent';
    for (const wanIdx of ['1', '2']) {
      const path = `InternetGatewayDevice.WANDevice.${wanIdx}.WANCommonInterfaceConfig.${totalField}._value`;
      const val = this.getNestedValue(device, path);
      if (val != null && val !== '') {
        const n = parseFloat(String(val));
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return null;
  }

  private static extractOptical(device: GenieDevice, field: string): number | null {
    const matchingPaths = OPTICAL_SIGNAL_PATHS.filter((p) => p.endsWith(field));
    for (const path of matchingPaths) {
      const val = this.getNestedValue(device, path + '._value');
      if (val != null && val !== '') {
        const n = parseFloat(String(val));
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  private static extractWifiNetworks(device: GenieDevice): WifiNetwork[] {
    const networks: WifiNetwork[] = [];
    const wlanBase = device?.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration;
    if (!wlanBase) return networks;

    for (const idx of Object.keys(wlanBase)) {
      if (isNaN(Number(idx))) continue;
      const wlan = wlanBase[idx];
      if (!wlan) continue;

      const ssid = wlan.SSID?._value;
      if (!ssid) continue;

      const band = this.detectBand(wlan, Number(idx));
      networks.push({
        index: Number(idx),
        ssid: String(ssid),
        enabled: wlan.Enable?._value === true || wlan.Enable?._value === 'true',
        status: String(wlan.Status?._value || 'Unknown'),
        channel: wlan.Channel?._value != null ? Number(wlan.Channel._value) : null,
        autoChannel: wlan.AutoChannelEnable?._value === true,
        bandwidth: wlan.BandWidth?._value ? String(wlan.BandWidth._value) : null,
        password: wlan.KeyPassphrase?._value ? String(wlan.KeyPassphrase._value) : null,
        bssid: wlan.BSSID?._value ? String(wlan.BSSID._value) : null,
        associated: Number(wlan.TotalAssociations?._value || 0),
        transmitPower: wlan.TransmitPower?._value ? String(wlan.TransmitPower._value) : null,
        band,
        path: `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx}.`,
      });
    }
    return networks;
  }

  private static extractHostIpv6(host: any): string | null {
    // Campos comuns de IPv6 em tabelas de hosts TR-069
    const fields = [
      'IPv6Address',
      'X_ITBS_IPv6Address',
      'X_HW_IPv6Address',
      'X_ZTE_IPv6Address',
      'X_ALCL_IPv6Address',
      'X_CT-COM_IPv6Address',
    ];
    for (const f of fields) {
      const val = host[f]?._value;
      if (val && val !== '' && val !== '::' && val !== '0::0') return String(val);
    }
    // Tenta IPv6AddressList (alguns modelos retornam lista separada por vírgula)
    const list = host.IPv6AddressList?._value || host.X_ITBS_IPv6AddressList?._value;
    if (list && list !== '') {
      const first = String(list).split(',')[0].trim();
      if (first && first !== '::') return first;
    }
    return null;
  }

  private static extractWanIpv6Itbs(device: GenieDevice): string | null {
    // Extrai IPv6 WAN dos campos X_ITBS específicos para equipamentos ITBS/Intelbras
    for (const wanIdx of ['1', '2']) {
      for (const connIdx of ['1', '2']) {
        const base = `InternetGatewayDevice.WANDevice.${wanIdx}.WANConnectionDevice.${connIdx}.WANPPPConnection.1`;
        // Prefixo delegado (ex: 2804:2e48:a:a289::/64) — extrai apenas o endereço sem a máscara
        const prefixPath = `${base}.X_ITBS_IPv6PrefixDelegationAddress._value`;
        const prefix = this.getNestedValue(device, prefixPath);
        if (prefix && prefix !== '' && prefix !== '::') {
          // Retorna o prefixo completo (inclui /64 para indicar que é delegado)
          return String(prefix);
        }
        // GUA formado a partir do prefixo
        const guaPath = `${base}.X_ITBS_IPv6GUAFormPrefixAddress._value`;
        const gua = this.getNestedValue(device, guaPath);
        if (gua && gua !== '' && gua !== '::') return String(gua);
        // Endereço externo IPv6
        const extPath = `${base}.X_ITBS_IPv6ExternalAddress._value`;
        const ext = this.getNestedValue(device, extPath);
        if (ext && ext !== '' && ext !== '::') return String(ext);
      }
    }
    return null;
  }

  private static detectBand(wlan: any, index: number): string {
    const bw = String(wlan.BandWidth?._value || '');
    const ch = Number(wlan.Channel?._value || 0);
    if (bw.includes('5') || bw.includes('5.8') || ch > 14) return '5GHz';
    if (bw.includes('2.4') || (ch >= 1 && ch <= 13)) return '2.4GHz';
    // Heurística por índice (pares = 5GHz em muitos modelos)
    return index % 2 === 0 ? '5GHz' : '2.4GHz';
  }

  private static extractHosts(device: GenieDevice): ConnectedHost[] {
    const hosts: ConnectedHost[] = [];
    const hostsBase = device?.InternetGatewayDevice?.LANDevice?.['1']?.Hosts?.Host;
    if (!hostsBase) return hosts;

    for (const idx of Object.keys(hostsBase)) {
      if (isNaN(Number(idx))) continue;
      const host = hostsBase[idx];
      if (!host) continue;
      const ip = host.IPAddress?._value;
      const mac = host.MACAddress?._value;
      if (!ip && !mac) continue;

      // Tenta extrair IPv6 do host via múltiplos campos
      const ipv6 = this.extractHostIpv6(host);

      hosts.push({
        hostname: String(host.HostName?._value || ''),
        ip: String(ip || ''),
        ipv6,
        mac: String(mac || ''),
        interfaceType: String(host.InterfaceType?._value || ''),
        active: host.Active?._value === true || host.Active?._value === '1',
        layer2Interface: host.Layer2Interface?._value ? String(host.Layer2Interface._value) : null,
        addressSource: host.AddressSource?._value ? String(host.AddressSource._value) : null,
      });
    }
    return hosts;
  }

  private static extractTemperatureSensors(device: GenieDevice): TemperatureSensor[] {
    const sensors: TemperatureSensor[] = [];
    const base = device?.InternetGatewayDevice?.DeviceInfo?.TemperatureStatus?.TemperatureSensor;
    if (!base) return sensors;
    for (const idx of Object.keys(base)) {
      if (isNaN(Number(idx))) continue;
      const s = base[idx];
      if (!s) continue;
      const value = s.Value?._value;
      if (value == null) continue;
      sensors.push({
        index: Number(idx),
        name: String(s.Name?._value || `Sensor ${idx}`),
        value: parseFloat(String(value)),
        enabled: s.Enable?._value === true || s.Enable?._value === 'true' || s.Enable?._value === '1',
      });
    }
    return sensors;
  }

  private static extractLanPorts(device: GenieDevice): LanPort[] {
    const ports: LanPort[] = [];
    const base = device?.InternetGatewayDevice?.LANDevice?.['1']?.LANEthernetInterfaceConfig;
    if (!base) return ports;
    for (const idx of Object.keys(base)) {
      if (isNaN(Number(idx))) continue;
      const p = base[idx];
      if (!p) continue;
      ports.push({
        index: Number(idx),
        name: String(p.Name?._value || `LAN${idx}`),
        enabled: p.Enable?._value === true || p.Enable?._value === 'true' || p.Enable?._value === '1',
        maxBitRate: p.MaxBitRate?._value != null ? parseFloat(String(p.MaxBitRate._value)) : null,
        duplexMode: p.DuplexMode?._value ? String(p.DuplexMode._value) : null,
        mac: p.MACAddress?._value ? String(p.MACAddress._value) : null,
        bytesReceived: p.Stats?.BytesReceived?._value != null ? parseFloat(String(p.Stats.BytesReceived._value)) : null,
        bytesSent: p.Stats?.BytesSent?._value != null ? parseFloat(String(p.Stats.BytesSent._value)) : null,
        packetsReceived: p.Stats?.PacketsReceived?._value != null ? parseFloat(String(p.Stats.PacketsReceived._value)) : null,
        packetsSent: p.Stats?.PacketsSent?._value != null ? parseFloat(String(p.Stats.PacketsSent._value)) : null,
      });
    }
    return ports;
  }
}
