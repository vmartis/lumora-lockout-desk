import { resolve } from "node:path";
import { createAdminApi } from "./adminApi.js";
import { buildApp } from "./app.js";
import { loadTickets } from "./tickets.js";

const apiKey = process.env.ADMIN_API_KEY;
if (!apiKey) {
  console.error("ADMIN_API_KEY is not set");
  process.exit(1);
}

const app = buildApp({
  adminApi: createAdminApi(process.env.ADMIN_API_URL ?? "http://identity-admin-api:9100", apiKey),
  tickets: loadTickets(process.env.TICKETS_FILE ?? "/data/support_tickets.csv"),
  staticDir: process.env.STATIC_DIR ? resolve(process.env.STATIC_DIR) : undefined,
});

// Warm the queue cache so the first agent does not wait for ~100 rate-limited Admin API calls.
Promise.resolve(app.ready()).then(() => app.inject({ method: "GET", url: "/api/cases" })).catch(() => {});

app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 8080) }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
