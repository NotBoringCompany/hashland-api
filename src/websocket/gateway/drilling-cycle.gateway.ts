import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/drilling-cycle', // Use namespace instead of path
})
export class DrillingCycleGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(DrillingCycleGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    // Send an initial update to the newly connected client
    this.sendCycleUpdate({
      status: 'connected',
      timestamp: new Date().toISOString(),
      message: 'Welcome to the drilling cycle WebSocket!',
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('testEvent')
  handleTestEvent(client: Socket, payload: any): void {
    this.logger.log(
      `Received test event from client ${client.id}: ${JSON.stringify(payload)}`,
    );

    // Echo back the message with additional data
    this.sendCycleUpdate({
      status: 'echo',
      receivedMessage: payload,
      timestamp: new Date().toISOString(),
    });
  }

  sendCycleUpdate(data: any) {
    this.logger.debug('Sending cycle update:', data);
    this.server.emit('cycleUpdate', data);
  }
}
