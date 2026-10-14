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
    const v = decideVerdict(account, [
      attempt({ result: "SUCCESS", fail_reason: "", device_id: "dev-2", ip_country: "NG" }),
      attempt({}),
    ]);
    expect(v.kind).toBe("FUMBLE");
  });
});

describe("attack reasons (policy rule 3)", () => {
  it("explains liveness failures with count, presentation attack and latest time", () => {
    const v = decideVerdict(account, [
      attempt({ fail_reason: "LIVENESS_FAIL", timestamp: "2026-10-12T08:00:00Z" }),
      attempt({ fail_reason: "LIVENESS_FAIL", timestamp: "12.10.2026 21:21:19 CEST" }),
    ]);
    expect(v.kind).toBe("ATTACK");
    expect(v.reasons).toHaveLength(1);
    expect(v.reasons[0]).toMatch(/^2 failed liveness checks/);
    expect(v.reasons[0]).toMatch(/presentation attack: photo, screen or mask/);
    expect(v.reasons[0]).toMatch(/latest 2026-10-12T19:21:19Z/);
  });

  it("names the untrusted device model, with count and latest time", () => {
    const v = decideVerdict(account, [
      attempt({ device_id: "dev-9", device_model: "Galaxy S21", timestamp: "2026-10-12T08:00:00Z" }),
      attempt({ device_id: "dev-9", device_model: "Galaxy S21", timestamp: "2026-10-12T09:00:00Z" }),
      attempt({ device_id: "dev-8", device_model: "Pixel 7", timestamp: "2026-10-11T09:00:00Z" }),
    ]);
    expect(v.kind).toBe("ATTACK");
    expect(v.reasons).toHaveLength(1);
    expect(v.reasons[0]).toMatch(/^3 failed attempts from a device that is not the customer's trusted device/);
    expect(v.reasons[0]).toMatch(/Galaxy S21, Pixel 7/);
    expect(v.reasons[0]).toMatch(/latest 2026-10-12T09:00:00Z/);
  });

  it("names the foreign countries and the home country, with count and latest time", () => {
    const v = decideVerdict(account, [
      attempt({ ip_country: "NG", timestamp: "2026-10-12T08:00:00Z" }),
      attempt({ ip_country: "BR", timestamp: "2026-10-12T10:00:00Z" }),
    ]);
    expect(v.kind).toBe("ATTACK");
    expect(v.reasons).toHaveLength(1);
    expect(v.reasons[0]).toMatch(/^2 failed attempts from another country \(BR, NG\)/);
    expect(v.reasons[0]).toMatch(/customer lives in SK/);
    expect(v.reasons[0]).toMatch(/latest 2026-10-12T10:00:00Z/);
  });

  it("uses singular words for one attempt", () => {
    const v = decideVerdict(account, [attempt({ fail_reason: "LIVENESS_FAIL" })]);
    expect(v.reasons[0]).toMatch(/^1 failed liveness check \(/);
  });

  it("gives one reason per signal when several are present", () => {
    const v = decideVerdict(account, [attempt({ fail_reason: "LIVENESS_FAIL", device_id: "dev-9", ip_country: "VN" })]);
    expect(v.kind).toBe("ATTACK");
    expect(v.reasons).toHaveLength(3);
  });

  it("compares normalised values (spaces, lower case) so a clean case is not flagged", () => {
    const v = decideVerdict({ country: "sk ", trustedDeviceId: " dev-1" }, [attempt({ ip_country: " SK", device_id: "dev-1 " })]);
    expect(v.kind).toBe("FUMBLE");
  });

  it("still flags a foreign country written in lower case", () => {
    const v = decideVerdict(account, [attempt({ ip_country: "ng" })]);
    expect(v.kind).toBe("ATTACK");
    expect(v.reasons[0]).toMatch(/NG/);
  });
});

describe("fail closed", () => {
  const unknown =
    "No failed face-login attempts found, so the cause of the lockout is unknown. Do not unlock; escalate to the Fraud team.";

  it("is ATTACK when there are no attempts at all", () => {
    expect(decideVerdict(account, [])).toEqual({ kind: "ATTACK", reasons: [unknown] });
  });

  it("is ATTACK when there are only successful attempts", () => {
    expect(decideVerdict(account, [attempt({ result: "SUCCESS", fail_reason: "" })])).toEqual({ kind: "ATTACK", reasons: [unknown] });
  });
});

describe("fumble reasons (policy rule 4)", () => {
  it("lists the causes in plain words with counts and latest time", () => {
    const v = decideVerdict(account, [
      attempt({ fail_reason: "NO_FACE_DETECTED", timestamp: "2026-10-12T08:00:00Z" }),
      attempt({ fail_reason: "NO_FACE_DETECTED", timestamp: "2026-10-12T08:01:00Z" }),
      attempt({ fail_reason: "POOR_LIGHT", timestamp: "12.10.2026 10:05:00 CEST" }),
      attempt({ fail_reason: "TIMEOUT", timestamp: "2026-10-12T07:00:00Z" }),
      attempt({ fail_reason: "LOW_MATCH", timestamp: "2026-10-12T07:30:00Z" }),
    ]);
    expect(v.kind).toBe("FUMBLE");
    expect(v.reasons).toHaveLength(1);
    const r = v.reasons[0];
    expect(r).toMatch(/^5 failed attempts from the customer's trusted device in SK/);
    expect(r).toMatch(/latest 2026-10-12T08:05:00Z/);
    expect(r).toMatch(/camera did not find a face \(2\)/);
    expect(r).toMatch(/poor light \(1\)/);
    expect(r).toMatch(/timed out \(1\)/);
    expect(r).toMatch(/face did not match well enough \(e\.g\. glasses, angle\) \(1\)/);
    expect(r).not.toMatch(/NO_FACE_DETECTED|POOR_LIGHT|LOW_MATCH|TIMEOUT/);
  });

  it("treats LOW_MATCH and TIMEOUT from the trusted device at home as FUMBLE", () => {
    expect(decideVerdict(account, [attempt({ fail_reason: "LOW_MATCH" })]).kind).toBe("FUMBLE");
    expect(decideVerdict(account, [attempt({ fail_reason: "TIMEOUT" })]).kind).toBe("FUMBLE");
  });

  it("treats a failure without a reason as unknown (ATTACK), not as a camera problem", () => {
    const v = decideVerdict(account, [attempt({ fail_reason: "" })]);
    expect(v.kind).toBe("ATTACK");
    expect(v.reasons.join(" ")).toMatch(/unknown failure reason \(none given\)/);
  });
});

describe("fails closed on odd data (security review W1)", () => {
  const trustedFail = attempt({});
  it.each([
    ["result FAILED from NG", attempt({ result: "FAILED", device_id: "dev-evil", ip_country: "NG", fail_reason: "LIVENESS_FAIL" })],
    ["result DENIED", attempt({ result: "DENIED" })],
    ["unknown fail reason", attempt({ fail_reason: "SPOOF_DETECTED" })],
    ["variant liveness code", attempt({ fail_reason: "liveness-fail" })],
    ["empty fail reason", attempt({ fail_reason: "" })],
    ["very low liveness score", attempt({ liveness_score: "0.05" })],
    ["empty attempt device", attempt({ device_id: "" })],
    ["empty attempt country", attempt({ ip_country: "" })],
    ["non-ASCII country that upper-cases to SK", attempt({ ip_country: "ſk" })],
  ])("%s → ATTACK", (_name, odd) => {
    expect(decideVerdict(account, [trustedFail, odd]).kind).toBe("ATTACK");
  });

  it("is ATTACK when the account has no home country or trusted device", () => {
    expect(decideVerdict({ country: "", trustedDeviceId: "" }, [attempt({ ip_country: "", device_id: "" })]).kind).toBe("ATTACK");
    expect(decideVerdict({ country: "SK", trustedDeviceId: "" }, [attempt({ device_id: "" })]).kind).toBe("ATTACK");
  });

  it("keeps real camera problems as FUMBLE, including an empty liveness score on a timeout", () => {
    const v = decideVerdict(account, [
      attempt({ fail_reason: "POOR_LIGHT", liveness_score: "0.515" }),
      attempt({ fail_reason: "TIMEOUT", liveness_score: "" }),
      attempt({ result: " fail ", fail_reason: " low_match " }),
    ]);
    expect(v.kind).toBe("FUMBLE");
  });
});
