import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * WebSocket Gateway for handling real-time drilling updates.
 *
 * This gateway:
 * - Tracks online operators (players connected via WebSocket).
 * - Emits real-time updates to all connected clients when an operator connects or disconnects.
 */
@WebSocketGateway({
  cors: { origin: '*' }, // ✅ Allow WebSocket connections from any frontend
})
export class DrillingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;
  private readonly logger = new Logger(DrillingGateway.name);

  /**
   * Keeps track of online operators.
   * - Uses a `Set<string>` to store unique operator IDs.
   * - Ensures quick lookups, insertions, and deletions.
   */
  private onlineOperators = new Set<string>();

  /**
   * Handles a new WebSocket connection.
   * - Adds the operator to the online tracking list.
   * - Emits an updated online operator count.
   *
   * @param client The connected WebSocket client.
   */
  handleConnection(client: Socket) {
    const operatorId = client.handshake.query.operatorId as string;

    if (operatorId) {
      this.onlineOperators.add(operatorId);
      this.logger.log(
        `🔗 Operator Connected: ${operatorId} (Online Operators: ${this.onlineOperators.size})`,
      );
      this.broadcastOnlineOperators(); // Notify all clients
    }
  }

  /**
   * Handles a WebSocket disconnection.
   * - Removes the operator from the online tracking list.
   * - Emits an updated online operator count.
   *
   * @param client The disconnected WebSocket client.
   */
  handleDisconnect(client: Socket) {
    const operatorId = client.handshake.query.operatorId as string;

    if (operatorId) {
      this.onlineOperators.delete(operatorId);
      this.logger.log(
        `❌ Operator Disconnected: ${operatorId} (Online Operators: ${this.onlineOperators.size})`,
      );
      this.broadcastOnlineOperators(); // Notify all clients
    }
  }

  /**
   * Returns the current number of online operators.
   * - This is used for real-time monitoring of active users.
   *
   * @returns The count of online operators.
   */
  getOnlineOperatorCount(): number {
    return this.onlineOperators.size;
  }

  /**
   * Emits the updated online operator count to all connected clients.
   * - Helps frontend display real-time active user count.
   */
  private broadcastOnlineOperators() {
    this.server.emit('online-operator-update', {
      onlineOperatorCount: this.getOnlineOperatorCount(),
    });
  }
}
