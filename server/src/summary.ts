import type { CaseData } from "./cases.js";
import { normalizeCode } from "./normalize.js";

/** Figures for the team lead (N7): counts only, never a name, account id or other personal data. */
export function summarize(cases: CaseData[]) {
  const attacks = cases.filter((c) => c.verdict.kind === "ATTACK").length;

  const causes = new Map<string, number>();
  const versions = new Map<string, { lockedCustomers: number; attempts: number; failures: number }>();
  const version = (v: string) => {
    const key = v.trim() || "unknown";
    const entry = versions.get(key) ?? { lockedCustomers: 0, attempts: 0, failures: 0 };
    versions.set(key, entry);
    return entry;
  };

  for (const c of cases) {
    // App versions only from camera-problem cases: in attack cases the attempts come from the attacker's device.
    const camera = c.verdict.kind !== "ATTACK";
    if (camera) version(c.account.lastAppVersion).lockedCustomers++;
    for (const a of c.attempts) {
      const failed = normalizeCode(a.result) !== "SUCCESS";
      if (camera) {
        const v = version(a.app_version);
        v.attempts++;
        if (failed) v.failures++;
      }
      if (!failed) continue;
      const cause = normalizeCode(a.fail_reason) || "UNKNOWN";
      causes.set(cause, (causes.get(cause) ?? 0) + 1);
    }
  }

  return {
    waiting: { total: cases.length, attacks, camera: cases.length - attacks },
    causes: [...causes].map(([cause, failures]) => ({ cause, failures })).sort((a, b) => b.failures - a.failures),
    appVersions: [...versions]
      .map(([v, e]) => ({ version: v, ...e, failureRate: e.attempts ? Math.round((e.failures / e.attempts) * 100) / 100 : 0 }))
      .sort((a, b) => b.failureRate - a.failureRate),
  };
}
