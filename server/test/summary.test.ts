import { describe, expect, it } from "vitest";
import { summarize } from "../src/summary.js";
import type { CaseData } from "../src/cases.js";
import type { Attempt } from "../src/verdict.js";

const att = (app: string, result: string, reason = ""): Attempt => ({
  attempt_id: "A", timestamp: "", customer_id: "", device_id: "d", device_model: "m", app_version: app,
  ip_country: "SK", liveness_score: "0.9", match_score: "", result, fail_reason: reason,
});
const c = (app: string, kind: "ATTACK" | "FUMBLE", attempts: Attempt[]): CaseData => ({
  account: { accountId: "LB-1", fullName: "Secret Name", country: "SK", status: "LOCKED", lockedAt: null, enrolledAt: null, trustedDeviceId: "d", lastAppVersion: app, registeredPhone: "x" },
  attempts,
  verdict: { kind, reasons: [] },
});

describe("summarize – lead overview (N7)", () => {
  const cases = [
    c("4.2.0", "FUMBLE", [att("4.2.0", "FAIL", "NO_FACE_DETECTED"), att("4.2.0", "FAIL", "NO_FACE_DETECTED"), att("4.2.0", "SUCCESS")]),
    c("4.2.0", "FUMBLE", [att("4.2.0", "FAIL", "POOR_LIGHT"), att("4.2.0", "FAIL", "NO_FACE_DETECTED")]),
    c("4.3.1", "ATTACK", [att("4.3.1", "FAIL", "LIVENESS_FAIL"), att("4.3.1", "SUCCESS"), att("4.3.1", "SUCCESS"), att("4.3.1", "SUCCESS")]),
  ];
  const s = summarize(cases);

  it("counts waiting customers by verdict", () => {
    expect(s.waiting).toEqual({ total: 3, attacks: 1, camera: 2 });
  });

  it("counts failed attempts by cause, most first", () => {
    expect(s.causes).toEqual([
      { cause: "NO_FACE_DETECTED", failures: 3 },
      { cause: "POOR_LIGHT", failures: 1 },
      { cause: "LIVENESS_FAIL", failures: 1 },
    ]);
  });

  it("shows failure rate per app version from camera-problem cases only, worst first", () => {
    // The attack case's attempts come from the attacker's device, so they say nothing about the app.
    expect(s.appVersions).toEqual([{ version: "4.2.0", lockedCustomers: 2, attempts: 5, failures: 4, failureRate: 0.8 }]);
  });

  it("contains no personal data", () => {
    expect(JSON.stringify(s)).not.toMatch(/Secret Name|LB-1/);
  });
});
