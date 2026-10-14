import type { Account, AdminApi } from "./adminApi.js";
import type { Ticket } from "./tickets.js";
import { decideVerdict, type Attempt, type Verdict } from "./verdict.js";

export interface CaseData {
  account: Account;
  attempts: Attempt[];
  verdict: Verdict;
}

const TTL_MS = 60_000;
const QUEUE_CONCURRENCY = 2; // queue loads leave room in the Admin API rate limit for the agent's own clicks

/** Runs at most `max` tasks at a time; the rest wait in order. */
function limiter(max: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (running >= max) await new Promise<void>((r) => waiting.push(r));
    running++;
    try {
      return await task();
    } finally {
      running--;
      waiting.shift()?.();
    }
  };
}

/** Loads account + attempts from the Admin API, with a short cache so the queue stays within the API rate limit. */
export function createCaseStore(adminApi: AdminApi, tickets: Ticket[]) {
  // last good value per account, plus the in-flight load (if any)
  const cache = new Map<string, { at: number; value?: CaseData; loading?: Promise<CaseData> }>();
  const queueLane = limiter(QUEUE_CONCURRENCY);

  async function load(accountId: string): Promise<CaseData> {
    const [account, attempts] = await Promise.all([adminApi.getAccount(accountId), adminApi.getAttempts(accountId)]);
    return { account, attempts, verdict: decideVerdict(account, attempts) };
  }

  function refresh(accountId: string, forQueue = false): Promise<CaseData> {
    const entry = cache.get(accountId) ?? { at: 0 };
    if (entry.loading && forQueue) return entry.loading;
    const loading = (forQueue ? queueLane(() => load(accountId)) : load(accountId)).then(
      (value) => {
        cache.set(accountId, { at: Date.now(), value });
        return value;
      },
      (err) => {
        cache.set(accountId, { ...entry, loading: undefined });
        throw err;
      },
    );
    cache.set(accountId, { ...entry, loading });
    return loading;
  }

  /** Case page and unlock: always ask the Admin API right away (never waits behind queue loads). */
  function get(accountId: string): Promise<CaseData> {
    return refresh(accountId);
  }

  /** Queue: serve the cached value (refreshing it in the background when stale), load missing ones in the queue lane. */
  function getForQueue(accountId: string): Promise<CaseData> {
    const entry = cache.get(accountId);
    if (!entry?.value) return refresh(accountId, true);
    if (Date.now() - entry.at >= TTL_MS) refresh(accountId, true).catch(() => {});
    return Promise.resolve(entry.value);
  }

  async function list() {
    const byAccount = new Map<string, Ticket[]>();
    for (const t of tickets) byAccount.set(t.accountId, [...(byAccount.get(t.accountId) ?? []), t]);

    const rows = await Promise.all(
      [...byAccount].map(async ([accountId, own]) => {
        const c = await getForQueue(accountId).catch(() => null); // unknown account in a ticket: leave it out
        if (!c || c.account.status !== "LOCKED") return null;
        const waitingSince = own.map((t) => t.createdAt).sort()[0];
        return {
          accountId,
          name: c.account.fullName,
          lockedAt: c.account.lockedAt,
          waitingSince,
          channels: [...new Set(own.map((t) => t.channel))].sort(),
          ticketCount: own.length,
          risk: c.verdict.kind,
        };
      }),
    );
    return rows.filter((r) => r !== null).sort((a, b) => a.waitingSince.localeCompare(b.waitingSince));
  }

  return {
    get,
    list,
    ticketsFor: (accountId: string) => tickets.filter((t) => t.accountId === accountId),
    forget: (accountId: string) => cache.delete(accountId),
  };
}

export type CaseStore = ReturnType<typeof createCaseStore>;
