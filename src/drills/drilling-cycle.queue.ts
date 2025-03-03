// import { Processor, Process } from '@nestjs/bull';
// import { Job } from 'bull';
// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { InjectModel } from '@nestjs/mongoose';
// import { Model } from 'mongoose';
// import { DrillingCycle } from './schemas/drilling-cycle.schema';
// import { GAME_CONSTANTS } from 'src/common/constants/game.constants';

// @Injectable()
// @Processor('drilling-cycles') // Registers this class as a Bull queue processor
// export class DrillingCycleQueue implements OnModuleInit {
//   private readonly logger = new Logger(DrillingCycleQueue.name);
//   private readonly cycleDuration = GAME_CONSTANTS.CYCLES.CYCLE_DURATION * 1000; // Convert to ms

//   constructor(
//     @InjectModel(DrillingCycle.name)
//     private drillingCycleModel: Model<DrillingCycle>,
//   ) {}

//   /**
//    * Starts the job scheduling when the module initializes.
//    */
//   async onModuleInit() {
//     this.logger.log('⏳ Drilling Cycle Queue Initialized...');
//   }

//   /**
//    * Handles each drilling cycle generation.
//    */
//   @Process('new-drilling-cycle') // Tells Bull to process 'new-drilling-cycle' jobs
//   async handleNewDrillingCycle() {
//     this.logger.log(`⛏️ Processing drilling cycle job...`);
//     await this.createNewDrillingCycle();
//   }

//   /**
//    * Creates a new drilling cycle and stores it in MongoDB.
//    */
//   private async createNewDrillingCycle() {
//     // ✅ 1. Get the latest cycle number
//     const latestCycle = await this.drillingCycleModel
//       .findOne()
//       .sort({ cycleNumber: -1 })
//       .exec();
//     const newCycleNumber = latestCycle ? latestCycle.cycleNumber + 1 : 1;

//     // ✅ 2. Create a new cycle
//     const now = new Date();
//     await this.drillingCycleModel.create({
//       cycleNumber: newCycleNumber,
//       startTimestamp: now,
//       endTimestamp: new Date(now.getTime() + this.cycleDuration),
//     });

//     this.logger.log(`✅ New Drilling Cycle Started: #${newCycleNumber}`);
//   }
// }
