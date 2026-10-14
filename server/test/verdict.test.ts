import { describe, expect, it } from "vitest";
import { decideVerdict, type Attempt } from "../src/verdict.js";

const account = { country: "SK", trustedDeviceId: "dev-1" };
const attempt = (over: Partial<Attempt>): Attempt => ({
  attempt_id: "A1",
  timestamp: "2026-10-13T10:00:00Z",
  customer_id: "LB-000001",
  device_id: "dev-1",
  device_model: "iPhone 13",
  app_version: "4.2.0",
  ip_country: "SK",
  liveness_score: "0.9",
  match_score: "",
  result: "FAIL",
  fail_reason: "NO_FACE_DETECTED",
  ...over,
});

describe("decideVerdict", () => {
  it("is FUMBLE when failures come from the trusted device, home country, and camera problems", () => {
    const v = decideVerdict(account, [attempt({}), attempt({ fail_reason: "POOR_LIGHT" })]);
    expect(v.kind).toBe("FUMBLE");
  });

  it("is ATTACK on a failed liveness check", () => {
    const v = decideVerdict(account, [attempt({ fail_reason: "LIVENESS_FAIL" })]);
    expect(v.kind).toBe("ATTACK");
    expect(v.reasons.join(" ")).toMatch(/liveness/i);
  });

  it("is ATTACK when a failure comes from an untrusted device", () => {
    const v = decideVerdict(account, [attempt({ device_id: "dev-999" })]);
    expect(v.kind).toBe("ATTACK");
    expect(v.reasons.join(" ")).toMatch(/device/i);
  });

  it("is ATTACK when a failure comes from another country", () => {
    const v = decideVerdict(account, [attempt({ ip_country: "NG" })]);
    expect(v.kind).toBe("ATTACK");
    expect(v.reasons.join(" ")).toMatch(/NG/);
  });

  it("ignores successful logins from other devices", () => {
    const v = decideVerdict(account, [attempt({ result: "SUCCESS", fail_reason: "", device_id: "dev-2" })]);
    expect(v.kind).toBe("FUMBLE");
  });
});
