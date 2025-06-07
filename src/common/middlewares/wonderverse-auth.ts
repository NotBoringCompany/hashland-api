import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
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
 * Middleware to verify Wonderverse tokens and check user role levels
 * Follows NestJS middleware pattern and integrates with existing auth system
 */
@Injectable()
export class WonderverseAuthMiddleware implements NestMiddleware {
  private readonly wonderverseApiUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.wonderverseApiUrl = this.configService.get<string>(
      'WONDERVERSE_API_URL',
      'https://api.wonderverse.com',
    );
  }

  /**
   * Creates a middleware function that requires a specific role level
   * @param level Required role level (minimum role required to access the route)
   * @returns Express middleware function
   */
  forRole(level: number) {
    return this.validateWithRole(level);
  }

  /**
   * Default middleware implementation (requires role level 1)
   */
  use(req: Request, res: Response, next: NextFunction) {
    this.validateWithRole(1)(req, res, next);
  }

  /**
   * Creates a validation function for a specific role level
   * @param level Required role level
   * @returns Middleware function
   */
  private validateWithRole(level: number) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization;

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
        if (creds.role < level) {
          throw new ForbiddenException('Insufficient role level');
        }

        // Store credentials in request for use in controllers
        (req as any).wonderverseCreds = creds;
        (req as any).wonderverseRole = creds.role;

        next();
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
    };
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
