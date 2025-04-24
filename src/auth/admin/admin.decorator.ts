import { UseGuards, applyDecorators } from '@nestjs/common';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';

/**
 * Custom decorator that combines AdminGuard protection with appropriate Swagger documentation
 * for endpoints that require admin authentication via the X-Admin-Key header
 */
export const AdminProtected = () => {
  return applyDecorators(
    UseGuards(AdminGuard),
    ApiHeader({
      name: 'X-Admin-Key',
      description: 'Admin API key for authentication',
      required: true,
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - Invalid or missing admin key',
    }),
  );
};
