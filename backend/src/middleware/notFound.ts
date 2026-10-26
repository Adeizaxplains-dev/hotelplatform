import type { RequestHandler } from "express";
import { NotFoundError } from "../shared/errors.js";

export const notFound: RequestHandler = (_req, _res, next) => next(new NotFoundError("This endpoint does not exist."));
