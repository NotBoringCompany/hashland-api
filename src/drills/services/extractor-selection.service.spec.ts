// // Unit Tests for ExtractorSelectionService

// import { Test, TestingModule } from '@nestjs/testing';
// import { getModelToken } from '@nestjs/mongoose';
// // import { Model } from 'mongoose';
// import { ExtractorSelectionService } from './extractor-selection.service';
// import { DrillingCycle } from '../schemas/drilling-cycle.schema';
// import { DrillConfig } from '../../common/enums/drill.enum';

// describe('ExtractorSelectionService', () => {
//   let service: ExtractorSelectionService;
//   // let model: Model<DrillingCycle>;

//   const mockDrillingCycleModel = {
//     findById: jest.fn(),
//     findByIdAndUpdate: jest.fn(),
//   };

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         ExtractorSelectionService,
//         {
//           provide: getModelToken(DrillingCycle.name),
//           useValue: mockDrillingCycleModel,
//         },
//       ],
//     }).compile();

//     service = module.get<ExtractorSelectionService>(ExtractorSelectionService);
//     // model = module.get<Model<DrillingCycle>>(getModelToken(DrillingCycle.name));
//   });

//   describe('selectExtractorForCycle', () => {
//     it('should select an extractor based on EFF weights', async () => {
//       const mockCycle = {
//         _id: 'cycle123',
//         activeDrills: [
//           { _id: 'drill1', config: DrillConfig.IRONBORE, actualEff: 100 },
//           { _id: 'drill2', config: DrillConfig.BULWARK, actualEff: 200 },
//         ],
//       };

//       mockDrillingCycleModel.findById.mockImplementation(() => ({
//         populate: () => ({
//           lean: () => mockCycle,
//         }),
//       }));

//       const result = await service.selectExtractorForCycle('cycle123');
//       expect(result.status).toBe(200);
//       expect(result.data.extractorId).toBeDefined();
//     });

//     it('should throw error when no eligible drills found', async () => {
//       const mockCycle = {
//         _id: 'cycle123',
//         activeDrills: [
//           { _id: 'drill1', config: DrillConfig.BASIC, actualEff: 50 },
//         ],
//       };

//       mockDrillingCycleModel.findById.mockImplementation(() => ({
//         populate: () => ({
//           lean: () => mockCycle,
//         }),
//       }));

//       await expect(
//         service.selectExtractorForCycle('cycle123'),
//       ).rejects.toThrow();
//     });
//   });
// });
