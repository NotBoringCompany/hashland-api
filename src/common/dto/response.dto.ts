import { ApiProperty } from '@nestjs/swagger';

export class ApiResponse<T = any> {
  /**
   * HTTP status code (200, 400, 404, etc.)
   */
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  /**
   * Message describing the result of the API call.
   */
  @ApiProperty({
    description: 'Response message',
    example: 'Success',
  })
  message: string;

  /**
   * The actual response data (generic type).
   */
  @ApiProperty({
    description: 'Response data',
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  data?: T | null;

  constructor(status: number, message: string, data?: T | null) {
    this.status = status;
    this.message = message;
    this.data = data ?? null;
  }
}
