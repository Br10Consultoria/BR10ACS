import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/ws',
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);
  private connectedClients = new Map<string, { userId: string; rooms: Set<string> }>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) { client.disconnect(); return; }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      this.connectedClients.set(client.id, { userId: payload.sub, rooms: new Set() });
      client.join(`user:${payload.sub}`);
      this.logger.log(`Cliente conectado: ${client.id} (user: ${payload.sub})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('subscribe:device')
  handleSubscribeDevice(@MessageBody() deviceId: string, @ConnectedSocket() client: Socket) {
    client.join(`device:${deviceId}`);
    const info = this.connectedClients.get(client.id);
    if (info) info.rooms.add(`device:${deviceId}`);
    return { event: 'subscribed', deviceId };
  }

  @SubscribeMessage('unsubscribe:device')
  handleUnsubscribeDevice(@MessageBody() deviceId: string, @ConnectedSocket() client: Socket) {
    client.leave(`device:${deviceId}`);
    return { event: 'unsubscribed', deviceId };
  }

  // Emitir evento para todos os clientes
  emitToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  // Emitir evento para assinantes de um dispositivo
  emitToDevice(deviceId: string, event: string, data: any) {
    this.server.to(`device:${deviceId}`).emit(event, data);
  }

  // Emitir evento para um usuário específico
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  getConnectedCount(): number {
    return this.connectedClients.size;
  }
}
