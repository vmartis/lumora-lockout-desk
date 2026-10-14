// Cleans up attempt data from the Admin API: mixed date formats, stray spaces, lower-case countries.
import type { Attempt } from "./verdict.js";

const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;
// Local Central European time, day.month.year, e.g. "12.10.2026 08:03:17 CEST".
const CET_LOCAL = /^(\d{1,2})\.(\d{1,2})\.(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (CEST|CET)$/;
const OFFSET_HOURS: Record<string, number> = { CET: 1, CEST: 2 };

/** Builds a UTC time from parts; null when a part is out of range (e.g. 30 February, hour 24). */
function utc(y: number, mo: number, d: number, h: number, mi: number, s: number, offsetHours: number): string | null {
  const local = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const valid =
    local.getUTCFullYear() === y && local.getUTCMonth() === mo - 1 && local.getUTCDate() === d &&
    local.getUTCHours() === h && local.getUTCMinutes() === mi && local.getUTCSeconds() === s;
  if (!valid) return null;
  return new Date(local.getTime() - offsetHours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Any known timestamp format → "YYYY-MM-DDTHH:MM:SSZ" (UTC); null when it cannot be read. */
export function parseTimestamp(raw: string): string | null {
  const text = raw.trim();
  let m = ISO.exec(text);
  if (m) return utc(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6], 0);
  m = CET_LOCAL.exec(text);
  if (m) return utc(+m[3], +m[2], +m[1], +m[4], +m[5], +m[6], OFFSET_HOURS[m[7]]);
  return null;
}

/** Two ASCII letters, upper-cased; anything else (empty, "ſk", "Slovakia") becomes "" = unknown. */
export const normalizeCountry = (raw: string): string => {
  const t = raw.trim();
  return /^[A-Za-z]{2}$/.test(t) ? t.toUpperCase() : "";
};
export const normalizeDeviceId = (raw: string): string => raw.trim();
export const normalizeCode = (raw: string): string => raw.trim().toUpperCase();

/** Same attempt with a UTC timestamp (or the trimmed raw text if unreadable), clean country and device id. */
export function normalizeAttempt(a: Attempt): Attempt {
  return {
    ...a,
    timestamp: parseTimestamp(a.timestamp) ?? a.timestamp.trim(),
    ip_country: normalizeCountry(a.ip_country),
    device_id: normalizeDeviceId(a.device_id),
    result: normalizeCode(a.result),
    fail_reason: normalizeCode(a.fail_reason),
  };
}

/** Newest first by real time; attempts whose time cannot be read go last (in their original order). */
export function sortNewestFirst(attempts: Attempt[]): Attempt[] {
  const keyed = attempts.map((a) => ({ a, t: parseTimestamp(a.timestamp) }));
  keyed.sort((x, y) => {
    if (x.t === null || y.t === null) return (x.t === null ? 1 : 0) - (y.t === null ? 1 : 0);
    return y.t.localeCompare(x.t); // same fixed-width ISO format, so text order is time order
  });
  return keyed.map((k) => k.a);
}
