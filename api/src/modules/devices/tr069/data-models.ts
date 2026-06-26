/**
 * BR10ACS — Mapeamento de parâmetros TR-069 para campos normalizados.
 * Suporta tanto InternetGatewayDevice (IGD/TR-098) quanto Device (TR-181).
 */

export const IGD_PARAM_MAP: Record<string, string> = {
  // DeviceInfo
  'InternetGatewayDevice.DeviceInfo.UpTime': 'upTime',
  'InternetGatewayDevice.DeviceInfo.ModelName': 'modelName',
  'InternetGatewayDevice.DeviceInfo.SerialNumber': 'serialNumber',
  'InternetGatewayDevice.DeviceInfo.SoftwareVersion': 'softwareVersion',
  'InternetGatewayDevice.DeviceInfo.HardwareVersion': 'hardwareVersion',
  'InternetGatewayDevice.DeviceInfo.Manufacturer': 'manufacturer',
  'InternetGatewayDevice.DeviceInfo.ProductClass': 'productClass',
  'InternetGatewayDevice.DeviceInfo.MemoryStatus.Free': 'memoryFree',
  'InternetGatewayDevice.DeviceInfo.MemoryStatus.Total': 'memoryTotal',
  'InternetGatewayDevice.DeviceInfo.ProcessStatus.CPUUsage': 'cpuUsage',

  // ManagementServer
  'InternetGatewayDevice.ManagementServer.ConnectionRequestUsername': 'connectionRequestUsername',
  'InternetGatewayDevice.ManagementServer.ConnectionRequestPassword': 'connectionRequestPassword',
  'InternetGatewayDevice.ManagementServer.PeriodicInformInterval': 'periodicInterval',
  'InternetGatewayDevice.ManagementServer.URL': 'acsUrl',

  // WAN PPP
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.Username': 'pppLogin',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.Password': 'pppPassword',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.Enable': 'pppEnable',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.ConnectionStatus': 'pppConnectionStatus',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.ExternalIPAddress': 'ipv4',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.DefaultGateway': 'pppGateway',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.DNSServers': 'pppDNSServers',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.MACAddress': 'pppMACAddress',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.NATEnabled': 'pppNat',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.LastConnectionError': 'pppLastError',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.Stats.BytesReceived': 'wanBytesReceived',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.Stats.BytesSent': 'wanBytesSent',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANPPPConnection.{i}.TransportType': 'pppTransportType',

  // WAN IP
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANIPConnection.{i}.ExternalIPAddress': 'ipv4',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANIPConnection.{i}.DefaultGateway': 'ipGateway',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANIPConnection.{i}.DNSServers': 'ipDNSServers',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANIPConnection.{i}.MACAddress': 'ipMACAddress',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANIPConnection.{i}.Stats.BytesReceived': 'wanBytesReceived',
  'InternetGatewayDevice.WANDevice.{i}.WANConnectionDevice.{i}.WANIPConnection.{i}.Stats.BytesSent': 'wanBytesSent',

  // Wi-Fi
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.SSID': 'wifiSsid',
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.KeyPassphrase': 'wifiPassword',
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.Enable': 'wifiEnabled',
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.Status': 'wifiStatus',
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.Channel': 'wifiChannel',
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.AutoChannelEnable': 'wifiAutoChannel',
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.BandWidth': 'wifiBandwidth',
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.Standard': 'wifiStandard',
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.BSSID': 'wifiBSSID',
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.TotalAssociations': 'wifiAssociated',
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.TransmitPower': 'wifiTransmitPower',
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.BeaconType': 'wifiBeaconType',
  'InternetGatewayDevice.LANDevice.{i}.WLANConfiguration.{i}.WPAEncryptionModes': 'wifiEncryption',

  // Hosts
  'InternetGatewayDevice.LANDevice.{i}.Hosts.Host.{i}.HostName': 'hostName',
  'InternetGatewayDevice.LANDevice.{i}.Hosts.Host.{i}.IPAddress': 'hostIp',
  'InternetGatewayDevice.LANDevice.{i}.Hosts.Host.{i}.MACAddress': 'hostMAC',
  'InternetGatewayDevice.LANDevice.{i}.Hosts.Host.{i}.InterfaceType': 'hostInterfaceType',
  'InternetGatewayDevice.LANDevice.{i}.Hosts.Host.{i}.Active': 'hostActive',
  'InternetGatewayDevice.LANDevice.{i}.Hosts.HostNumberOfEntries': 'hostNumberOfEntries',

  // LAN
  'InternetGatewayDevice.LANDevice.{i}.LANHostConfigManagement.IPInterface.{i}.IPInterfaceIPAddress': 'lanIpAddress',
  'InternetGatewayDevice.LANDevice.{i}.LANHostConfigManagement.SubnetMask': 'lanSubnetMask',
  'InternetGatewayDevice.LANDevice.{i}.LANHostConfigManagement.DHCPServerEnable': 'dhcpEnabled',
  'InternetGatewayDevice.LANDevice.{i}.LANHostConfigManagement.MinAddress': 'dhcpMinAddress',
  'InternetGatewayDevice.LANDevice.{i}.LANHostConfigManagement.MaxAddress': 'dhcpMaxAddress',
  'InternetGatewayDevice.LANDevice.{i}.LANHostConfigManagement.DNSServers': 'dhcpDNSServers',

  // Ethernet
  'InternetGatewayDevice.LANDevice.{i}.LANEthernetInterfaceConfig.{i}.Status': 'lanStatus',
  'InternetGatewayDevice.LANDevice.{i}.LANEthernetInterfaceConfig.{i}.Stats.BytesSent': 'lanBytesSent',
  'InternetGatewayDevice.LANDevice.{i}.LANEthernetInterfaceConfig.{i}.Stats.BytesReceived': 'lanBytesReceived',
  'InternetGatewayDevice.LANDevice.{i}.LANEthernetInterfaceConfig.{i}.MaxBitRate': 'lanPortSpeed',

  // Ping
  'InternetGatewayDevice.IPPingDiagnostics.DiagnosticsState': 'pingState',
  'InternetGatewayDevice.IPPingDiagnostics.Host': 'pingHost',
  'InternetGatewayDevice.IPPingDiagnostics.AverageResponseTime': 'pingAvgTime',
  'InternetGatewayDevice.IPPingDiagnostics.MinimumResponseTime': 'pingMinTime',
  'InternetGatewayDevice.IPPingDiagnostics.MaximumResponseTime': 'pingMaxTime',
  'InternetGatewayDevice.IPPingDiagnostics.SuccessCount': 'pingSuccess',
  'InternetGatewayDevice.IPPingDiagnostics.FailureCount': 'pingFailure',

  // Traceroute
  'InternetGatewayDevice.TraceRouteDiagnostics.DiagnosticsState': 'tracerouteState',
  'InternetGatewayDevice.TraceRouteDiagnostics.Host': 'tracerouteHost',

  // Download Diagnostics
  'InternetGatewayDevice.DownloadDiagnostics.DiagnosticsState': 'downloadDiagState',
  'InternetGatewayDevice.DownloadDiagnostics.DownloadURL': 'downloadDiagUrl',
  'InternetGatewayDevice.DownloadDiagnostics.TotalBytesReceived': 'downloadDiagBytes',
  'InternetGatewayDevice.DownloadDiagnostics.TestBytesReceived': 'downloadDiagTestBytes',
};

export const TR181_PARAM_MAP: Record<string, string> = {
  // DeviceInfo
  'Device.DeviceInfo.UpTime': 'upTime',
  'Device.DeviceInfo.ModelName': 'modelName',
  'Device.DeviceInfo.SerialNumber': 'serialNumber',
  'Device.DeviceInfo.SoftwareVersion': 'softwareVersion',
  'Device.DeviceInfo.HardwareVersion': 'hardwareVersion',
  'Device.DeviceInfo.Manufacturer': 'manufacturer',
  'Device.DeviceInfo.ProductClass': 'productClass',
  'Device.DeviceInfo.MemoryStatus.Free': 'memoryFree',
  'Device.DeviceInfo.MemoryStatus.Total': 'memoryTotal',
  'Device.DeviceInfo.ProcessStatus.CPUUsage': 'cpuUsage',

  // ManagementServer
  'Device.ManagementServer.ConnectionRequestUsername': 'connectionRequestUsername',
  'Device.ManagementServer.ConnectionRequestPassword': 'connectionRequestPassword',
  'Device.ManagementServer.PeriodicInformInterval': 'periodicInterval',
  'Device.ManagementServer.URL': 'acsUrl',

  // PPP
  'Device.PPP.Interface.{i}.Username': 'pppLogin',
  'Device.PPP.Interface.{i}.Password': 'pppPassword',
  'Device.PPP.Interface.{i}.Enable': 'pppEnable',
  'Device.PPP.Interface.{i}.ConnectionStatus': 'pppConnectionStatus',
  'Device.PPP.Interface.{i}.IPCP.RemoteIPAddress': 'ipv4',
  'Device.PPP.Interface.{i}.IPCP.DNSServers': 'pppDNSServers',
  'Device.PPP.Interface.{i}.Stats.BytesReceived': 'wanBytesReceived',
  'Device.PPP.Interface.{i}.Stats.BytesSent': 'wanBytesSent',
  'Device.PPP.Interface.{i}.LastConnectionError': 'pppLastError',

  // IP
  'Device.IP.Interface.{i}.IPv4Address.{i}.IPAddress': 'ipv4',
  'Device.IP.Interface.{i}.IPv6Address.{i}.IPAddress': 'ipv6',
  'Device.IP.Interface.{i}.IPv6Enable': 'ipv6Enable',

  // Wi-Fi
  'Device.WiFi.SSID.{i}.SSID': 'wifiSsid',
  'Device.WiFi.SSID.{i}.Enable': 'wifiEnabled',
  'Device.WiFi.SSID.{i}.Status': 'wifiStatus',
  'Device.WiFi.AccessPoint.{i}.Security.PreSharedKey': 'wifiPassword',
  'Device.WiFi.Radio.{i}.Channel': 'wifiChannel',
  'Device.WiFi.Radio.{i}.AutoChannelEnable': 'wifiAutoChannel',
  'Device.WiFi.Radio.{i}.OperatingFrequencyBand': 'wifiBand',
  'Device.WiFi.Radio.{i}.TransmitPower': 'wifiTransmitPower',

  // Hosts
  'Device.Hosts.Host.{i}.HostName': 'hostName',
  'Device.Hosts.Host.{i}.IPAddress': 'hostIp',
  'Device.Hosts.Host.{i}.PhysAddress': 'hostMAC',
  'Device.Hosts.Host.{i}.InterfaceType': 'hostInterfaceType',
  'Device.Hosts.Host.{i}.Active': 'hostActive',
  'Device.Hosts.HostNumberOfEntries': 'hostNumberOfEntries',

  // Ping
  'Device.IP.Diagnostics.IPPing.DiagnosticsState': 'pingState',
  'Device.IP.Diagnostics.IPPing.Host': 'pingHost',
  'Device.IP.Diagnostics.IPPing.AverageResponseTime': 'pingAvgTime',
};

// Caminhos de sinal óptico por fabricante
export const OPTICAL_SIGNAL_PATHS = [
  // Intelbras (path correto com typo do firmware)
  'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TXPower',
  // Intelbras (path alternativo)
  'InternetGatewayDevice.WANDevice.1.X_ITBS_ORG_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_ITBS_ORG_GponInterfaceConfig.TXPower',
  'InternetGatewayDevice.X_ITBS_ORG_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.X_ITBS_ORG_GponInterfaceConfig.TXPower',
  // Huawei
  'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.TXPower',
  'InternetGatewayDevice.X_HW_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.X_HW_GponInterfaceConfig.TXPower',
  // Nokia/Alcatel
  'InternetGatewayDevice.WANDevice.1.X_ALU_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_ALU_GponInterfaceConfig.TXPower',
  'InternetGatewayDevice.X_ALCL_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.X_ALCL_GponInterfaceConfig.TXPower',
  // Telefonica/MitraStar/Askey
  'InternetGatewayDevice.X_TELEFONICA_COM_GPON.ReceivedOpticalPower',
  'InternetGatewayDevice.X_TELEFONICA_COM_GPON.TransmittedOpticalPower',
  // ZTE
  'InternetGatewayDevice.WANDevice.1.X_ZTE_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_ZTE_GponInterfaceConfig.TXPower',
  'InternetGatewayDevice.X_ZTE_COM_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.X_ZTE_COM_GponInterfaceConfig.TXPower',
  // Fiberhome
  'InternetGatewayDevice.WANDevice.1.X_FH_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_FH_GponInterfaceConfig.TXPower',
  // Genérico/CT-COM
  'InternetGatewayDevice.WANDevice.1.X_CT-COM_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.X_CT-COM_GponInterfaceConfig.TXPower',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_CT-COM_WANGponLinkConfig.RXPower',
  'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.X_CT-COM_WANGponLinkConfig.TXPower',
  'Device.Optical.Interface.1.Stats.RXPower',
  'Device.Optical.Interface.1.Stats.TXPower',
];

export const TEMPERATURE_PATHS = [
  // Intelbras (typo do firmware)
  'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TransceiverTemperature',
  // Intelbras alternativo
  'InternetGatewayDevice.WANDevice.1.X_ITBS_ORG_GponInterfaceConfig.Temperature',
  // DeviceInfo TemperatureSensor (Optical Module = índice 2)
  'InternetGatewayDevice.DeviceInfo.TemperatureStatus.TemperatureSensor.2.Value',
  'InternetGatewayDevice.DeviceInfo.TemperatureStatus.TemperatureSensor.1.Value',
  'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.Temperature',
  'InternetGatewayDevice.WANDevice.1.X_ZTE_GponInterfaceConfig.Temperature',
  'InternetGatewayDevice.X_ITBS_ORG_GponInterfaceConfig.Temperature',
  'Device.Optical.Interface.1.Stats.Temperature',
];

export const VOLTAGE_PATHS = [
  // Intelbras (typo do firmware)
  'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.SupplyVoltage',
  // Intelbras alternativo
  'InternetGatewayDevice.WANDevice.1.X_ITBS_ORG_GponInterfaceConfig.Voltage',
  'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.Voltage',
  'InternetGatewayDevice.WANDevice.1.X_ZTE_GponInterfaceConfig.Voltage',
  'Device.Optical.Interface.1.Stats.Voltage',
];
