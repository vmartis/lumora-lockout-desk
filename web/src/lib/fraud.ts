import type { CaseDetail } from '@/lib/api'

const MAX_ATTEMPTS = 5
const MAX_FIELD = 64

/** Device-reported text (model, reason) is attacker-controlled: one line, no control characters, capped. */
const clean = (v: string) => v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, MAX_FIELD)

/**
 * Internal escalation note for the Fraud team (unlock policy rule 3). Not for the customer.
 * Holds only what Fraud needs to start: account id (no name, no phone), evidence, recent failed attempts,
 * tickets (no customer text), who escalated.
 * Attempts arrive newest first from the server.
 */
export function fraudSummary(detail: CaseDetail, agentId: string): string {
  const { account, verdict, tickets, attempts } = detail
  const failed = attempts.filter((a) => a.result !== 'SUCCESS').slice(0, MAX_ATTEMPTS)
  return [
    '[INTERNAL – DO NOT SEND TO THE CUSTOMER]',
    'Fraud escalation – face-login lockout',
    `Account: ${account.accountId}, lives in ${account.country}, status ${account.status}${account.lockedAt ? `, locked at ${account.lockedAt}` : ''}`,
    'Evidence:',
    ...verdict.reasons.map((r) => `  - ${r}`),
    `Latest failed attempts (newest first, max ${MAX_ATTEMPTS}):`,
    ...failed.map(
      (a) =>
        `  - ${a.timestamp} · ${clean(a.deviceModel) || 'unknown device'} (${a.deviceTrusted ? 'trusted' : 'untrusted'}) · ${clean(a.country) || 'unknown country'} · liveness ${clean(a.livenessScore) || 'n/a'} · ${clean(a.failReason) || 'no reason'}`,
    ),
    `Tickets: ${tickets.map((t) => `${t.ticketId} (${t.channel}, ${t.createdAt})`).join(', ') || 'none'}`,
    `Agent: ${agentId || '(not entered)'}`,
    'Action taken: not unlocked; the customer is told we are protecting the account.',
  ].join('\n')
}
