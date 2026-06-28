import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WhatsAppSessionDocument = WhatsAppSession & Document;

/**
 * Estados possíveis da conversa com o cliente via WhatsApp.
 */
export type WaState =
  | 'idle'
  | 'waiting_login'           // aguardando login PPPoE / CPF
  | 'waiting_new_wifi_pass'   // aguardando nova senha WiFi
  | 'waiting_ssid_choice'     // aguardando escolha de rede (2.4 / 5 GHz)
  | 'waiting_new_pppoe_pass'  // aguardando nova senha PPPoE
  | 'waiting_reboot_confirm'  // aguardando confirmação de reboot
  | 'waiting_menu_choice';    // aguardando seleção do menu principal

@Schema({ timestamps: true, collection: 'whatsapp_sessions' })
export class WhatsAppSession {
  /** Número de telefone do cliente no formato E.164 (ex: 5511999990000) */
  @Prop({ required: true, index: true })
  phone: string;

  /** Nome de exibição do WhatsApp do cliente */
  @Prop({ default: '' })
  displayName: string;

  /** Estado atual da conversa */
  @Prop({ default: 'idle' })
  state: WaState;

  /** Login PPPoE identificado */
  @Prop({ default: null })
  login: string | null;

  /** ID do dispositivo no GenieACS */
  @Prop({ default: null })
  deviceId: string | null;

  /** Serial number da ONT */
  @Prop({ default: null })
  deviceSerial: string | null;

  /** ID do cliente no IXC */
  @Prop({ default: null })
  ixcClientId: string | null;

  /** Redes WiFi disponíveis (JSON serializado) */
  @Prop({ default: null })
  wifiNetworksJson: string | null;

  /** Índice da rede WiFi selecionada */
  @Prop({ default: null })
  selectedNetworkIndex: number | null;

  /** Timestamp da última interação (para TTL) */
  @Prop({ default: () => new Date() })
  lastActivity: Date;

  /** Contagem de tentativas de login inválido */
  @Prop({ default: 0 })
  loginAttempts: number;

  /** Histórico resumido das últimas 20 mensagens (para auditoria) */
  @Prop({ type: [{ role: String, text: String, ts: Date }], default: [] })
  history: Array<{ role: 'user' | 'bot'; text: string; ts: Date }>;
}

export const WhatsAppSessionSchema = SchemaFactory.createForClass(WhatsAppSession);

// TTL index: sessões expiram após 30 minutos de inatividade
WhatsAppSessionSchema.index({ lastActivity: 1 }, { expireAfterSeconds: 1800 });
