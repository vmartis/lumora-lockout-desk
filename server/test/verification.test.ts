import { describe, expect, it } from "vitest";
import { allowedVerifications } from "../src/verification.js";
import type { Ticket } from "../src/tickets.js";

const ticket = (channel: string): Ticket => ({
  ticketId: "T1", createdAt: "2026-10-11T12:00:00Z", accountId: "LB-000001", channel, status: "NEW", text: "help",
});
const fumble = { kind: "FUMBLE" as const, reasons: [] };
const attack = { kind: "ATTACK" as const, reasons: [] };

describe("allowedVerifications", () => {
  it("allows nothing for an ATTACK case, whatever the channel", () => {
    expect(allowedVerifications(attack, [ticket("phone")])).toEqual([]);
    expect(allowedVerifications(attack, [ticket("email")])).toEqual([]);
  });

  it.each(["phone", "chat"])("allows SMS, video call and branch when the customer used %s", (channel) => {
    expect(allowedVerifications(fumble, [ticket(channel)])).toEqual(["SMS_CHALLENGE", "VIDEO_CALL", "BRANCH"]);
  });

  it("allows only video call and branch for an email-only customer", () => {
    expect(allowedVerifications(fumble, [ticket("email")])).toEqual(["VIDEO_CALL", "BRANCH"]);
  });

  it("allows SMS when any open ticket came by phone or chat", () => {
    expect(allowedVerifications(fumble, [ticket("email"), ticket("chat")])).toEqual(["SMS_CHALLENGE", "VIDEO_CALL", "BRANCH"]);
  });

  it("does not allow SMS for an unknown channel or no tickets", () => {
    expect(allowedVerifications(fumble, [ticket("fax")])).toEqual(["VIDEO_CALL", "BRANCH"]);
    expect(allowedVerifications(fumble, [])).toEqual(["VIDEO_CALL", "BRANCH"]);
  });
});
