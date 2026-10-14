import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { AdminApiError, type AdminApi, type Account } from "../src/adminApi.js";
import type { Attempt } from "../src/verdict.js";
import type { Ticket } from "../src/tickets.js";

const locked = (id: string, over: Partial<Account> = {}): Account => ({
  accountId: id,
  fullName: "Test Person",
  country: "SK",
  status: "LOCKED",
  lockedAt: "2026-10-12T18:10:02Z",
  enrolledAt: "2025-01-01",
  trustedDeviceId: "dev-1",
  lastAppVersion: "4.2.0",
  registeredPhone: "+421 *** *** 624",
  ...over,
});
const fail = (over: Partial<Attempt> = {}): Attempt => ({
  attempt_id: "A1", timestamp: "2026-10-12T18:00:00Z", customer_id: "LB-000001", device_id: "dev-1",
  device_model: "iPhone 13", app_version: "4.2.0", ip_country: "SK", liveness_score: "0.9", match_score: "",
  result: "FAIL", fail_reason: "NO_FACE_DETECTED", ...over,
});

const tickets: Ticket[] = [
  { ticketId: "T1", createdAt: "2026-10-11T12:00:00Z", accountId: "LB-000001", channel: "phone", status: "NEW", text: "help" },
  { ticketId: "T2", createdAt: "2026-10-11T09:00:00Z", accountId: "LB-000002", channel: "email", status: "NEW", text: "help" },
  { ticketId: "T3", createdAt: "2026-10-12T09:00:00Z", accountId: "LB-000002", channel: "chat", status: "NEW", text: "again" },
  { ticketId: "T4", createdAt: "2026-10-10T09:00:00Z", accountId: "LB-000003", channel: "chat", status: "NEW", text: "ok now" },
];

function fakeApi(): AdminApi {
  const accounts: Record<string, Account> = {
    "LB-000001": locked("LB-000001"),
    "LB-000002": locked("LB-000002"),
    "LB-000003": locked("LB-000003", { status: "ACTIVE", lockedAt: null }),
    "LB-000004": locked("LB-000004"), // exists, locked, but has no ticket
  };
  const attempts: Record<string, Attempt[]> = {
    "LB-000001": [fail()],
    "LB-000002": [fail({ fail_reason: "LIVENESS_FAIL" })],
    "LB-000003": [],
  };
  return {
    health: async () => true,
    getAccount: async (id) => {
      if (!accounts[id]) throw new AdminApiError(404, "not found");
      return accounts[id];
    },
    getAttempts: async (id) => attempts[id] ?? [],
    startSms: vi.fn(async () => ({ challengeId: "11111111-1111-4111-8111-111111111111" })),
    checkSms: vi.fn(async (_id: string, code: string) => ({ verified: code === "123456" })),
    unlock: vi.fn(async (id: string) => ({ ...accounts[id], status: "ACTIVE" as const, lockedAt: null })),
  };
}

const app = (api = fakeApi()) => buildApp({ adminApi: api, tickets });
const validUnlock = {
  agentId: "agent-042",
  verification: "SMS_CHALLENGE",
  challengeId: "11111111-1111-4111-8111-111111111111",
  reason: "Camera did not find face; verified by SMS",
};

describe("GET /api/cases", () => {
  it("lists only locked accounts with tickets, grouped, oldest wait first, with risk", async () => {
    const res = await app().inject({ method: "GET", url: "/api/cases" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.map((c: { accountId: string }) => c.accountId)).toEqual(["LB-000002", "LB-000001"]);
    expect(body[0]).toMatchObject({ waitingSince: "2026-10-11T09:00:00Z", ticketCount: 2, channels: ["chat", "email"], risk: "ATTACK" });
    expect(body[1]).toMatchObject({ risk: "FUMBLE", name: "Test Person" });
  });
});

describe("GET /api/cases/:accountId", () => {
  it("returns account, tickets, attempts and verdict", async () => {
    const res = await app().inject({ method: "GET", url: "/api/cases/LB-000001" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.account.registeredPhone).toBe("+421 *** *** 624");
    expect(body.tickets).toHaveLength(1);
    expect(body.attempts[0]).toMatchObject({ deviceTrusted: true, failReason: "NO_FACE_DETECTED" });
    expect(body.attempts[0]).not.toHaveProperty("device_id");
    expect(body.verdict.kind).toBe("FUMBLE");
  });

  it("rejects malformed account ids with 400", async () => {
    const res = await app().inject({ method: "GET", url: "/api/cases/../../audit" });
    expect([400, 404]).toContain(res.statusCode);
    const res2 = await app().inject({ method: "GET", url: "/api/cases/x1" });
    expect(res2.statusCode).toBe(400);
  });

  it("returns 404 for an unknown account", async () => {
    const res = await app().inject({ method: "GET", url: "/api/cases/LB-999999" });
    expect(res.statusCode).toBe(404);
  });
});

describe("SMS verification", () => {
  it("starts a challenge and checks a code", async () => {
    const a = app();
    const start = await a.inject({ method: "POST", url: "/api/cases/LB-000001/sms", payload: {} });
    expect(start.statusCode).toBe(201);
    const { challengeId } = start.json();
    const check = await a.inject({ method: "POST", url: `/api/cases/LB-000001/sms/${challengeId}/check`, payload: { code: "123456" } });
    expect(check.json()).toEqual({ verified: true });
  });

  it("rejects a code that is not 6 digits", async () => {
    const res = await app().inject({
      method: "POST", url: "/api/cases/LB-000001/sms/11111111-1111-4111-8111-111111111111/check", payload: { code: "12ab" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("refuses to send an SMS for an ATTACK case", async () => {
    const api = fakeApi();
    const res = await app(api).inject({ method: "POST", url: "/api/cases/LB-000002/sms", payload: {} });
    expect(res.statusCode).toBe(403);
    expect(api.startSms).not.toHaveBeenCalled();
  });
});

async function withChallenge(api = fakeApi()) {
  const a = app(api);
  await a.inject({ method: "POST", url: "/api/cases/LB-000001/sms", payload: {} });
  return a;
}

describe("POST /api/cases/:accountId/unlock", () => {
  it("unlocks a FUMBLE case after SMS verification", async () => {
    const api = fakeApi();
    const res = await (await withChallenge(api)).inject({ method: "POST", url: "/api/cases/LB-000001/unlock", payload: validUnlock });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ACTIVE");
    expect(api.unlock).toHaveBeenCalledWith("LB-000001", validUnlock);
  });

  it("refuses to unlock an ATTACK case (403) and never calls the Admin API", async () => {
    const api = fakeApi();
    const res = await app(api).inject({ method: "POST", url: "/api/cases/LB-000002/unlock", payload: validUnlock });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatch(/fraud/i);
    expect(api.unlock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing reason", { ...validUnlock, reason: "" }],
    ["bad agent id", { ...validUnlock, agentId: "<script>" }],
    ["unknown verification", { ...validUnlock, verification: "TRUST_ME" }],
    ["missing challenge", { ...validUnlock, challengeId: undefined }],
    ["extra field", { ...validUnlock, password: "x" }],
  ])("rejects %s with 400", async (_name, payload) => {
    const api = fakeApi();
    const res = await app(api).inject({ method: "POST", url: "/api/cases/LB-000001/unlock", payload });
    expect(res.statusCode).toBe(400);
    expect(api.unlock).not.toHaveBeenCalled();
  });

  it("passes Admin API refusals through (e.g. 422 unverified challenge)", async () => {
    const api = fakeApi();
    api.unlock = vi.fn(async () => { throw new AdminApiError(422, "SMS_CHALLENGE needs a verified challengeId for this account"); });
    const res = await (await withChallenge(api)).inject({ method: "POST", url: "/api/cases/LB-000001/unlock", payload: validUnlock });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toMatch(/verified/);
  });
});

describe("queue cache", () => {
  it("serves a stale entry right away and refreshes it in the background", async () => {
    vi.useFakeTimers();
    try {
      const api = fakeApi();
      const getAccount = vi.spyOn(api, "getAccount");
      const a = app(api);
      await a.inject({ method: "GET", url: "/api/cases" });
      const callsAfterFirst = getAccount.mock.calls.length;
      vi.advanceTimersByTime(60_000);
      let slow!: () => void;
      getAccount.mockImplementation((id) => new Promise((r) => (slow = () => r({ ...locked(id) }))));
      const res = await a.inject({ method: "GET", url: "/api/cases" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(2);
      expect(getAccount.mock.calls.length).toBeGreaterThan(callsAfterFirst);
      slow();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("access limits (security review)", () => {
  it("does not show accounts without an open ticket", async () => {
    const res = await app().inject({ method: "GET", url: "/api/cases/LB-000004" });
    expect(res.statusCode).toBe(404);
  });

  it("still shows a ticketed case after it was unlocked", async () => {
    const res = await app().inject({ method: "GET", url: "/api/cases/LB-000003" });
    expect(res.statusCode).toBe(200);
    expect(res.json().account.status).toBe("ACTIVE");
  });

  it("refuses SMS for an account that is not locked", async () => {
    const api = fakeApi();
    const res = await app(api).inject({ method: "POST", url: "/api/cases/LB-000003/sms", payload: {} });
    expect(res.statusCode).toBe(409);
    expect(api.startSms).not.toHaveBeenCalled();
  });

  it("allows one SMS per account per 30 seconds", async () => {
    const api = fakeApi();
    const a = app(api);
    expect((await a.inject({ method: "POST", url: "/api/cases/LB-000001/sms", payload: {} })).statusCode).toBe(201);
    const second = await a.inject({ method: "POST", url: "/api/cases/LB-000001/sms", payload: {} });
    expect(second.statusCode).toBe(429);
    expect(api.startSms).toHaveBeenCalledTimes(1);
  });

  it("rejects POSTs that are not JSON (blocks cross-site form posts)", async () => {
    const api = fakeApi();
    const res = await app(api).inject({
      method: "POST", url: "/api/cases/LB-000001/sms", headers: { "content-type": "text/plain" }, payload: "a=b",
    });
    expect(res.statusCode).toBe(415);
    expect(api.startSms).not.toHaveBeenCalled();
  });

  it("rejects a challenge that was not started for this account", async () => {
    const api = fakeApi();
    const a = app(api);
    const check = await a.inject({
      method: "POST", url: "/api/cases/LB-000001/sms/11111111-1111-4111-8111-111111111111/check", payload: { code: "123456" },
    });
    expect(check.statusCode).toBe(404);
    const unlock = await a.inject({ method: "POST", url: "/api/cases/LB-000001/unlock", payload: validUnlock });
    expect(unlock.statusCode).toBe(404);
    expect(api.unlock).not.toHaveBeenCalled();
  });

  it("hides Admin API auth or server errors behind a generic 502", async () => {
    const api = fakeApi();
    api.getAccount = async () => { throw new AdminApiError(401, "unauthorized"); };
    const res = await app(api).inject({ method: "GET", url: "/api/cases/LB-000001" });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).not.toMatch(/unauthorized/);
  });
});

describe("queue refresh does not block the agent", () => {
  it("loads at most 2 accounts at a time for the queue", async () => {
    const many: Ticket[] = Array.from({ length: 10 }, (_, i) => ({
      ticketId: `T${i}`, createdAt: "2026-10-11T12:00:00Z", accountId: `LB-00010${i}`, channel: "phone", status: "NEW", text: "x",
    }));
    let inFlight = 0;
    let maxInFlight = 0;
    const api = fakeApi();
    api.getAccount = async (id) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return locked(id);
    };
    const res = await buildApp({ adminApi: api, tickets: many }).inject({ method: "GET", url: "/api/cases" });
    expect(res.json()).toHaveLength(10);
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});

describe("error mapping", () => {
  it("reports our own bugs as 500, not as an Admin API outage", async () => {
    const api = fakeApi();
    api.getAttempts = async () => { throw new TypeError("boom"); };
    const res = await app(api).inject({ method: "GET", url: "/api/cases/LB-000001" });
    expect(res.statusCode).toBe(500);
  });

  it("reports an unreachable Admin API as 502", async () => {
    const api = fakeApi();
    api.getAttempts = async () => { throw new AdminApiError(502, "unreachable"); };
    const res = await app(api).inject({ method: "GET", url: "/api/cases/LB-000001" });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toMatch(/not reachable/);
  });
});
