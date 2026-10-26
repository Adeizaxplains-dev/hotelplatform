import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { AppError, type ErrorDetail } from "../shared/errors.js";
import { sendError } from "../shared/response.js";

interface HttpishError extends Error {
  type?: string;
  status?: number;
  statusCode?: number;
  code?: number | string;
}

const GENERIC_500 = "Something went wrong on our side. Please try again.";

/**
 * Single place where every error becomes the API error contract. Known errors keep their
 * (user-safe) message. Anything unexpected is logged in full and returned as a generic 500:
 * no stack traces, SQL/Mongo messages or internals ever reach the client.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, next) => {
    if (res.headersSent) return next(err);
    const e = err as HttpishError;

    if (err instanceof AppError) {
      return sendError(res, err.statusCode, err.code, err.message, err.details);
    }

    if (err instanceof ZodError) {
      const details: ErrorDetail[] = err.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
      return sendError(res, 400, "VALIDATION_ERROR", "The request contains invalid data.", details);
    }

    // body-parser
    if (e.type === "entity.parse.failed") return sendError(res, 400, "INVALID_JSON", "The request body is not valid JSON.");
    if (e.type === "entity.too.large") return sendError(res, 413, "PAYLOAD_TOO_LARGE", "The request body is too large.");

    // multipart upload errors
  if (e.name === "MulterError") {
    const tooBig = e.code === "LIMIT_FILE_SIZE";
    return sendError(res, 400, "VALIDATION_ERROR", tooBig ? "That image is too large." : "The upload could not be processed. Send one image in the 'file' field.");
  }

  // Mongoose / MongoDB
    if (err instanceof mongoose.Error.ValidationError) {
      const details = Object.values(err.errors).map((x) => ({ path: x.path, message: "Invalid value." }));
      return sendError(res, 400, "VALIDATION_ERROR", "The request contains invalid data.", details);
    }
    if (err instanceof mongoose.Error.CastError) return sendError(res, 400, "VALIDATION_ERROR", "One of the supplied identifiers is not valid.");
    if (e.code === 11000) return sendError(res, 409, "CONFLICT", "This conflicts with existing data.");

    // Unexpected
    logger.error({ err, requestId: res.getHeader("X-Request-Id"), method: req.method, path: req.path }, "Unhandled error");
    return sendError(res, 500, "INTERNAL_ERROR", GENERIC_500);
  };
}
