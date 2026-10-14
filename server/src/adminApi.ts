// Client for the Identity Admin API (external system). The API key never leaves the server.
import type { Attempt } from "./verdict.js";

export interface Account {
  accountId: string;
  fullName: string;
  country: string;
  status: "LOCKED" | "ACTIVE";
  lockedAt: string | null;
  enrolledAt: string | null;
  trustedDeviceId: string;
  lastAppVersion: string;
  registeredPhone: string; // already masked by the Admin API
}

export type Verification = "SMS_CHALLENGE" | "VIDEO_CALL" | "BRANCH";
export interface UnlockRequest {
  agentId: string;
  verification: Verification;
  challengeId?: string;
  reason: string;
}

export interface AuditEntry {
  action: string;
  accountId: string;
  agentId: string;
  verification: string;
  reason: string;
  at: string;
}

export interface AdminApi {
  health(): Promise<boolean>;
  getAccount(accountId: string): Promise<Account>;
  getAttempts(accountId: string): Promise<Attempt[]>;
  startSms(accountId: string): Promise<{ challengeId: string }>;
  checkSms(challengeId: string, code: string): Promise<{ verified: boolean }>;
  unlock(accountId: string, req: UnlockRequest): Promise<Account>;
  getAudit(): Promise<AuditEntry[]>;
}

/** An answer from the Admin API we pass on to the agent (its messages hold no personal data). */
export class AdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Network failures and timeouts become a 502 AdminApiError, so they are not mistaken for our own bugs. */
async function fetchOrUnreachable(url: URL, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new AdminApiError(502, "Identity Admin API unreachable");
  }
}

const MAX_PER_SECOND = 7; // Admin API allows 8 req/s per key; keep one spare.

/** Spaces calls so we never send more than MAX_PER_SECOND in any 1-second window. */
function createThrottle() {
  const sent: number[] = [];
  let chain = Promise.resolve();
  return function slot(): Promise<void> {
    const next = chain.then(async () => {
      for (;;) {
        const now = Date.now();
        while (sent.length && now - sent[0] >= 1000) sent.shift();
        if (sent.length < MAX_PER_SECOND) {
          sent.push(now);
          return;
        }
        await new Promise((r) => setTimeout(r, 1000 - (now - sent[0]) + 5));
      }
    });
    chain = next;
    return next;
  };
}

export function createAdminApi(baseUrl: string, apiKey: string): AdminApi {
  const slot = createThrottle();

  async function call<T>(path: string, body?: unknown, attempt = 1): Promise<T> {
    if (path !== "/health") await slot();
    const res = await fetchOrUnreachable(new URL(path, baseUrl), {
      method: body === undefined ? "GET" : "POST",
      headers: { "X-Api-Key": apiKey, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 429 && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000));
      return call(path, body, attempt + 1);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new AdminApiError(res.status, typeof json.error === "string" ? json.error : `Admin API error ${res.status}`);
    return json as T;
  }

  const enc = encodeURIComponent;
  return {
    async health() {
      const res = await fetch(new URL("/health", baseUrl), { signal: AbortSignal.timeout(5000) });
      return res.ok;
    },
    getAccount: (id) => call(`/accounts/${enc(id)}`),
    getAttempts: (id) => call(`/accounts/${enc(id)}/attempts?limit=50`),
    startSms: (id) => call("/verification/sms", { accountId: id }),
    checkSms: (challengeId, code) => call(`/verification/sms/${enc(challengeId)}/check`, { code }),
    unlock: (id, req) => call(`/accounts/${enc(id)}/unlock`, req),
    getAudit: () => call("/audit"),
  };
}
