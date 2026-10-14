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
