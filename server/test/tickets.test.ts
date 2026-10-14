import { describe, expect, it } from "vitest";
import { normalizeAccountId, parseTickets } from "../src/tickets.js";

describe("normalizeAccountId", () => {
  it.each([
    ["LB-000052", "LB-000052"],
    ["83", "LB-000083"],
    ["000003", "LB-000003"],
    [" lb-000118 ", "LB-000118"],
  ])("maps %j to %s", (ref, id) => {
    expect(normalizeAccountId(ref)).toBe(id);
  });

  it.each(["", "abc", "LB-", "1234567", "-5", "LB-00x001"])("rejects %j", (ref) => {
    expect(normalizeAccountId(ref)).toBeNull();
  });
});

describe("parseTickets", () => {
  const csv = [
    "ticket_id,created_at,customer_ref,channel,status,text",
    'T1,2026-10-11T11:11:56Z,LB-000052,phone,NEW,"Please unlock, I am travelling."',
    'T2,2026-10-11T15:22:44Z,83,email,NEW,"Customer 83, app does not recognise me"',
    "T3,2026-10-11T16:00:00Z,???,chat,NEW,unknown customer",
    "T4,2026-10-11T17:00:00Z,52,chat,CLOSED,old ticket",
  ].join("\n");

  it("parses quoted text, normalizes refs and keeps only open tickets with a known account", () => {
    const tickets = parseTickets(csv);
    expect(tickets).toEqual([
      { ticketId: "T1", createdAt: "2026-10-11T11:11:56Z", accountId: "LB-000052", channel: "phone", status: "NEW", text: "Please unlock, I am travelling." },
      { ticketId: "T2", createdAt: "2026-10-11T15:22:44Z", accountId: "LB-000083", channel: "email", status: "NEW", text: "Customer 83, app does not recognise me" },
    ]);
  });
});
