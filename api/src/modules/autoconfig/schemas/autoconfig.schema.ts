import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AutoConfigDocument = AutoConfig & Document;

/**
 * Eventos TR-069 que podem disparar uma regra de AutoConfig.
 * - BOOTSTRAP : ONT ligou pela primeira vez ou após reset de fábrica (0 BOOTSTRAP)
 * - BOOT      : ONT reiniciou normalmente (1 BOOT)
 * - VALUE_CHANGE: Um parâmetro monitorado mudou de valor (4 VALUE CHANGE)
 * - PERIODIC  : Inform periódico normal (2 PERIODIC INFORM)
 * - ANY       : Qualquer evento (comportamento padrão — sem filtro de evento)
 */
export const TR069_EVENTS = ['BOOTSTRAP', 'BOOT', 'VALUE_CHANGE', 'PERIODIC', 'ANY'] as const;
export type Tr069Event = typeof TR069_EVENTS[number];

@Schema({ collection: 'auto_configs', timestamps: true, versionKey: false })
export class AutoConfig {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ default: true })
  enabled: boolean;

  @Prop({ default: 0 })
  priority: number;

  // Condições de aplicação
  @Prop({ type: Object, default: {} })
  conditions: {
    manufacturer?: string;
    model?: string;
    oui?: string;
    tags?: string[];
    serialPattern?: string;
    firmwareVersion?: string;
    /**
     * Evento TR-069 que dispara a regra.
     * 'BOOTSTRAP' = ONT ligou pela primeira vez ou após reset de fábrica
     * 'BOOT'      = ONT reiniciou sem reset de fábrica
     * 'PERIODIC'  = Inform periódico normal
     * 'VALUE_CHANGE' = Mudança de parâmetro monitorado
     * 'ANY'       = Qualquer evento (padrão)
     */
    tr069Event?: Tr069Event;
  };

  // Parâmetros a definir (suportam variáveis ${param.path} e ${ixc.campo})
  @Prop({ type: [Object], default: [] })
  parameters: {
    name: string;
    value: any;
    type: string;
  }[];

  // Presets GenieACS a aplicar
  @Prop({ type: [String], default: [] })
  presets: string[];

  // Tags a adicionar
  @Prop({ type: [String], default: [] })
  tagsToAdd: string[];

  /**
   * ID da integração IXC a usar para resolver variáveis ${ixc.*}.
   * Se não informado, usa a primeira integração IXC ativa encontrada.
   */
  @Prop()
  ixcIntegrationId?: string;

  @Prop({ type: Object, default: {} })
  stats: {
    applied: number;
    errors: number;
    lastApplied?: Date;
  };
}

export const AutoConfigSchema = SchemaFactory.createForClass(AutoConfig);
