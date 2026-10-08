import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AppError, ErrorCodes } from '@restaurant-os/shared';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (
      error: FastifyError | AppError | ZodError | Error,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      const requestId = request.id;

      // 1. Zod Validation Errors -> 400
      if (error instanceof ZodError) {
        request.log.warn({ err: error, requestId }, 'Zod validation error');
        return reply.status(400).send({
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: 'Validation failed',
            requestId,
            details: error.flatten(),
          },
        });
      }

      // 2. Custom Domain AppError
      if (error instanceof AppError) {
        request.log.warn({ err: error, requestId }, `AppError: ${error.message}`);
        return reply.status(error.statusCode).send({
          error: {
            code: error.code,
            message: error.message,
            requestId,
            ...(error.details ? { details: error.details } : {}),
          },
        });
      }

      // 3. Fastify Validation Errors
      const fastifyErr = error as FastifyError;
      if (fastifyErr.validation) {
        request.log.warn({ err: fastifyErr, requestId }, 'Fastify schema validation error');
        return reply.status(400).send({
          error: {
            code: ErrorCodes.VALIDATION_ERROR,
            message: fastifyErr.message || 'Validation error',
            requestId,
            details: fastifyErr.validation,
          },
        });
      }

      // 4. Rate Limit Errors (429)
      if (fastifyErr.statusCode === 429) {
        return reply.status(429).send({
          error: {
            code: ErrorCodes.RATE_LIMIT_EXCEEDED,
            message: fastifyErr.message || 'Rate limit exceeded',
            requestId,
          },
        });
      }

      // 5. Unhandled / Internal Server Error (500)
      const statusCode =
        fastifyErr.statusCode && fastifyErr.statusCode >= 400 ? fastifyErr.statusCode : 500;
      request.log.error({ err: error, requestId }, 'Unhandled exception');

      const message =
        statusCode === 500 && process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : error.message || 'Internal server error';

      return reply.status(statusCode).send({
        error: {
          code: ErrorCodes.INTERNAL_SERVER_ERROR,
          message,
          requestId,
        },
      });
    },
  );

  // Uniform 404 Not Found response structure
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: `Route ${request.method} ${request.url} not found`,
        requestId: request.id,
      },
    });
  });
}
