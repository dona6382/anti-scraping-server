import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';

@WebSocketGateway({
  cors: { origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'] },
  namespace: '/security',
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private connectedClients = 0;
  private authenticatedClients = new Set<string>();

  constructor(private readonly authService: AuthService) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake?.auth?.token || client.handshake?.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }
      const user = await this.authService.validateToken(token);
      if (user.role !== 'admin') {
        client.emit('error', { message: 'Admin access required' });
        client.disconnect();
        return;
      }
      this.authenticatedClients.add(client.id);
      this.connectedClients++;
      this.logger.log(`Admin connected: ${client.id}`);
    } catch {
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (this.authenticatedClients.has(client.id)) {
      this.authenticatedClients.delete(client.id);
      this.connectedClients--;
    }
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
}
