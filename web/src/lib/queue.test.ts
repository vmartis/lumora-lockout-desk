import { describe, expect, it } from 'vitest'
import type { CaseSummary } from './api'
import { summarize, waitingFor } from './queue'

const now = new Date('2026-10-14T12:00:00Z')
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('waitingFor', () => {
  it('says "just now" under one minute', () => {
    expect(waitingFor(ago(0), now)).toBe('just now')
    expect(waitingFor(ago(59 * SEC), now)).toBe('just now')
  })

  it('never goes negative: a future time is "just now"', () => {
    expect(waitingFor(ago(-5 * MIN), now)).toBe('just now')
  })

  it('shows minutes from 1 to 59', () => {
    expect(waitingFor(ago(1 * MIN), now)).toBe('1 min')
    expect(waitingFor(ago(45 * MIN + 30 * SEC), now)).toBe('45 min')
    expect(waitingFor(ago(59 * MIN + 59 * SEC), now)).toBe('59 min')
  })

  it('shows hours and minutes from 1 h to under 1 day', () => {
    expect(waitingFor(ago(1 * HOUR), now)).toBe('1 h')
    expect(waitingFor(ago(3 * HOUR + 20 * MIN), now)).toBe('3 h 20 min')
    expect(waitingFor(ago(23 * HOUR + 59 * MIN), now)).toBe('23 h 59 min')
  })

  it('shows days and hours from 1 day', () => {
    expect(waitingFor(ago(1 * DAY), now)).toBe('1 d')
    expect(waitingFor(ago(2 * DAY + 4 * HOUR + 30 * MIN), now)).toBe('2 d 4 h')
    expect(waitingFor(ago(40 * DAY + 23 * HOUR), now)).toBe('40 d 23 h')
  })

  it('returns "–" for an unparseable date instead of "NaN"', () => {
    expect(waitingFor('not a date', now)).toBe('–')
  })
})

const c = (accountId: string, risk: CaseSummary['risk']): CaseSummary => ({
  accountId,
  name: accountId,
  lockedAt: null,
  waitingSince: '2026-10-14T10:00:00Z',
  channels: ['chat'],
  ticketCount: 1,
  risk,
})

describe('summarize', () => {
  it('counts zero for an empty queue', () => {
    expect(summarize([])).toEqual({ total: 0, attacks: 0, camera: 0 })
  })

  it('counts total, attacks and camera problems', () => {
    const cases = [c('A', 'ATTACK'), c('B', 'FUMBLE'), c('C', 'FUMBLE'), c('D', 'ATTACK'), c('E', 'FUMBLE')]
    expect(summarize(cases)).toEqual({ total: 5, attacks: 2, camera: 3 })
  })
})
