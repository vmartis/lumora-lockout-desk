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

/**
 * Unlock policy rule 3: failed attempts from an untrusted device, from another country, or with a failed
 * liveness check look like an attack. Otherwise (rule 4) it is a camera / light problem.
 */
export function decideVerdict(account: { country: string; trustedDeviceId: string }, attempts: Attempt[]): Verdict {
  const fails = attempts.filter((a) => a.result === "FAIL");
  const reasons: string[] = [];

  const liveness = fails.filter((a) => a.fail_reason === "LIVENESS_FAIL").length;
  if (liveness) reasons.push(`${liveness} failed liveness check(s): possible photo, screen or mask`);

  const untrusted = fails.filter((a) => a.device_id !== account.trustedDeviceId).length;
  if (untrusted) reasons.push(`${untrusted} failed attempt(s) from a device that is not the customer's trusted device`);

  const countries = [...new Set(fails.filter((a) => a.ip_country !== account.country).map((a) => a.ip_country))];
  if (countries.length) reasons.push(`Failed attempt(s) from ${countries.join(", ")}; customer lives in ${account.country}`);

  if (reasons.length) return { kind: "ATTACK", reasons };

  const causes = [...new Set(fails.map((a) => a.fail_reason).filter(Boolean))];
  return {
    kind: "FUMBLE",
    reasons: [`${fails.length} failed attempt(s) from the trusted device in ${account.country}: ${causes.join(", ") || "no reason given"}`],
  };
}
