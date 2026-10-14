import { mkdtempSync, writeFileSync } from "node:fs";
import { Writable } from "node:stream";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { AdminApiError, type AdminApi } from "../src/adminApi.js";

const notFound = async (): Promise<never> => {
  throw new AdminApiError(404, "not found");
};
const fakeAdminApi = (up: boolean | Error): AdminApi => ({
  health: async () => {
    if (up instanceof Error) throw up;
    return up;
  },
  getAccount: notFound,
  getAttempts: notFound,
  startSms: notFound,
  checkSms: notFound,
  unlock: notFound,
  getAudit: notFound,
});

function staticDir() {
  const dir = mkdtempSync(join(tmpdir(), "web-"));
  writeFileSync(join(dir, "index.html"), "<html>lockout desk</html>");
  return dir;
}

describe("GET /api/health", () => {
  it("reports UP when the Identity Admin API answers", async () => {
    const app = buildApp({ adminApi: fakeAdminApi(true) });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "UP", adminApi: "UP" });
  });

  it("reports adminApi DOWN when the Identity Admin API fails", async () => {
    const app = buildApp({ adminApi: fakeAdminApi(new Error("connect ECONNREFUSED")) });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "UP", adminApi: "DOWN" });
  });
});

describe("routing", () => {
  it("serves index.html for unknown non-API paths (SPA fallback)", async () => {
    const app = buildApp({ adminApi: fakeAdminApi(true), staticDir: staticDir() });
    const res = await app.inject({ method: "GET", url: "/cases/LB-000003" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("lockout desk");
  });

  it("returns a JSON 404 for unknown API paths", async () => {
    const app = buildApp({ adminApi: fakeAdminApi(true), staticDir: staticDir() });
    const res = await app.inject({ method: "GET", url: "/api/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "not found" });
  });
});

describe("logging", () => {
  it("logs the route pattern, never the raw URL, query or client address", async () => {
    let logs = "";
    const logStream = new Writable({
      write(chunk, _enc, done) {
        logs += chunk.toString();
        done();
      },
    });
    const app = buildApp({ adminApi: fakeAdminApi(true), staticDir: staticDir(), logStream });
    await app.inject({ method: "GET", url: "/api/cases/LB-000083?email=jane.doe@example.com" });
    await app.inject({ method: "GET", url: "/api/health?phone=+421900111222" });

    expect(logs).toContain("/api/cases/:accountId");
    expect(logs).not.toContain("LB-000083");
    expect(logs).not.toContain("jane.doe");
    expect(logs).not.toContain("421900111222");
    expect(logs).not.toContain("remoteAddress");
  });
});

describe("API path matching", () => {
  it("treats /API/ like /api/ (JSON 404, not the SPA page)", async () => {
    const app = buildApp({ adminApi: fakeAdminApi(true), staticDir: staticDir() });
    const res = await app.inject({ method: "GET", url: "/API/health" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "not found" });
  });
});
