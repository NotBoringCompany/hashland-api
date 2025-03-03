import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponse } from '../dto/response.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = 500;
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message;
    } else {
      // ✅ Log the full exception details for debugging
      console.error('❌ Unhandled Exception:', exception);

      // ✅ If the exception is not an HttpException, wrap it in an InternalServerErrorException
      exception = new InternalServerErrorException(message);
    }

    // ✅ Ensure `message` is always a string
    response.status(status).json(new ApiResponse<null>(status, message));
  }
}
