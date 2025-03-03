import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ApiResponse } from '../dto/response.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>(); // Correctly using Fastify's response object

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
      console.error('❌ Unhandled Exception:', exception);
      exception = new InternalServerErrorException(message);
    }

    // Fastify uses `response.code(status).send()`
    response.code(status).send(new ApiResponse<null>(status, message));
  }
}
