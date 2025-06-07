import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/**
 * Interface for Wonderverse credentials returned from token verification
 */
interface WonderverseCreds {
  id: string;
  username: string;
  email?: string;
  role: number;
  [key: string]: any;
}

/**
 * Interface for Wonderverse API response
 */
interface WonderverseResponse<T = any> {
  status: number;
  message: string;
  data?: T;
}

/**
 * Status codes used by the Wonderverse API
 */
enum Status {
  SUCCESS = 200,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  ERROR = 500,
}

/**
 * Guard that validates Wonderverse tokens and checks user role levels
 */
@Injectable()
export class WonderverseAuthGuard implements CanActivate {
  private readonly wonderverseApiUrl: string;

  constructor(
    private readonly requiredLevel: number = 1,
    private readonly configService?: ConfigService,
  ) {
    // Get ConfigService from DI if not provided
    if (!this.configService) {
      this.configService = new ConfigService();
    }

    this.wonderverseApiUrl = this.configService.get<string>(
      'WONDERVERSE_API_URL',
      'https://api.wonderverse.com',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    try {
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        throw new UnauthorizedException('No token provided');
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new UnauthorizedException('Invalid token format');
      }

      const token = parts[1];
      const creds = await this.verifyToken(token);

      // Check role level authorization
      if (creds.role < this.requiredLevel) {
        throw new ForbiddenException('Insufficient role level');
      }

      // Store credentials in request for use in controllers
      request.wonderverseCreds = creds;
      request.wonderverseRole = creds.role;

      return true;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Authentication error: ${error.message}`,
      );
    }
  }

  /**
   * Verifies a token with the Wonderverse backend
   * @param token Token obtained from the Wonderverse backend
   * @returns Promise<WonderverseCreds> The verified user credentials
   */
  private async verifyToken(token: string): Promise<WonderverseCreds> {
    try {
      const response = await axios.get(`${this.wonderverseApiUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000, // 10 second timeout
      });

      const result: WonderverseResponse<WonderverseCreds> = response.data;

      if (result.status !== Status.SUCCESS) {
        throw new UnauthorizedException(
          result.message || 'Token verification failed',
        );
      }

      if (!result.data) {
        throw new UnauthorizedException('Invalid token response');
      }

      return result.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.data?.status ?? Status.ERROR;
        const message = error.response?.data?.message ?? 'Authorization failed';

        if (status === Status.UNAUTHORIZED) {
          throw new UnauthorizedException(message);
        } else if (status === Status.FORBIDDEN) {
          throw new ForbiddenException(message);
        } else {
          throw new InternalServerErrorException(
            `Wonderverse API error: ${message}`,
          );
        }
      }

      throw new InternalServerErrorException(
        `Token verification failed: ${error.message}`,
      );
    }
  }
}
