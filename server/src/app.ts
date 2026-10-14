import Fastify, { type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import type { AdminApi } from "./adminApi.js";

export interface AppDeps {
  adminApi: AdminApi;
  staticDir?: string;
  logStream?: NodeJS.WritableStream;
}

// Log the matched route pattern (e.g. /api/cases/:accountId), never the raw URL, query, body or client address:
// URLs carry account IDs and could carry other personal data.
const logSerializers = {
  req: (req: FastifyRequest) => ({ method: req.method, route: req.routeOptions?.url ?? "unmatched" }),
};

export function buildApp({ adminApi, staticDir, logStream }: AppDeps) {
  const logging = logStream !== undefined || process.env.NODE_ENV === "production";
  const app = Fastify({
    logger: logging ? { serializers: logSerializers, ...(logStream ? { stream: logStream } : {}) } : false,
  });

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
