import { ApiProperty } from '@nestjs/swagger';
import { Type } from '@nestjs/common';

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

  /**
   * Creates a DTO class for Swagger documentation that extends ApiResponse with the correct data type
   * @param DataDto The class type for the data property
   * @returns A class that can be used with @ApiResponse decorator
   */
  static withType<D>(DataDto: Type<D>): Type<ApiResponse<D>> {
    class ApiResponseTyped extends ApiResponse<D> {
      @ApiProperty({
        description: 'Response data',
        type: DataDto,
        nullable: true,
      })
      data?: D | null;
    }

    Object.defineProperty(ApiResponseTyped, 'name', {
      value: `ApiResponse${DataDto.name}`,
    });

    return ApiResponseTyped;
  }
}
