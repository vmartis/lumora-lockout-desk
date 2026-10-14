import type { CaseSummary } from './api'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const pair = (big: number, bigUnit: string, small: number, smallUnit: string) =>
  small > 0 ? `${big} ${bigUnit} ${small} ${smallUnit}` : `${big} ${bigUnit}`

/** Short plain text for how long someone has waited, e.g. "45 min", "3 h 20 min", "2 d 4 h". */
export function waitingFor(sinceIso: string, now: Date): string {
  const since = new Date(sinceIso).getTime()
  if (Number.isNaN(since)) return '–'
  const ms = Math.max(0, now.getTime() - since)
  if (ms < MIN) return 'just now'
  if (ms < HOUR) return `${Math.floor(ms / MIN)} min`
  if (ms < DAY) return pair(Math.floor(ms / HOUR), 'h', Math.floor((ms % HOUR) / MIN), 'min')
  return pair(Math.floor(ms / DAY), 'd', Math.floor((ms % DAY) / HOUR), 'h')
}

export function summarize(cases: CaseSummary[]): { total: number; attacks: number; camera: number } {
  const attacks = cases.filter((c) => c.risk === 'ATTACK').length
  return { total: cases.length, attacks, camera: cases.length - attacks }
}
