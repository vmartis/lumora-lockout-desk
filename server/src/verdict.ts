import { normalizeCountry, normalizeDeviceId, parseTimestamp } from "./normalize.js";

/** One face-login attempt as returned by the Admin API (raw CSV columns). */
export interface Attempt {
  attempt_id: string;
  timestamp: string;
  customer_id: string;
  device_id: string;
  device_model: string;
  app_version: string;
  ip_country: string;
  liveness_score: string;
  match_score: string;
  result: string;
  fail_reason: string;
}

export interface Verdict {
  kind: "ATTACK" | "FUMBLE";
  reasons: string[];
}

export const NO_FAILURES_REASON =
  "No failed face-login attempts found, so the cause of the lockout is unknown. Do not unlock here; verify by video call or branch and escalate.";

const CAUSE_WORDS: Record<string, string> = {
  NO_FACE_DETECTED: "camera did not find a face",
  POOR_LIGHT: "poor light",
  TIMEOUT: "timed out",
  LOW_MATCH: "face did not match well enough (e.g. glasses, angle)",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const uniqueSorted = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort();

/** ", latest <ISO time>" for the newest readable time in the group, or a note that no time could be read. */
function latest(group: Attempt[]): string {
  const times = group.map((a) => parseTimestamp(a.timestamp)).filter((t): t is string => t !== null).sort();
  return times.length ? `latest ${times[times.length - 1]}` : "time unknown";
}

/**
 * Unlock policy rule 3: failed attempts from an untrusted device, from another country, or with a failed
 * liveness check look like an attack. Otherwise (rule 4) it is a camera / light problem.
 * Fails closed: with no failed attempts the cause is unknown, so it is treated as ATTACK (no unlock offered).
 */
export function decideVerdict(account: { country: string; trustedDeviceId: string }, attempts: Attempt[]): Verdict {
  const fails = attempts.filter((a) => a.result.trim().toUpperCase() === "FAIL");
  if (fails.length === 0) return { kind: "ATTACK", reasons: [NO_FAILURES_REASON] };

  const home = normalizeCountry(account.country);
  const trusted = normalizeDeviceId(account.trustedDeviceId);
  const reasons: string[] = [];

  const liveness = fails.filter((a) => a.fail_reason.trim().toUpperCase() === "LIVENESS_FAIL");
  if (liveness.length) {
    reasons.push(
      `${plural(liveness.length, "failed liveness check", "failed liveness checks")} ` +
        `(possible presentation attack: photo, screen or mask), ${latest(liveness)}.`,
    );
  }

  const untrusted = fails.filter((a) => normalizeDeviceId(a.device_id) !== trusted);
  if (untrusted.length) {
    const models = uniqueSorted(untrusted.map((a) => a.device_model.trim())).join(", ") || "unknown model";
    reasons.push(
      `${plural(untrusted.length, "failed attempt", "failed attempts")} from a device that is not the customer's trusted device ` +
        `(${models}), ${latest(untrusted)}.`,
    );
  }

  const foreign = fails.filter((a) => normalizeCountry(a.ip_country) !== home);
  if (foreign.length) {
    const countries = uniqueSorted(foreign.map((a) => normalizeCountry(a.ip_country))).join(", ") || "unknown country";
    reasons.push(
      `${plural(foreign.length, "failed attempt", "failed attempts")} from another country (${countries}); ` +
        `the customer lives in ${home}, ${latest(foreign)}.`,
    );
  }

  if (reasons.length) return { kind: "ATTACK", reasons };

  // Everything left came from the trusted device in the home country. LOW_MATCH and TIMEOUT count as FUMBLE too:
  // policy rule 3 names only an untrusted device, a foreign country and failed liveness as attack examples.
  const counts = new Map<string, number>();
  for (const a of fails) {
    const code = a.fail_reason.trim().toUpperCase();
    const words = CAUSE_WORDS[code] ?? (code ? `other (${code})` : "no reason given");
    counts.set(words, (counts.get(words) ?? 0) + 1);
  }
  const causes = [...counts].sort((x, y) => y[1] - x[1]).map(([words, n]) => `${words} (${n})`).join(", ");
  return {
    kind: "FUMBLE",
    reasons: [
      `${plural(fails.length, "failed attempt", "failed attempts")} from the customer's trusted device in ${home}, ` +
        `${latest(fails)}. Causes: ${causes}.`,
    ],
  };
}
