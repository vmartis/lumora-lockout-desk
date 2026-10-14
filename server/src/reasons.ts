const MIN_CUSTOMERS = 2; // wording used for one customer only may be a note about them; shared phrasing is reused
const MIN_AGENTS = 2; // one person alone cannot plant a suggestion for everybody
const MAX_LENGTH = 500;

/**
 * Text that may hold personal data is never suggested to other agents: numbers of 4+ digits (phone, ID, date),
 * account ids, e-mail addresses, and titles in front of a name. A cheap filter, not a guarantee.
 */
export function mayHoldPersonalData(text: string): boolean {
  return /\d{4,}|\bLB-?\d|@|\b(mr|mrs|ms|miss|dr)\b\.?/i.test(text);
}

const tidy = (text: string) => text.trim().replace(/\s+/g, " ");

type Group = { text: string; verification: string; accounts: Set<string>; agents: Set<string> };

/**
 * Unlock reasons shared by the team, per verification method, as {text, count = customers, verification}.
 * Only wording used for 2+ customers by 2+ agents and with no sign of personal data.
 */
export function topReasons(audit: unknown, limit = 5): { text: string; count: number; verification: string }[] {
  if (!Array.isArray(audit)) return [];
  const groups = new Map<string, Group>();
  for (const e of audit) {
    if (!e || typeof e !== "object") continue;
    const { action, reason, accountId, agentId, verification } = e as Record<string, unknown>;
    if (action !== "UNLOCK") continue;
    if ([reason, accountId, agentId, verification].some((v) => typeof v !== "string")) continue;
    const text = tidy(reason as string);
    if (text.length < 5 || text.length > MAX_LENGTH || mayHoldPersonalData(text)) continue;
    const key = `${verification}|${text.toLowerCase()}`;
    const g = groups.get(key) ?? { text, verification: verification as string, accounts: new Set(), agents: new Set() };
    g.accounts.add(accountId as string);
    g.agents.add(agentId as string);
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter((g) => g.accounts.size >= MIN_CUSTOMERS && g.agents.size >= MIN_AGENTS)
    .map((g) => ({ text: g.text, count: g.accounts.size, verification: g.verification }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, limit);
}
