import type { FastifyInstance } from "fastify";
import type { AdminApi } from "../adminApi.js";
import { topReasons } from "../reasons.js";

export function reasonRoutes(app: FastifyInstance, adminApi: AdminApi) {
  // Suggestions only: if the audit cannot be read, the agent simply types the reason.
  app.get("/api/reasons/top", async (req) =>
    adminApi
      .getAudit()
      .then((audit) => topReasons(audit))
      .catch((err: { status?: number }) => {
        req.log.warn({ adminApiStatus: err?.status }, "audit unavailable for reasons");
        return [];
      }),
  );
}
