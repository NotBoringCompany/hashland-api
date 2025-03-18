import { ApiProperty } from '@nestjs/swagger';
import { Operator } from 'src/operators/schemas/operator.schema';

export class GetOperatorResponseDto {
  @ApiProperty({
    description: 'The operator data',
    type: Operator,
  })
  operator: Partial<Operator>;
}
