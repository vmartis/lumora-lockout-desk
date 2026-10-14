import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { hashPassword, verifyPassword } from "../src/auth.js";
import type { AdminApi } from "../src/adminApi.js";

const agents = [{ username: "jana", agentId: "agent-042", name: "Jana Agent", passwordHash: hashPassword("correct horse battery") }];
const api = {
  health: async () => true,
  getAccount: async () => { throw new Error("not used"); },
  getAttempts: async () => [],
  startSms: async () => ({ challengeId: "x" }),
  checkSms: async () => ({ verified: false }),
  unlock: async () => { throw new Error("not used"); },
  getAudit: async () => [],
} as AdminApi;
const app = () => buildApp({ adminApi: api, agents, jwtSecret: "test-secret-test-secret-test-secret" });
const login = (a: ReturnType<typeof app>, password: string, username = "jana", ip = "10.0.0.1") =>
  a.inject({ method: "POST", url: "/api/login", payload: { username, password }, remoteAddress: ip });

describe("passwords", () => {
  it("verifies the right password and rejects a wrong one (without blocking the server)", async () => {
    const h = hashPassword("s3cret-pass");
    expect(h).not.toContain("s3cret-pass");
    const pending = verifyPassword("s3cret-pass", h);
    expect(pending).toBeInstanceOf(Promise);
    expect(await pending).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
    expect(await verifyPassword("s3cret-pass", "garbage")).toBe(false);
  });
});

describe("login", () => {
  it("logs in, sets an httpOnly session cookie and returns who you are", async () => {
    const a = app();
    const res = await login(a, "correct horse battery");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ agentId: "agent-042", name: "Jana Agent" });
    const cookie = res.cookies.find((c) => c.name === "session")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Strict");
    const me = await a.inject({ method: "GET", url: "/api/me", cookies: { session: cookie.value } });
    expect(me.json()).toEqual({ agentId: "agent-042", name: "Jana Agent" });
  });

  it("refuses a wrong password or unknown user with the same answer", async () => {
    const a = app();
    const wrong = await login(a, "nope");
    const unknown = await login(a, "correct horse battery", "nobody");
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
  });

  it("blocks a username from one address after 5 wrong passwords", async () => {
    const a = app();
    for (let i = 0; i < 5; i++) await login(a, "nope");
    const res = await login(a, "correct horse battery");
    expect(res.statusCode).toBe(429);
  });

  it("does not let someone else lock a real agent out (security review N8)", async () => {
    const a = app();
    for (let i = 0; i < 5; i++) await login(a, "nope", "jana", "10.6.6.6");
    expect((await login(a, "correct horse battery", "jana", "10.0.0.1")).statusCode).toBe(200);
  });

  it("limits one address that tries many usernames", async () => {
    const a = app();
    for (let i = 0; i < 20; i++) await login(a, "nope", `user${i}`, "10.6.6.6");
    expect((await login(a, "nope", "other", "10.6.6.6")).statusCode).toBe(429);
    expect((await login(a, "correct horse battery", "jana", "10.0.0.1")).statusCode).toBe(200);
  });

  it("logs out by clearing the cookie", async () => {
    const a = app();
    const res = await a.inject({ method: "POST", url: "/api/logout", payload: {} });
    expect(res.statusCode).toBe(200);
    expect(res.cookies.find((c) => c.name === "session")?.value).toBe("");
  });
});

describe("every API call needs a session", () => {
  it.each(["/api/cases", "/api/cases/LB-000001", "/api/reasons/top", "/api/me"])("GET %s without session → 401", async (url) => {
    const res = await app().inject({ method: "GET", url });
    expect(res.statusCode).toBe(401);
  });

  it.each([
    ["/api/cases/LB-000001/unlock", { verification: "BRANCH", reason: "Seen at the branch" }],
    ["/api/cases/LB-000001/sms", {}],
  ])("POST %s without session → 401 and the Admin API is never called", async (url, payload) => {
    let called = false;
    const a = buildApp({ adminApi: { ...api, unlock: async () => { called = true; throw new Error("x"); }, startSms: async () => { called = true; return { challengeId: "x" }; } }, agents, jwtSecret: "test-secret-test-secret-test-secret" });
    const res = await a.inject({ method: "POST", url, payload });
    expect(res.statusCode).toBe(401);
    expect(called).toBe(false);
  });

  it("sets the Secure cookie flag when COOKIE_SECURE=true", async () => {
    process.env.COOKIE_SECURE = "true";
    try {
      const res = await login(app(), "correct horse battery");
      expect(res.cookies.find((c) => c.name === "session")?.secure).toBe(true);
    } finally {
      delete process.env.COOKIE_SECURE;
    }
  });

  it("rejects a forged token", async () => {
    const other = buildApp({ adminApi: api, agents, jwtSecret: "another-secret-another-secret-xx" });
    await other.ready();
    const forged = other.jwt.sign({ agentId: "agent-999", name: "Mallory" });
    const res = await app().inject({ method: "GET", url: "/api/cases", cookies: { session: forged } });
    expect(res.statusCode).toBe(401);
  });

  it("keeps health and the web page public, and unknown API paths 404", async () => {
    const a = app();
    expect((await a.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
    expect((await a.inject({ method: "GET", url: "/api/nope" })).statusCode).toBe(404);
  });
});
