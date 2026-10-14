import { describe, expect, it } from 'vitest'
import { loadReasons, saveReason } from './savedReasons'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size
    },
  }
}

describe('saved reasons (this browser only)', () => {
  it('saves a tidied reason, newest first, without duplicates', () => {
    const s = memoryStorage()
    saveReason('  Camera did not  find face ', s)
    saveReason('Poor light; verified by SMS', s)
    saveReason('camera did not find face', s)
    expect(loadReasons(s)).toEqual(['camera did not find face', 'Poor light; verified by SMS'])
  })

  it('refuses too short or too long text', () => {
    const s = memoryStorage()
    expect(saveReason('ok', s)).toBe(false)
    expect(saveReason('x'.repeat(501), s)).toBe(false)
    expect(loadReasons(s)).toEqual([])
  })

  it('keeps at most 10', () => {
    const s = memoryStorage()
    for (let i = 0; i < 12; i++) saveReason(`Reason number ${i}`, s)
    expect(loadReasons(s)).toHaveLength(10)
    expect(loadReasons(s)[0]).toBe('Reason number 11')
  })

  it('survives broken or blocked storage', () => {
    const s = memoryStorage()
    s.setItem('lockout-desk.savedReasons', '{not json')
    expect(loadReasons(s)).toEqual([])
    const blocked = { ...memoryStorage(), getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(loadReasons(blocked as Storage)).toEqual([])
    expect(saveReason('Valid reason text', blocked as Storage)).toBe(false)
  })
})

describe('saved reasons – no personal data (security review N14)', () => {
  it.each(['Mrs Novakova seen at branch', 'Called back on 0905123456', 'Sent to jana@example.com', 'Verified LB-000052 by SMS'])(
    'refuses %j',
    (text) => {
      const s = memoryStorage()
      expect(saveReason(text, s)).toBe(false)
      expect(loadReasons(s)).toEqual([])
    },
  )
})
