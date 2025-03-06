import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Controller for JWT authentication operations
 */
@ApiTags('JWT Authentication')
@Controller('auth/jwt')
export class JwtAuthController {
  /**
   * Verifies a JWT token and returns the operator information
   * @param req - The request object containing the authenticated user
   * @returns ApiResponse containing the operator information
   */
  // @ApiOperation({
  //   summary: 'Verify JWT token',
  //   description: 'Verifies the JWT token and returns the operator information',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'Token is valid',
  // })
  // @ApiResponse({
  //   status: 401,
  //   description: 'Unauthorized - Invalid or expired token',
  // })
  // @ApiBearerAuth()
  // @UseGuards(JwtAuthGuard)
  // @Get('verify')
  // async verifyToken(@Request() req): Promise<AppApiResponse<Operator>> {
  //   const operator = await this.operatorService.findById(req.user.userId);
  //   return new AppApiResponse<Operator>(
  //     200,
  //     'Token verified successfully',
  //     operator,
  //   );
  // }
}
