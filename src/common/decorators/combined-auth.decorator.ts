import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CombinedAuthGuard } from '../guards/combined-auth.guard';

/**
 * Decorator that applies combined authentication (JWT or Wonderverse)
 * Users can authenticate with either system
 * @returns Combined decorator with guard and Swagger documentation
 */
export const CombinedAuth = () => {
  return applyDecorators(
    UseGuards(CombinedAuthGuard),
    ApiBearerAuth(),
    ApiResponse({
      description: 'Success - User authenticated with JWT or Wonderverse',
    }),
    ApiUnauthorizedResponse({
      description:
        'Unauthorized - Invalid or missing token (JWT or Wonderverse)',
    }),
  );
};
