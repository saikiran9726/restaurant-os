export const ErrorCodes = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ApiErrorBody {
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string = ErrorCodes.BAD_REQUEST,
    statusCode = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, ErrorCodes.BAD_REQUEST, 400, details);
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(message, ErrorCodes.VALIDATION_ERROR, 400, details);
  }

  static notFound(message = 'Resource not found', details?: unknown): AppError {
    return new AppError(message, ErrorCodes.NOT_FOUND, 404, details);
  }

  static unauthorized(message = 'Unauthorized', details?: unknown): AppError {
    return new AppError(message, ErrorCodes.UNAUTHORIZED, 401, details);
  }

  static forbidden(message = 'Forbidden', details?: unknown): AppError {
    return new AppError(message, ErrorCodes.FORBIDDEN, 403, details);
  }

  static internal(message = 'Internal server error', details?: unknown): AppError {
    return new AppError(message, ErrorCodes.INTERNAL_SERVER_ERROR, 500, details);
  }
}
