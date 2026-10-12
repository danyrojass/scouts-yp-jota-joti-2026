import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/utils/errors";

/**
 * Wraps an async route handler so rejections reach the error middleware.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // eslint-disable-next-line no-console
  if (process.env.NODE_ENV !== "test") console.error(err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Datos de entrada invalidos",
        details: err.flatten(),
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        error: { code: "CONFLICT", message: "Ya existe un registro duplicado" },
      });
    }
    if (err.code === "P2003") {
      return res.status(400).json({
        error: { code: "FK_ERROR", message: "Referencia invalida" },
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Recurso no encontrado" },
      });
    }
  }

  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Error interno del servidor" },
  });
}

export function parseSession(req: Request) {
  const session = req.session as Request["session"] & {
    csrfToken?: string;
    principal?: { type: "admin" | "team"; id: string };
  };
  return session;
}