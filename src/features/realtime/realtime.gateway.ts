import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/security',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private connectedClients = 0;

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.connectedClients++;
    this.logger.log(
      `Client connected: ${client.id} (total: ${this.connectedClients})`,
    );
  }

  handleDisconnect(client: Socket) {
    this.connectedClients--;
    this.logger.log(
      `Client disconnected: ${client.id} (total: ${this.connectedClients})`,
    );
  }

  /** Broadcast security event to all connected clients */
  broadcastSecurityEvent(event: {
    eventType: string;
    severity: string;
    ip?: string;
    description: string;
    timestamp: string;
  }) {
    this.server.emit('security-event', event);
  }

  /** Broadcast auto-block notification */
  broadcastAutoBlock(data: {
    ip: string;
    reason: string;
    ttl: number;
    violations: number;
    timestamp: string;
  }) {
    this.server.emit('auto-block', data);
  }

  /** Broadcast threat score update */
  broadcastThreatScore(data: {
    ip: string;
    totalScore: number;
    violations: number;
    timestamp: string;
  }) {
    this.server.emit('threat-score', data);
  }

  /** Send current stats periodically or on request */
  broadcastStats(stats: {
    connectedClients: number;
    totalBlocked: number;
    recentEvents: number;
    timestamp: string;
  }) {
    this.server.emit('stats', stats);
  }

  getConnectedClients(): number {
    return this.connectedClients;
  }
}
