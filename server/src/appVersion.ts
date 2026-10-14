// Latest Lumora app release. 4.3.1 is the newest version in the login data; in that data 79% of face logins on
// 4.2.0 fail versus 34% on 4.3.1, so customers on an older version are asked to update. Override with LATEST_APP_VERSION.
export const LATEST_APP_VERSION = process.env.LATEST_APP_VERSION ?? "4.3.1";

const VERSION = /^\d+(\.\d+)*$/;
const parts = (v: string) => v.trim().split(".").map(Number);

/** Numeric compare of dotted versions ("4.10.0" > "4.9.9"); missing parts count as 0. */
export function compareVersions(a: string, b: string): number {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function appUpdate(current: string, latest = LATEST_APP_VERSION): { current: string; latest: string } | null {
  if (typeof current !== "string") return null; // the Admin API may omit it; never fail the case page over a hint
  const c = current.trim();
  if (!VERSION.test(c) || !VERSION.test(latest)) return null;
  return compareVersions(c, latest) < 0 ? { current: c, latest } : null;
}
