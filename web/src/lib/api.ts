export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`)
  return body as T
}

export type Health = { status: 'UP'; adminApi: 'UP' | 'DOWN' }

export type Risk = 'ATTACK' | 'FUMBLE'

export type CaseSummary = {
  accountId: string
  name: string
  lockedAt: string | null
  waitingSince: string
  channels: string[]
  ticketCount: number
  risk: Risk
}

export type Ticket = { ticketId: string; createdAt: string; channel: string; status: string; text: string }

export type Attempt = {
  attemptId: string
  timestamp: string
  deviceModel: string
  deviceTrusted: boolean
  appVersion: string
  country: string
  livenessScore: string
  matchScore: string
  result: string
  failReason: string
}

export type CaseDetail = {
  account: {
    accountId: string
    fullName: string
    country: string
    status: 'LOCKED' | 'ACTIVE'
    lockedAt: string | null
    registeredPhone: string
    lastAppVersion: string
  }
  tickets: Ticket[]
  attempts: Attempt[]
  verdict: { kind: Risk; reasons: string[] }
  allowedVerifications: string[]
  /** Set when the customer's app is older than the latest release (failures on 4.2.0 are much higher). */
  appUpdate: { current: string; latest: string } | null
}

export const formatTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '–'
