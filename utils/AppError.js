class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.errorCode = errorCode;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errorCode = 'BAD_REQUEST') {
    return new AppError(message, 400, errorCode);
  }

  static unauthorized(message = 'Please log in to access this resource', errorCode = 'UNAUTHORIZED') {
    return new AppError(message, 401, errorCode);
  }

  static forbidden(message = 'You do not have permission to perform this action', errorCode = 'FORBIDDEN') {
    return new AppError(message, 403, errorCode);
  }

  static notFound(message = 'Resource not found', errorCode = 'NOT_FOUND') {
    return new AppError(message, 404, errorCode);
  }

  static methodNotAllowed(message = 'Method not allowed', errorCode = 'METHOD_NOT_ALLOWED') {
    return new AppError(message, 405, errorCode);
  }

  static conflict(message = 'Resource already exists', errorCode = 'CONFLICT') {
    return new AppError(message, 409, errorCode);
  }

  static tooMany(message = 'Too many requests. Please try again later.', errorCode = 'TOO_MANY_REQUESTS') {
    return new AppError(message, 429, errorCode);
  }

  static internal(message = 'Internal server error', errorCode = 'INTERNAL_ERROR') {
    return new AppError(message, 500, errorCode);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', errorCode = 'SERVICE_UNAVAILABLE') {
    return new AppError(message, 503, errorCode);
  }

  toJSON() {
    const response = {
      status: this.status,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      message: this.message,
      timestamp: this.timestamp,
    };

    if (process.env.NODE_ENV === 'development') {
      response.stack = this.stack;
    }

    return response;
  }
}

module.exports = AppError;
