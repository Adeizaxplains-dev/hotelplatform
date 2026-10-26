import { getDatabaseStatus, pingDatabase, type DatabaseStatus } from "../../database/connection.js";
import { ServiceUnavailableError } from "../../shared/errors.js";
import { APP_VERSION } from "../../shared/version.js";

export interface HealthDeps {
  getDatabaseStatus: () => DatabaseStatus;
  pingDatabase: () => Promise<boolean>;
}

export interface HealthReport {
  status: "ok";
  service: "hotel-platform-api";
  version: string;
  timestamp: string;
  database: DatabaseStatus;
}

export function createHealthService(deps: HealthDeps = { getDatabaseStatus, pingDatabase }) {
  return {
    /** Liveness: the process is up. Reports the database state but does not fail on it. */
    getHealth(): HealthReport {
      return {
        status: "ok",
        service: "hotel-platform-api",
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        database: deps.getDatabaseStatus(),
      };
    },

    /** Readiness: only succeeds if MongoDB actually answers. Use for load-balancer checks. */
    async getReadiness(): Promise<HealthReport> {
      if (!(await deps.pingDatabase())) throw new ServiceUnavailableError("The database is not reachable.");
      return this.getHealth();
    },
  };
}

export type HealthService = ReturnType<typeof createHealthService>;
