import { ApiResponse } from 'src/common/dto/response.dto';
import { Operator } from 'src/operators/schemas/operator.schema';
import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatedResponseData {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Operator information',
    type: () => Operator,
  })
  operator: Operator;
}

export class AuthenticatedResponse extends ApiResponse<AuthenticatedResponseData> {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Response message',
    example: 'Authenticated',
  })
  message: string;

  @ApiProperty({
    description: 'Authentication data',
    type: () => AuthenticatedResponseData,
  })
  data: AuthenticatedResponseData;

  constructor(data: AuthenticatedResponseData) {
    super(200, 'Authenticated', data);
  }
}
