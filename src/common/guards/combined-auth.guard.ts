import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt/jwt-auth.guard';
import { WonderverseAuthGuard } from './wonderverse-auth.guard';

/**
 * Combined authentication guard that accepts both JWT and Wonderverse authentication
 * Users can authenticate with either system
 */
@Injectable()
export class CombinedAuthGuard implements CanActivate {
  private jwtGuard: JwtAuthGuard;
  private wonderverseGuard: WonderverseAuthGuard;

  constructor() {
    this.jwtGuard = new JwtAuthGuard();
    this.wonderverseGuard = new WonderverseAuthGuard(1); // Basic user level
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try JWT authentication first
    try {
      const jwtResult = await this.jwtGuard.canActivate(context);
      if (jwtResult) {
        // Mark the authentication type for controllers to know which system was used
        request.authType = 'jwt';
        return true;
      }
    } catch {
      // JWT failed, try Wonderverse authentication
    }

    // Try Wonderverse authentication
    try {
      const wonderverseResult =
        await this.wonderverseGuard.canActivate(context);
      if (wonderverseResult) {
        // Mark the authentication type for controllers to know which system was used
        request.authType = 'wonderverse';
        return true;
      }
    } catch {
      // Both failed
    }

    // Both authentication methods failed
    throw new UnauthorizedException(
      'Authentication required - provide either JWT or Wonderverse token',
    );
  }
}
