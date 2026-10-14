import type { Verification } from "./adminApi.js";
import type { Ticket } from "./tickets.js";
import type { Verdict } from "./verdict.js";

// Unlock policy §2: an SMS code only when the customer reached us by phone or chat; video call or branch for any channel.
const SMS_CHANNELS = new Set(["phone", "chat"]);

/** Verification methods the policy allows for this case. None for a likely attack (policy §3: escalate instead). */
export function allowedVerifications(verdict: Verdict, tickets: Ticket[]): Verification[] {
  if (verdict.kind === "ATTACK") return [];
  const sms = tickets.some((t) => SMS_CHANNELS.has(t.channel.trim().toLowerCase()));
  return [...(sms ? (["SMS_CHALLENGE"] as const) : []), "VIDEO_CALL", "BRANCH"];
}
