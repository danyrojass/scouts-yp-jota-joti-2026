export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = "API_ERROR",
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, "BAD_REQUEST", details);
  }

  static unauthorized(message = "No autenticado") {
    return new ApiError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message = "Acceso restringido") {
    return new ApiError(403, message, "FORBIDDEN");
  }

  static notFound(message = "Recurso no encontrado") {
    return new ApiError(404, message, "NOT_FOUND");
  }

  static conflict(message: string, details?: unknown) {
    return new ApiError(409, message, "CONFLICT", details);
  }

  static tooMany(message = "Demasiadas solicitudes") {
    return new ApiError(429, message, "TOO_MANY_REQUESTS");
  }
}