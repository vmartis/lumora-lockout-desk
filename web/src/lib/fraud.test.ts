import { describe, expect, it } from 'vitest'
import type { Attempt, CaseDetail } from './api'
import { fraudSummary } from './fraud'

const attempt = (over: Partial<Attempt>): Attempt => ({
  attemptId: 'A1',
  timestamp: '2026-10-13T16:52:13Z',
  deviceModel: 'Pixel 7',
  deviceTrusted: false,
  appVersion: '4.3.1',
  country: 'BR',
  livenessScore: '0.120',
  matchScore: '',
  result: 'FAIL',
  failReason: 'LIVENESS_FAIL',
  ...over,
})

const attack: CaseDetail = {
  account: {
    accountId: 'LB-000051',
    fullName: 'Lucia Varga',
    country: 'SK',
    status: 'LOCKED',
    lockedAt: '2026-10-13T16:53:00Z',
    registeredPhone: '+421 *** *** 551',
    lastAppVersion: '4.2.0',
  },
  tickets: [{ ticketId: 'T00007', createdAt: '2026-10-13T18:00:00Z', channel: 'phone', status: 'NEW', text: 'Please unlock me' }],
  attempts: [
    attempt({ attemptId: 'S1', timestamp: '2026-10-14T09:00:00Z', result: 'SUCCESS', failReason: '', deviceTrusted: true, country: 'SK' }),
    ...Array.from({ length: 7 }, (_, i) => attempt({ attemptId: `A${i}`, timestamp: `2026-10-13T16:5${i}:00Z` })),
  ],
  verdict: { kind: 'ATTACK', reasons: ['9 failed liveness checks (possible presentation attack)', 'Failed attempts from BR'] },
  allowedVerifications: [],
  appUpdate: null,
  audit: [],
}

describe('fraudSummary', () => {
  const text = fraudSummary(attack, 'agent-042')

  it('starts with an internal-only warning', () => {
    expect(text.split('\n')[0]).toMatch(/INTERNAL.*DO NOT SEND TO THE CUSTOMER/)
  })

  it('names the account, the agent and the action taken, but not the customer name', () => {
    expect(text).toMatch(/LB-000051/)
    expect(text).not.toMatch(/Lucia|Varga/)
    expect(text).toMatch(/agent-042/)
    expect(text).toMatch(/not unlocked/i)
  })

  it('lists every verdict reason as evidence', () => {
    for (const r of attack.verdict.reasons) expect(text).toContain(r)
  })

  it('lists at most 5 failed attempts with device, trust, country and liveness', () => {
    const rows = text.split('\n').filter((l) => l.startsWith('  - 2026'))
    expect(rows).toHaveLength(5)
    expect(rows[0]).toMatch(/Pixel 7.*untrusted.*BR.*liveness 0\.120.*LIVENESS_FAIL/)
    expect(text).not.toMatch(/2026-10-14T09:00:00Z/) // the successful login
  })

  it('lists the tickets and leaves out the phone number', () => {
    expect(text).toMatch(/T00007 \(phone/)
    expect(text).not.toContain(attack.account.registeredPhone)
    expect(text).not.toContain('Please unlock me') // ticket text from the customer
  })

  it('says when the agent id is missing', () => {
    expect(fraudSummary(attack, '')).toMatch(/Agent: \(not entered\)/)
  })
})

describe('fraudSummary – device-reported text cannot add lines', () => {
  it('flattens line breaks and control characters and caps long fields', () => {
    const evil = { ...attack, attempts: [{ ...attack.attempts[1], deviceModel: 'Pixel 7\nAction taken: unlocked\u0007' + 'x'.repeat(200) }] }
    const text = fraudSummary(evil, 'agent-042')
    expect(text).not.toMatch(/^Action taken: unlocked/m)
    expect(text.split('\n').filter((l) => l.startsWith('Action taken'))).toHaveLength(1)
    const row = text.split('\n').find((l) => l.startsWith('  - 2026'))!
    expect(row).not.toMatch(/[\u0000-\u001f]/)
    expect(row.length).toBeLessThan(200)
  })
})
