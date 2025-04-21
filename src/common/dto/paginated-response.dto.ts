import { ApiProperty } from '@nestjs/swagger';
import { Type } from '@nestjs/common';

/**
 * Metadata for pagination
 */
export class PaginationMetadata {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Maximum items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items across all pages',
    example: 50,
  })
  total: number;

  @ApiProperty({
    description: 'Number of items on the current page',
    example: 20,
  })
  count: number;

  @ApiProperty({
    description: 'Whether there is a next page available',
    example: true,
  })
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page available',
    example: false,
  })
  hasPrev: boolean;

  constructor(data: {
    page: number;
    limit: number;
    total: number;
    count: number;
  }) {
    this.page = data.page;
    this.limit = data.limit;
    this.total = data.total;
    this.count = data.count;
    this.hasNext = this.page * this.limit < this.total;
    this.hasPrev = this.page > 1;
  }
}

/**
 * Paginated result with data and metadata
 */
export class PaginatedResult<T> {
  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationMetadata,
  })
  metadata: PaginationMetadata;

  @ApiProperty({
    description: 'Array of result items',
    isArray: true,
  })
  result: T[];

  constructor(data: {
    items: T[];
    page: number;
    limit: number;
    total: number;
  }) {
    this.result = data.items;
    this.metadata = new PaginationMetadata({
      page: data.page,
      limit: data.limit,
      total: data.total,
      count: data.items.length,
    });
  }
}

/**
 * Generic class for paginated responses with status, message, and data
 */
export class PaginatedResponse<T> {
  @ApiProperty({
    description: 'HTTP status code',
    example: 200,
  })
  status: number;

  @ApiProperty({
    description: 'Response message',
    example: 'Success',
  })
  message: string;

  @ApiProperty({
    description: 'Paginated data with metadata',
    type: PaginatedResult,
  })
  data: PaginatedResult<T> | null;

  constructor(
    status: number,
    message: string,
    data?: {
      items: T[];
      page: number;
      limit: number;
      total: number;
    } | null,
  ) {
    this.status = status;
    this.message = message;
    this.data = data ? new PaginatedResult(data) : null;
  }

  /**
   * Creates a typed version of PaginatedResponse for Swagger documentation
   * @param ItemType The class type for the items in the result array
   * @returns A typed PaginatedResponse class
   */
  static withType<D>(ItemType: Type<D>): Type<PaginatedResponse<D>> {
    class PaginatedResponseTyped extends PaginatedResponse<D> {
      @ApiProperty({
        description: 'Paginated data with metadata',
        type: () => {
          class TypedPaginatedResult extends PaginatedResult<D> {
            @ApiProperty({
              description: 'Array of result items',
              type: ItemType,
              isArray: true,
            })
            result: D[];
          }

          Object.defineProperty(TypedPaginatedResult, 'name', {
            value: `PaginatedResult${ItemType.name}`,
          });

          return TypedPaginatedResult;
        },
        nullable: true,
      })
      data: PaginatedResult<D> | null;
    }

    Object.defineProperty(PaginatedResponseTyped, 'name', {
      value: `PaginatedResponse${ItemType.name}`,
    });

    return PaginatedResponseTyped;
  }
}
