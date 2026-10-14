/** Lower case, accents removed ("Procházková" -> "prochazkova"), spaces collapsed. */
const fold = (text: string) =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()

export function matchesName(name: string, query: string): boolean {
  const q = fold(query)
  return q === '' || fold(name).includes(q)
}

export function filterByName<T extends { name: string }>(items: T[], query: string): T[] {
  return fold(query) === '' ? items : items.filter((i) => matchesName(i.name, query))
}

// Tickets and callers use "LB-000083", "83" or "000083" for the same customer.
const CUSTOMER_NUMBER = /^(?:lb[\s-]?)?(\d{1,6})$/i

export const looksLikeCustomerNumber = (query: string) => CUSTOMER_NUMBER.test(query.trim())

/** Name (case/accent-insensitive, part of it) or the exact customer number. */
export function matchesCase(c: { name: string; accountId: string }, query: string): boolean {
  const n = CUSTOMER_NUMBER.exec(query.trim())
  if (n) {
    const id = CUSTOMER_NUMBER.exec(c.accountId)
    return id !== null && Number(id[1]) === Number(n[1])
  }
  return matchesName(c.name, query)
}

export function filterCases<T extends { name: string; accountId: string }>(items: T[], query: string): T[] {
  return query.trim() === '' ? items : items.filter((i) => matchesCase(i, query))
}

/** "83", "LB 52", "lb-000118" -> "LB-000083" style account id; null when it is not a customer number. */
export function toAccountId(query: string): string | null {
  const n = CUSTOMER_NUMBER.exec(query.trim())
  return n ? `LB-${n[1].padStart(6, '0')}` : null
}
