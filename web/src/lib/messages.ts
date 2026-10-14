import type { CaseDetail } from '@/lib/api'

const NEVER_ASK = 'We will never ask you for your password or full card number.'

const CAMERA_TIPS = [
  'Use good light, for example face a window or a lamp.',
  'Hold the phone at eye level.',
  'Keep your whole face inside the frame.',
]
const MATCH_TIPS = ['Take off glasses or a hat.', 'Look straight at the camera.']
const UPDATE_TIP = 'Update the Lumora app to the latest version.'

/**
 * Ready-to-copy message for the customer (unlock policy rules 3 and 4).
 * Uses only the first name; never includes account id, phone, country, device or scores.
 */
export function customerMessage(detail: CaseDetail): string {
  const firstName = detail.account.fullName.trim().split(/\s+/)[0] || 'there'
  const greeting = `Hi ${firstName},`

  if (detail.verdict.kind === 'ATTACK') {
    return [
      greeting,
      'We are protecting your account. We noticed some login activity that we want to check, so our security team is reviewing your account now.',
      'We will contact you as soon as the review is done. You do not need to do anything right now.',
      NEVER_ASK,
      'Thank you for your patience.',
    ].join('\n\n')
  }

  const reasons = new Set(detail.attempts.filter((a) => a.result === 'FAIL').map((a) => a.failReason))
  const camera = reasons.has('NO_FACE_DETECTED') || reasons.has('POOR_LIGHT')
  const match = reasons.has('LOW_MATCH')
  // Policy rule 4 tips are the default when the fail reason is unknown.
  const tips = [...(camera || !match ? CAMERA_TIPS : []), ...(match ? MATCH_TIPS : []), UPDATE_TIP]

  const status =
    detail.account.status === 'ACTIVE'
      ? 'Your account is unlocked now, and you can log in again.'
      : 'We will unlock it once we have verified it is you.'

  return [
    greeting,
    `Your account was locked for your safety after several face-login attempts did not work. ${status}`,
    `Next time, these tips help the face login work:\n${tips.map((t) => `- ${t}`).join('\n')}`,
    'Thank you, and sorry for the trouble.',
  ].join('\n\n')
}
