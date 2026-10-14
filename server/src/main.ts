import { resolve } from "node:path";
import { createAdminApi } from "./adminApi.js";
import { buildApp } from "./app.js";
import { loadAgents } from "./auth.js";
import { loadTickets } from "./tickets.js";

const apiKey = process.env.ADMIN_API_KEY;
if (!apiKey) {
  console.error("ADMIN_API_KEY is not set");
  process.exit(1);
}

// An empty secret means "random per start"; a short one could be guessed and used to forge sessions.
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters (or empty for a random one)");
  process.exit(1);
}

const app = buildApp({
  adminApi: createAdminApi(process.env.ADMIN_API_URL ?? "http://identity-admin-api:9100", apiKey),
  agents: loadAgents(process.env.AGENTS_FILE ?? "/config/agents.json"),
  jwtSecret: process.env.JWT_SECRET,
  tickets: loadTickets(process.env.TICKETS_FILE ?? "/data/support_tickets.csv"),
  staticDir: process.env.STATIC_DIR ? resolve(process.env.STATIC_DIR) : undefined,
});

// Warm the queue cache so the first agent does not wait for ~100 rate-limited Admin API calls.
Promise.resolve(app.ready())
  .then(() => app.inject({ method: "GET", url: "/api/cases", cookies: { session: app.jwt.sign({ agentId: "system", name: "cache warm-up" }) } }))
  .catch(() => {});

app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 8080) }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
