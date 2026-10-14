import { describe, expect, it } from 'vitest'
import { canUnlock, methodOptions, SMS_NOT_ALLOWED_NOTE } from './verificationMethods'

describe('methodOptions', () => {
  it('shows only the allowed methods, with plain labels, in policy order', () => {
    expect(methodOptions(['BRANCH', 'SMS_CHALLENGE', 'VIDEO_CALL']).map((m) => m.label)).toEqual([
      'SMS code (phone or chat)',
      'Video call with ID document',
      'Branch visit',
    ])
  })

  it('leaves SMS out for an email-only customer', () => {
    expect(methodOptions(['VIDEO_CALL', 'BRANCH']).map((m) => m.value)).toEqual(['VIDEO_CALL', 'BRANCH'])
  })

  it('ignores unknown methods and returns nothing for an attack case', () => {
    expect(methodOptions(['TRUST_ME'])).toEqual([])
    expect(methodOptions([])).toEqual([])
  })

  it('gives each recorded method its own check sentence', () => {
    const [video, branch] = methodOptions(['VIDEO_CALL', 'BRANCH'])
    expect(video.confirm).toBe('I compared the customer with their ID document on a video call')
    expect(branch.confirm).toBe('The customer was identified in person at a branch')
  })

  it('explains why SMS is missing', () => {
    expect(SMS_NOT_ALLOWED_NOTE).toBe('Customer did not contact us by phone or chat: SMS codes are only for those channels')
  })
})

describe('canUnlock', () => {
  const base = { agentOk: true, smsVerified: false, confirmed: false }

  it('needs a verified SMS code for SMS', () => {
    expect(canUnlock({ ...base, method: 'SMS_CHALLENGE' })).toBe(false)
    expect(canUnlock({ ...base, method: 'SMS_CHALLENGE', confirmed: true })).toBe(false)
    expect(canUnlock({ ...base, method: 'SMS_CHALLENGE', smsVerified: true })).toBe(true)
  })

  it.each(['VIDEO_CALL', 'BRANCH'] as const)('needs the check box ticked for %s', (method) => {
    expect(canUnlock({ ...base, method })).toBe(false)
    expect(canUnlock({ ...base, method, smsVerified: true })).toBe(false)
    expect(canUnlock({ ...base, method, confirmed: true })).toBe(true)
  })

  it('needs a valid agent ID and a chosen method', () => {
    expect(canUnlock({ ...base, method: 'VIDEO_CALL', confirmed: true, agentOk: false })).toBe(false)
    expect(canUnlock({ ...base, method: null, confirmed: true, smsVerified: true })).toBe(false)
  })
})
