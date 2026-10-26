import { Router } from "express";
import { sendSuccess } from "../../shared/response.js";
import type { HealthService } from "./health.service.js";

export function createHealthRouter(service: HealthService): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    sendSuccess(res, service.getHealth());
  });

  router.get("/ready", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    sendSuccess(res, await service.getReadiness());
  });

  return router;
}
