import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { WonderverseAuthGuard } from '../guards/wonderverse-auth.guard';

/**
 * Decorator that applies Wonderverse authentication with role-based access control
 * @param level Minimum role level required (default: 1)
 * @returns Combined decorator with guard and Swagger documentation
 */
export const WonderverseProtected = (level: number = 1) => {
  return applyDecorators(
    UseGuards(new WonderverseAuthGuard(level)),
    ApiBearerAuth(),
    ApiResponse({
      description: 'Success - User authenticated and authorized',
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Invalid or missing token',
    }),
    ApiForbiddenResponse({
      description: 'Forbidden - Insufficient role level',
    }),
  );
};
