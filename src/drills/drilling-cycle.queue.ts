// import { Processor, Process } from '@nestjs/bull';
// import { Job } from 'bull';
// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { DrillingCycle } from './schemas/drilling-cycle.schema';
// import { GAME_CONSTANTS } from '../config/game.constants';
// import { RedisService } from '../common/redis.service'; // ✅ Import Redis Service

// @Injectable()
// @Processor('drilling-cycles') // ✅ Registers this class as a Bull queue processor
// export class DrillingCycleQueue implements OnModuleInit {
//   private readonly logger = new Logger(DrillingCycleQueue.name);
//   private readonly cycleDuration = GAME_CONSTANTS.CYCLES.CYCLE_DURATION * 1000; // Convert to ms
//   private readonly redisCycleKey = 'drilling-cycle:current';

//   constructor(
//     @InjectModel(DrillingCycle.name)
//     private drillingCycleModel: Model<DrillingCycle>,
//     private readonly redisService: RedisService, // ✅ Inject Redis service
//   ) {}

//   /**
//    * Called on startup to ensure Redis cycle number is initialized.
//    */
//   async onModuleInit() {
//     const cycleNumber = await this.redisService.get(this.redisCycleKey);

//     if (!cycleNumber) {
//       const latestCycle = await this.drillingCycleModel
//         .findOne()
//         .sort({ cycleNumber: -1 })
//         .exec();
//       const newCycleNumber = latestCycle ? latestCycle.cycleNumber : 1;

//       await this.redisService.set(
//         this.redisCycleKey,
//         newCycleNumber.toString(),
//       );
//       this.logger.log(`🔄 Redis Cycle Number Initialized: ${newCycleNumber}`);
//     }
//   }

//   /**
//    * Handles each drilling cycle generation.
//    */
//   @Process('new-drilling-cycle') // ✅ Tells Bull to process 'new-drilling-cycle' jobs
//   async handleNewDrillingCycle(job: Job) {
//     this.logger.log(`⛏️ Processing drilling cycle job...`);
//     await this.createNewDrillingCycle();
//   }

//   /**
//    * Creates a new drilling cycle and stores it in MongoDB.
//    */
//   private async createNewDrillingCycle() {
//     // ✅ Fetch and increment cycle number in Redis
//     const newCycleNumber = await this.redisService.increment(
//       this.redisCycleKey,
//       1,
//     );

//     // ✅ Create new cycle in MongoDB
//     const now = new Date();
//     await this.drillingCycleModel.create({
//       cycleNumber: newCycleNumber,
//       startTimestamp: now,
//       endTimestamp: new Date(now.getTime() + this.cycleDuration),
//     });

//     this.logger.log(`✅ New Drilling Cycle Started: #${newCycleNumber}`);
//   }
// }
