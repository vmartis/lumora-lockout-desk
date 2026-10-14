// Reasons an agent saved for reuse. Kept in this browser only (no login, no database yet; see N12).
const KEY = 'lockout-desk.savedReasons'
const MAX = 10

const tidy = (text: string) => text.trim().replace(/\s+/g, ' ')

/** Same cheap check as the server: numbers of 4+ digits, account ids, e-mail, titles before a name. */
export const mayHoldPersonalData = (text: string) => /\d{4,}|\bLB-?\d|@|\b(mr|mrs|ms|miss|dr)\b\.?/i.test(text)

const defaultStorage = (): Storage | undefined => {
  try {
    return localStorage
  } catch {
    return undefined
  }
}

export function loadReasons(storage = defaultStorage()): string[] {
  try {
    const list: unknown = JSON.parse(storage?.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((r): r is string => typeof r === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

/** Saves the reason first in the list (same text, ignoring case, only once). False if not saved. */
export function saveReason(text: string, storage = defaultStorage()): boolean {
  const reason = tidy(text)
  if (reason.length < 5 || reason.length > 500 || mayHoldPersonalData(reason) || !storage) return false
  const rest = loadReasons(storage).filter((r) => r.toLowerCase() !== reason.toLowerCase())
  try {
    storage.setItem(KEY, JSON.stringify([reason, ...rest].slice(0, MAX)))
    return true
  } catch {
    return false
  }
}
