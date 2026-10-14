import Fastify, { type FastifyRequest } from "fastify";
import fastifyHelmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import { AdminApiError, type AdminApi } from "./adminApi.js";
import { createCaseStore } from "./cases.js";
import { caseRoutes } from "./routes/cases.js";
import { unlockRoutes } from "./routes/unlock.js";
import type { Ticket } from "./tickets.js";

export interface AppDeps {
  adminApi: AdminApi;
  tickets?: Ticket[];
  staticDir?: string;
  logStream?: NodeJS.WritableStream;
}

// Log the matched route pattern (e.g. /api/cases/:accountId), never the raw URL, query, body or client address:
// URLs carry account IDs and could carry other personal data.
const logSerializers = {
  req: (req: FastifyRequest) => ({ method: req.method, route: req.routeOptions?.url ?? "unmatched" }),
};

const PASS_THROUGH = new Set([404, 409, 410, 422]);

export function buildApp({ adminApi, tickets = [], staticDir, logStream }: AppDeps) {
  const logging = logStream !== undefined || process.env.NODE_ENV === "production";
  const app = Fastify({
    logger: logging ? { serializers: logSerializers, ...(logStream ? { stream: logStream } : {}) } : false,
    bodyLimit: 16 * 1024,
    // Reject unknown fields instead of silently dropping them.
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false } },
  });

  app.register(fastifyHelmet, {
    contentSecurityPolicy: { directives: { frameAncestors: ["'none'"], upgradeInsecureRequests: null } },
  });

  // CSRF guard: browsers can only send application/json cross-site after a CORS preflight, which we never allow.
  app.addHook("onRequest", async (req, reply) => {
    if (req.method !== "GET" && req.method !== "HEAD" && !(req.headers["content-type"] ?? "").startsWith("application/json")) {
      return reply.code(415).send({ error: "Send JSON (Content-Type: application/json)" });
    }
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AdminApiError) {
      // Pass on only business answers from the Admin API; hide its auth / rate-limit / server errors.
      if (PASS_THROUGH.has(err.status)) return reply.code(err.status).send({ error: err.message });
      req.log.warn({ adminApiStatus: err.status }, "Admin API error");
      return reply.code(502).send({ error: "The Identity Admin API is not reachable. Try again in a moment." });
    }
    if ((err as { validation?: unknown }).validation) return reply.code(400).send({ error: (err as Error).message });
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: (err as Error).message });
    req.log.error({ err: { type: (err as Error).name } }, "request failed");
    return reply.code(500).send({ error: "Something went wrong on our side." });
  });

  const store = createCaseStore(adminApi, tickets);
  caseRoutes(app, store, adminApi);
  unlockRoutes(app, adminApi, store);

  app.get("/api/health", async () => {
    const up = await adminApi.health().catch(() => false);
    return { status: "UP", adminApi: up ? "UP" : "DOWN" };
  });

  if (staticDir) {
    app.register(fastifyStatic, { root: staticDir });
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.method === "GET" && staticDir && !req.url.toLowerCase().startsWith("/api/")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ error: "not found" });
  });

  return app;
}
