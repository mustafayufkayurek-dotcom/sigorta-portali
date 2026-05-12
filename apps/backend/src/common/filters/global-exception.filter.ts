import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { Request, Response } from 'express';
import { logger } from '../logger/winston.logger';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof PrismaClientValidationError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.message,
        error: 'Bad Request',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    if (exception instanceof PrismaClientKnownRequestError) {
      const statusCode =
        exception.code === 'P2002'
          ? HttpStatus.CONFLICT
          : HttpStatus.BAD_REQUEST;

      return response.status(statusCode).json({
        statusCode,
        message: exception.message,
        error:
          statusCode === HttpStatus.CONFLICT ? 'Conflict' : 'Bad Request',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    if (exception instanceof PrismaClientInitializationError) {
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: exception.message,
        error: 'Service Unavailable',
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    const error =
      exception instanceof Error
        ? exception
        : new Error(typeof exception === 'string' ? exception : 'Unknown error');

    logger.error('Unhandled non-HTTP exception', {
      message: error.message,
      stack: error.stack,
      path: request.url,
      method: request.method,
    });

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}