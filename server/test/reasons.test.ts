import { describe, expect, it } from "vitest";
import { topReasons } from "../src/reasons.js";

let n = 0;
// Every entry gets its own agent; the account is new unless given.
const unlock = (reason: string, verification = "SMS_CHALLENGE", accountId?: string) => {
  n++;
  return {
    action: "UNLOCK", accountId: accountId ?? `LB-${String(n).padStart(6, "0")}`, agentId: `agent-${n}`, verification, reason, at: "2026-10-14T18:00:00Z",
  };
};

describe("topReasons", () => {
  it("returns reasons used at least twice, most used first, grouped ignoring case and spaces", () => {
    const audit = [
      unlock("Camera did not find face; verified by SMS"),
      unlock("camera did not find face;  verified by SMS "),
      unlock("Camera did not find face; verified by SMS"),
      unlock("Poor light; verified by SMS"),
      unlock("Poor light; verified by SMS"),
      unlock("Mrs Novakova called from Brno, verified"), // one-off: may hold personal data
    ];
    expect(topReasons(audit)).toEqual([
      { text: "Camera did not find face; verified by SMS", count: 3, verification: "SMS_CHALLENGE" },
      { text: "Poor light; verified by SMS", count: 2, verification: "SMS_CHALLENGE" },
    ]);
  });

  it("ignores resets, odd entries and overlong text, and caps the list", () => {
    const audit = [
      { ...unlock("Reset"), action: "RESET_BIOMETRICS" },
      { ...unlock("Reset"), action: "RESET_BIOMETRICS" },
      null,
      { action: "UNLOCK", reason: 42 },
      unlock("x".repeat(501)),
      unlock("x".repeat(501)),
      ...Array.from({ length: 8 }, (_, i) => [unlock(`Reason variant ${"abcdefgh"[i]}`), unlock(`Reason variant ${"abcdefgh"[i]}`)]).flat(),
    ];
    const top = topReasons(audit as never, 5);
    expect(top).toHaveLength(5);
    expect(top.every((r) => r.text.startsWith("Reason variant"))).toBe(true);
  });

  it("returns an empty list for a non-list answer", () => {
    expect(topReasons({} as never)).toEqual([]);
  });
});

describe("topReasons – only wording shared across customers (review N14)", () => {
  it("ignores a reason used twice for the same customer", () => {
    const audit = [unlock("Mrs X from Brno, verified", "BRANCH", "LB-000007"), unlock("Mrs X from Brno, verified", "BRANCH", "LB-000007")];
    expect(topReasons(audit)).toEqual([]);
  });
  it("counts customers, not uses", () => {
    const audit = [
      unlock("Seen at branch with ID", "BRANCH", "LB-000001"),
      unlock("Seen at branch with ID", "BRANCH", "LB-000001"),
      unlock("Seen at branch with ID", "BRANCH", "LB-000002"),
    ];
    expect(topReasons(audit)).toEqual([{ text: "Seen at branch with ID", count: 2, verification: "BRANCH" }]);
  });
});

describe("topReasons – security review N14", () => {
  it.each([
    "Husband Peter Novak +421905123456 confirmed",
    "Verified for LB-000052 at branch",
    "Confirmed by mail to jana@example.com",
    "Mrs Novakova seen at branch with ID",
    "ID card number 4455 checked at branch",
  ])("never suggests text that may hold personal data: %j", (text) => {
    expect(topReasons([unlock(text, "BRANCH"), unlock(text, "BRANCH")])).toEqual([]);
  });

  it("needs two different agents, not one agent on two customers", () => {
    const one = (acc: string) => ({ ...unlock("Verified by SMS code, all fine", "BRANCH", acc), agentId: "agent-x" });
    expect(topReasons([one("LB-000001"), one("LB-000002"), one("LB-000003")])).toEqual([]);
  });

  it("groups by verification method and returns it", () => {
    const audit = [unlock("Camera problem; customer verified", "BRANCH"), unlock("Camera problem; customer verified", "BRANCH"), unlock("Camera problem; customer verified", "SMS_CHALLENGE")];
    expect(topReasons(audit)).toEqual([{ text: "Camera problem; customer verified", count: 2, verification: "BRANCH" }]);
  });
});
