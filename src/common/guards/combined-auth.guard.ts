import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

  constructor(private readonly configService: ConfigService) {
    this.jwtGuard = new JwtAuthGuard();
    this.wonderverseGuard = new WonderverseAuthGuard(1, this.configService); // Basic user level
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header provided');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Invalid token format');
    }

    // Try JWT authentication first (local system)
    try {
      const jwtResult = await this.jwtGuard.canActivate(context);
      if (jwtResult) {
        request.authType = 'jwt';
        return true;
      }
    } catch {
      // JWT failed, try Wonderverse authentication
    }

    // Try Wonderverse authentication as fallback
    try {
      const wonderverseResult =
        await this.wonderverseGuard.canActivate(context);
      if (wonderverseResult) {
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
