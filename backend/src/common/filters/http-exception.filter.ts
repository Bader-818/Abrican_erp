import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** "Not Found", "Internal Server Error", … from the status code alone. */
function statusLabel(status: number): string {
  const key = HttpStatus[status] as string | undefined;
  if (!key) {
    return 'Error';
  }
  return key
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalizes all error responses to a consistent shape:
 * { statusCode, message, error, path, timestamp }
 *
 * `error` is derived from the status code, never from the exception class
 * (pentest P-06), and non-HTTP exceptions never echo their message — internal
 * details (DB errors etc.) are logged server-side only.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        message = ((body as Record<string, unknown>).message as string | string[]) ?? exception.message;
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    } else {
      this.logger.error(`Non-Error exception thrown: ${String(exception)}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: statusLabel(status),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
