import { Injectable } from '@nestjs/common';
import { GenieAcsService } from '../genieacs/genieacs.service';

@Injectable()
export class PresetsService {
  constructor(private readonly genieAcs: GenieAcsService) {}

  // ── Presets ──────────────────────────────────────────────────────────────────

  async listPresets(): Promise<any[]> {
    return this.genieAcs.getPresets();
  }

  async putPreset(name: string, preset: object): Promise<void> {
    return this.genieAcs.putPreset(name, preset);
  }

  async deletePreset(name: string): Promise<void> {
    return this.genieAcs.deletePreset(name);
  }

  // ── Provisions ───────────────────────────────────────────────────────────────

  async listProvisions(): Promise<any[]> {
    return this.genieAcs.getProvisions();
  }

  async putProvision(name: string, script: string): Promise<void> {
    return this.genieAcs.putProvision(name, script);
  }

  async deleteProvision(name: string): Promise<void> {
    return this.genieAcs.deleteProvision(name);
  }

  // ── Templates de coleta por modelo ───────────────────────────────────────────
  // Cria uma provisão que declara os parâmetros essenciais para coleta e
  // um preset que aplica essa provisão a todos os dispositivos com o OUI informado.

  async applyTemplate(oui: string, productClass?: string): Promise<{ provision: string; preset: string }> {
    const safeName = `br10acs_${oui.toLowerCase().replace(/[^a-z0-9]/g, '_')}${productClass ? '_' + productClass.toLowerCase().replace(/[^a-z0-9]/g, '_') : ''}`;

    const provisionScript = `// Provisão automática BR10ACS — OUI: ${oui}${productClass ? ', Modelo: ' + productClass : ''}
const now = Date.now();

// DeviceInfo
declare('InternetGatewayDevice.DeviceInfo.SoftwareVersion', {value: now});
declare('InternetGatewayDevice.DeviceInfo.HardwareVersion', {value: now});
declare('InternetGatewayDevice.DeviceInfo.UpTime', {value: now});
declare('InternetGatewayDevice.DeviceInfo.Manufacturer', {value: now});
declare('InternetGatewayDevice.DeviceInfo.ModelName', {value: now});
declare('InternetGatewayDevice.DeviceInfo.ProductClass', {value: now});
declare('InternetGatewayDevice.DeviceInfo.SerialNumber', {value: now});
declare('InternetGatewayDevice.DeviceInfo.OUI', {value: now});

// WAN — PPPoE e tráfego
declare('InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Username', {value: now});
declare('InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ExternalIPAddress', {value: now});
declare('InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.DefaultGateway', {value: now});
declare('InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.DNSServers', {value: now});
declare('InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.ConnectionStatus', {value: now});
declare('InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.MACAddress', {value: now});
declare('InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Stats.EthernetBytesReceived', {value: now});
declare('InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Stats.EthernetBytesSent', {value: now});
declare('InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Stats.BytesReceived', {value: now});
declare('InternetGatewayDevice.WANDevice.*.WANConnectionDevice.*.WANPPPConnection.*.Stats.BytesSent', {value: now});
declare('InternetGatewayDevice.WANDevice.*.WANCommonInterfaceConfig.TotalBytesReceived', {value: now});
declare('InternetGatewayDevice.WANDevice.*.WANCommonInterfaceConfig.TotalBytesSent', {value: now});

// Sinal óptico — Intelbras (typo: Interafce)
declare('InternetGatewayDevice.WANDevice.*.X_GponInterafceConfig.RXPower', {value: now});
declare('InternetGatewayDevice.WANDevice.*.X_GponInterafceConfig.TXPower', {value: now});
declare('InternetGatewayDevice.WANDevice.*.X_GponInterafceConfig.Voltage', {value: now});
declare('InternetGatewayDevice.WANDevice.*.X_GponInterafceConfig.TransceiverTemperature', {value: now});
declare('InternetGatewayDevice.WANDevice.*.X_GponInterafceConfig.LinkStatus', {value: now});

// Sinal óptico — ZTE / Huawei / Nokia
declare('InternetGatewayDevice.WANDevice.*.X_ZTE-COM_GponInterfaceConfig.RXPower', {value: now});
declare('InternetGatewayDevice.WANDevice.*.X_ZTE-COM_GponInterfaceConfig.TXPower', {value: now});
declare('InternetGatewayDevice.WANDevice.*.X_ITBS_ORG_GponInterfaceConfig.RXPower', {value: now});
declare('InternetGatewayDevice.WANDevice.*.X_ITBS_ORG_GponInterfaceConfig.TXPower', {value: now});

// LAN — Hosts e Wi-Fi
declare('InternetGatewayDevice.LANDevice.*.Hosts.HostNumberOfEntries', {value: now});
declare('InternetGatewayDevice.LANDevice.*.Hosts.Host.*.HostName', {value: now});
declare('InternetGatewayDevice.LANDevice.*.Hosts.Host.*.IPAddress', {value: now});
declare('InternetGatewayDevice.LANDevice.*.Hosts.Host.*.MACAddress', {value: now});
declare('InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.SSID', {value: now});
declare('InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.Enable', {value: now});
declare('InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.Channel', {value: now});
declare('InternetGatewayDevice.LANDevice.*.WLANConfiguration.*.TotalAssociations', {value: now});

// ManagementServer
declare('InternetGatewayDevice.ManagementServer.ConnectionRequestURL', {value: now});
declare('InternetGatewayDevice.ManagementServer.ConnectionRequestUsername', {value: now});
declare('InternetGatewayDevice.ManagementServer.PeriodicInformInterval', {value: now});`;

    const presetBody: Record<string, unknown> = {
      weight: 100,
      precondition: productClass
        ? `{"DeviceID.OUI": "${oui}", "DeviceID.ProductClass": "${productClass}"}`
        : `{"DeviceID.OUI": "${oui}"}`,
      configurations: [
        { type: 'provision', name: safeName },
      ],
    };

    await this.genieAcs.putProvision(safeName, provisionScript);
    await this.genieAcs.putPreset(safeName, presetBody);

    return { provision: safeName, preset: safeName };
  }
}
