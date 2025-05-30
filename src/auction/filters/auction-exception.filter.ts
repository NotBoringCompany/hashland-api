import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MongoError } from 'mongodb';

/**
 * Custom exception filter for auction module
 * Handles MongoDB errors and provides consistent error responses
 */
@Catch()
export class AuctionExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AuctionExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | undefined;

    // Handle HTTP exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || responseObj.error || message;
        errors = Array.isArray(responseObj.message)
          ? responseObj.message
          : undefined;
      }
    }
    // Handle MongoDB errors
    else if (exception instanceof MongoError) {
      status = HttpStatus.BAD_REQUEST;

      // Handle duplicate key error
      if (exception.code === 11000) {
        message = 'Duplicate entry detected';
        const duplicateField = this.extractDuplicateField(exception.message);
        if (duplicateField) {
          message = `${duplicateField} already exists`;
        }
      }
      // Handle validation errors
      else if (exception.message.includes('validation')) {
        message = 'Database validation failed';
      }
      // Handle other MongoDB errors
      else {
        message = 'Database operation failed';
      }
    }
    // Handle validation errors from class-validator
    else if (
      exception instanceof Error &&
      exception.message.includes('validation')
    ) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Validation failed';
    }
    // Handle unknown errors
    else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    }

    // Log the error
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : exception,
    );

    // Send error response
    const errorResponse = {
      statusCode: status,
      message,
      ...(errors && { error: errors }),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }

  /**
   * Extract the duplicate field name from MongoDB duplicate key error message
   */
  private extractDuplicateField(errorMessage: string): string | null {
    const match = errorMessage.match(/index: (\w+)_/);
    return match ? match[1] : null;
  }
}
