import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let error = 'InternalServerError';

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object') {
                const res = exceptionResponse as Record<string, unknown>;
                message = (res.message as string | string[]) || exception.message;
                error = (res.error as string) || exception.name;
            }
        } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            status = HttpStatus.BAD_REQUEST;
            error = 'DatabaseError';
            switch (exception.code) {
                case 'P2002':
                    message = 'A record with this data already exists (unique constraint violation).';
                    status = HttpStatus.CONFLICT;
                    break;
                case 'P2025':
                    message = 'Record not found.';
                    status = HttpStatus.NOT_FOUND;
                    break;
                case 'P2003':
                    message = 'Foreign key constraint failed.';
                    break;
                default:
                    message = `Database error: ${exception.code}`;
            }
        } else if (exception instanceof Error) {
            message = exception.message;
            error = exception.name;
        }

        const tenantId = request.headers['x-tenant-id'] as string | undefined;

        this.logger.error(
            `[${request.method}] ${request.url} → ${status}: ${JSON.stringify(message)}`,
            exception instanceof Error ? exception.stack : undefined,
        );

        response.status(status).json({
            success: false,
            statusCode: status,
            error,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
            tenantId: tenantId || undefined,
        });
    }
}
