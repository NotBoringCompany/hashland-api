// import {
//   WebSocketGateway,
//   WebSocketServer,
//   OnGatewayInit,
//   OnGatewayConnection,
//   OnGatewayDisconnect,
// } from '@nestjs/websockets';
// import { Server, Socket } from 'socket.io';
// import { Logger } from '@nestjs/common';
// import { OperatorService } from 'src/operators/operator.service';
// import { DrillingCycleService } from 'src/drills/drilling-cycle.service';
// import { DrillingSessionService } from 'src/drills/drilling-session.service';
// import { RedisService } from 'src/common/redis.service';

// @WebSocketGateway({
//   cors: {
//     origin: '*', // ✅ Allow WebSocket access from any frontend
//   },
// })
// export class DrillingGateway
//   implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
// {
//   @WebSocketServer()
//   server: Server;

//   private readonly logger = new Logger(DrillingGateway.name);

//   constructor(
//     private readonly drillingCycleService: DrillingCycleService,
//     private readonly drillingSessionService: DrillingSessionService,
//     private readonly operatorService: OperatorService,
//     private readonly redisService: RedisService,
//   ) {}

//   /**
//    * Called when the WebSocket gateway is initialized.
//    */
//   afterInit() {
//     this.logger.log('✅ WebSocket Gateway Initialized');
//   }

//   /**
//    * Called when a client connects.
//    */
//   handleConnection(client: Socket) {
//     this.logger.log(`🔗 Client Connected: ${client.id}`);
//   }

//   /**
//    * Called when a client disconnects.
//    */
//   handleDisconnect(client: Socket) {
//     this.logger.log(`❌ Client Disconnected: ${client.id}`);
//   }

//   /**
//    * Sends real-time updates to all connected clients.
//    */
//   async sendRealTimeUpdates() {
//     // get the current cycle number
//     const currentCycleNumber =
//       await this.drillingCycleService.getCurrentCycleNumber();

//     // get the total active operators from Redis
//     const activeOperators =
//       await this.drillingSessionService.fetchActiveDrillingSessionsRedis();

//     const issuedHASHStr = await this.redisService.get(
//       `drilling-cycle:${currentCycleNumber}:issuedHASH`,
//     );
//     const issuedHASH = issuedHASHStr ? parseInt(issuedHASHStr, 10) : 0;

//     const drillingDifficulty =
//       await this.drillingCycleService.getDrillingDifficulty();
//     const totalEffRating = await this.operatorService.getTotalEffRating();

//     this.server.emit('drilling-update', {
//       currentCycleNumber,
//       activeOperatorCount: activeOperators,
//       issuedHASH,
//       drillingDifficulty: drillingDifficulty,
//       currentCycleNumber: currentCycleNumber,
//       totalEffRating: totalEffRating,
//     });

//     this.logger.log('📡 Sent real-time drilling update to all clients');
//   }
// }
