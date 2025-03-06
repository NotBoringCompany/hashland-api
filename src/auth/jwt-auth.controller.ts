import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt/jwt-auth.guard';
import { ApiResponse as AppApiResponse } from 'src/common/dto/response.dto';
import { Operator } from 'src/operators/schemas/operator.schema';
import { OperatorService } from 'src/operators/operator.service';

/**
 * Controller for JWT authentication operations
 */
@ApiTags('JWT Authentication')
@Controller('auth/jwt')
export class JwtAuthController {
  constructor(private readonly operatorService: OperatorService) {}

  /**
   * Verifies a JWT token and returns the operator information
   * @param req - The request object containing the authenticated user
   * @returns ApiResponse containing the operator information
   */
  @ApiOperation({
    summary: 'Verify JWT token',
    description: 'Verifies the JWT token and returns the operator information',
  })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or expired token',
  })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('verify')
  async verifyToken(@Request() req): Promise<AppApiResponse<Operator>> {
    const operator = await this.operatorService.findById(req.user.operatorId);

    return new AppApiResponse<Operator>(
      200,
      'Token verified successfully',
      operator,
    );
  }
}
