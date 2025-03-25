import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';

export class GetTasksQueryDto {
  @ApiProperty({
    description: 'Fields to include in the response (comma-separated)',
    example: 'name,description,rewards',
    required: false,
  })
  @IsString()
  @IsOptional()
  projection?: string;
}

export class GetCompletedTasksQueryDto {
  @ApiProperty({
    description: 'The MongoDB ObjectId of the operator',
    example: '507f1f77bcf86cd799439011',
    required: true,
  })
  @IsMongoId()
  operatorId: string;
}

export class GetCompletedTasksParamsDto {
  @ApiProperty({
    description: 'The MongoDB ObjectId of the operator',
    example: '507f1f77bcf86cd799439011',
    required: true,
  })
  @IsMongoId()
  operatorId: string;
}

export class CompleteTaskQueryDto {
  @ApiProperty({
    description: 'The MongoDB ObjectId of the task',
    example: '507f1f77bcf86cd799439011',
    required: true,
  })
  @IsMongoId()
  taskId: string;

  @ApiProperty({
    description: 'The MongoDB ObjectId of the operator',
    example: '507f1f77bcf86cd799439011',
    required: true,
  })
  @IsMongoId()
  operatorId: string;
}

export class CompleteTaskParamsDto {
  @ApiProperty({
    description: 'The MongoDB ObjectId of the task',
    example: '507f1f77bcf86cd799439011',
    required: true,
  })
  @IsMongoId()
  taskId: string;

  @ApiProperty({
    description: 'The MongoDB ObjectId of the operator',
    example: '507f1f77bcf86cd799439011',
    required: true,
  })
  @IsMongoId()
  operatorId: string;
}
