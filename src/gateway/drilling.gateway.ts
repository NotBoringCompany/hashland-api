import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // ✅ Allow WebSocket access from any frontend
  },
})
export class DrillingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DrillingGateway.name);

  /**
   * Called when the WebSocket gateway is initialized.
   */
  afterInit() {
    this.logger.log('✅ WebSocket Gateway Initialized');
  }

  /**
   * Called when a client connects.
   */
  handleConnection(client: Socket) {
    this.logger.log(`🔗 Client Connected: ${client.id}`);
  }

  /**
   * Called when a client disconnects.
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`❌ Client Disconnected: ${client.id}`);
  }
}
