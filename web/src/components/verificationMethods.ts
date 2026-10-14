// Verification methods from the unlock policy (§2). The server decides which ones a case allows.
export type Verification = 'SMS_CHALLENGE' | 'VIDEO_CALL' | 'BRANCH'

export interface MethodOption {
  value: Verification
  label: string
  /** What the agent confirms for a method we only record (no system to check it). */
  confirm?: string
  reasonExample: string
}

const METHODS: MethodOption[] = [
  {
    value: 'SMS_CHALLENGE',
    label: 'SMS code (phone or chat)',
    reasonExample: 'e.g. Camera did not find the face (poor light); verified by SMS code',
  },
  {
    value: 'VIDEO_CALL',
    label: 'Video call with ID document',
    confirm: 'I compared the customer with their ID document on a video call',
    reasonExample: 'e.g. Camera did not find the face (poor light); verified on a video call with passport',
  },
  {
    value: 'BRANCH',
    label: 'Branch visit',
    confirm: 'The customer was identified in person at a branch',
    reasonExample: 'e.g. Camera did not find the face (poor light); identified in person at the branch',
  },
]

export const SMS_NOT_ALLOWED_NOTE = 'Customer wrote by email: SMS codes are only for phone or chat'

export const methodOptions = (allowed: string[]): MethodOption[] => METHODS.filter((m) => allowed.includes(m.value))

export function canUnlock(s: {
  method: Verification | null
  agentOk: boolean
  smsVerified: boolean
  confirmed: boolean
}): boolean {
  if (!s.agentOk || !s.method) return false
  return s.method === 'SMS_CHALLENGE' ? s.smsVerified : s.confirmed
}
