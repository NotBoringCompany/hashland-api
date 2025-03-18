import { ApiProperty } from '@nestjs/swagger';
import { Operator } from 'src/operators/schemas/operator.schema';
import { OperatorWallet } from 'src/operators/schemas/operator-wallet.schema';
import { Drill } from 'src/drills/schemas/drill.schema';
import { Types } from 'mongoose';

export class GetOperatorResponseDto {
  @ApiProperty({
    description: 'The operator data',
    type: Operator,
  })
  operator: Partial<Operator>;

  @ApiProperty({
    description: "The operator's connected wallets",
    type: [OperatorWallet],
  })
  wallets: Partial<OperatorWallet[]>;

  @ApiProperty({
    description: "The operator's drills",
    type: [Drill],
  })
  drills: Partial<Drill[]>;

  @ApiProperty({
    description: 'The ID of the pool the operator belongs to, if any',
    type: String,
    required: false,
    example: '507f1f77bcf86cd799439012',
  })
  poolId?: Types.ObjectId;
}
