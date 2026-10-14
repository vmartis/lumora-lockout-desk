import { describe, expect, it } from 'vitest'
import type { Attempt, CaseDetail } from './api'
import { customerMessage } from './messages'

const attempt = (over: Partial<Attempt>): Attempt => ({
  attemptId: 'A1',
  timestamp: '2026-10-14T10:00:00Z',
  deviceModel: 'Pixel 8',
  deviceTrusted: true,
  appVersion: '4.2.0',
  country: 'SK',
  livenessScore: '0.9',
  matchScore: '0.5',
  result: 'FAIL',
  failReason: 'NO_FACE_DETECTED',
  ...over,
})

type Over = {
  status?: 'LOCKED' | 'ACTIVE'
  attempts?: Attempt[]
  verdict?: CaseDetail['verdict']
  appUpdate?: CaseDetail['appUpdate']
}

const detail = (over: Over = {}): CaseDetail => ({
  account: {
    accountId: 'LB-000083',
    fullName: 'Jana Novakova',
    country: 'SK',
    status: over.status ?? 'LOCKED',
    lockedAt: '2026-10-14T10:05:00Z',
    registeredPhone: '+421 *** *** 123',
    lastAppVersion: '4.2.0',
  },
  tickets: [],
  attempts: over.attempts ?? [attempt({}), attempt({ attemptId: 'A2', failReason: 'POOR_LIGHT' })],
  verdict: over.verdict ?? { kind: 'FUMBLE', reasons: ['5 failed attempts'] },
  allowedVerifications: ['SMS_CHALLENGE'],
  appUpdate: over.appUpdate ?? null,
  audit: [],
})

describe('customerMessage – fumble', () => {
  it('gives light and eye-level tips for NO_FACE_DETECTED, plus update-app tip', () => {
    const msg = customerMessage(detail({ attempts: [attempt({ failReason: 'NO_FACE_DETECTED' })] }))
    expect(msg).toMatch(/light/i)
    expect(msg).toMatch(/eye level/i)
    expect(msg).toMatch(/frame/i)
    expect(msg).toMatch(/update the Lumora app/i)
    expect(msg).toContain('Jana')
    expect(msg).not.toContain('Novakova')
    expect(msg).not.toContain('LB-000083')
    expect(msg).not.toContain('123')
    expect(msg).not.toMatch(/\bSK\b/)
  })

  it('gives the glasses tip for LOW_MATCH', () => {
    const msg = customerMessage(detail({ attempts: [attempt({ failReason: 'LOW_MATCH' })] }))
    expect(msg).toMatch(/glasses/i)
    expect(msg).toMatch(/straight at the camera/i)
    expect(msg).not.toMatch(/eye level/i)
    expect(msg).toMatch(/update the Lumora app/i)
  })

  it('ignores fail reasons of successful attempts', () => {
    const msg = customerMessage(
      detail({
        attempts: [attempt({ failReason: 'LOW_MATCH' }), attempt({ result: 'SUCCESS', failReason: 'POOR_LIGHT' })],
      }),
    )
    expect(msg).not.toMatch(/eye level/i)
  })

  it('says the account is unlocked now when ACTIVE', () => {
    const msg = customerMessage(detail({ status: 'ACTIVE' }))
    expect(msg).toMatch(/unlocked now/i)
    expect(msg).not.toMatch(/once we have verified/i)
  })

  it('says we will unlock after verification when LOCKED', () => {
    const msg = customerMessage(detail({ status: 'LOCKED' }))
    expect(msg).toMatch(/unlock it once we have verified it is you/i)
    expect(msg).not.toMatch(/unlocked now/i)
  })
})

describe('customerMessage – attack', () => {
  const attack = detail({
    verdict: { kind: 'ATTACK', reasons: ['Failed attempt(s) from RU, BR; customer lives in SK'] },
    attempts: [
      attempt({
        country: 'RU',
        deviceModel: 'Xiaomi Redmi Note 12',
        deviceTrusted: false,
        failReason: 'LIVENESS_FAIL',
        livenessScore: '0.12',
      }),
      attempt({ attemptId: 'A2', country: 'BR', deviceModel: 'Xiaomi Redmi Note 12', deviceTrusted: false }),
    ],
  })

  it('says we are protecting the account without revealing detection details', () => {
    const msg = customerMessage(attack)
    expect(msg).toMatch(/protecting/i)
    expect(msg).not.toMatch(/noticed|suspicious|activity|security team/i)
    expect(msg).toMatch(/extra check/i)
    expect(msg).toMatch(/contact you/i)
    expect(msg).toContain('We will never ask you for your password or full card number.')
    expect(msg).toContain('Jana')
    for (const leak of ['RU', 'BR', 'SK', 'Xiaomi', 'Redmi', '0.12', 'liveness', 'LB-000083']) {
      expect(msg).not.toContain(leak)
    }
  })

  it('does not give unlock or camera tips for an attack', () => {
    const msg = customerMessage(attack)
    expect(msg).not.toMatch(/unlock/i)
    expect(msg).not.toMatch(/eye level/i)
  })
})

describe('customerMessage – outdated app (N1)', () => {
  const outdated = { current: '4.2.0', latest: '4.3.1' }

  it('puts the update tip first and names both versions', () => {
    const msg = customerMessage(detail({ appUpdate: outdated }))
    const tips = msg.split('\n').filter((l) => l.startsWith('- '))
    expect(tips[0]).toMatch(/4\.2\.0/)
    expect(tips[0]).toMatch(/4\.3\.1/)
  })

  it('keeps the generic update tip last when the app is current', () => {
    const tips = customerMessage(detail()).split('\n').filter((l) => l.startsWith('- '))
    expect(tips[tips.length - 1]).toMatch(/update the lumora app/i)
    expect(tips.join(' ')).not.toMatch(/4\.2\.0/)
  })

  it('never mentions versions in an attack message', () => {
    const msg = customerMessage(detail({ appUpdate: outdated, verdict: { kind: 'ATTACK', reasons: ['x'] } }))
    expect(msg).not.toMatch(/4\.2\.0|update/i)
  })
})
