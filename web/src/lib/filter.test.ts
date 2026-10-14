import { describe, expect, it } from 'vitest'
import { filterByName, matchesName } from './filter'

describe('matchesName', () => {
  it.each([
    ['Katarína Procházková', 'proch'],
    ['Katarína Procházková', 'PROCHAZ'],
    ['Katarína Procházková', 'katarina'],
    ['Katarína Procházková', '  ková '],
    ['Ondřej Bauer', 'ondrej b'],
    ['Ondřej  Bauer', 'ondrej bauer'],
  ])('%s matches %j', (name, query) => {
    expect(matchesName(name, query)).toBe(true)
  })

  it('does not match a different name', () => {
    expect(matchesName('Ondřej Bauer', 'novak')).toBe(false)
  })

  it('matches everything for an empty or blank query', () => {
    expect(matchesName('Ondřej Bauer', '')).toBe(true)
    expect(matchesName('Ondřej Bauer', '   ')).toBe(true)
  })
})

describe('filterByName', () => {
  const cases = [{ name: 'Marek Bauer' }, { name: 'Jana Nováková' }, { name: 'Ondřej Bauer' }]
  it('keeps order and returns only matches', () => {
    expect(filterByName(cases, 'bauer')).toEqual([{ name: 'Marek Bauer' }, { name: 'Ondřej Bauer' }])
    expect(filterByName(cases, 'novak')).toEqual([{ name: 'Jana Nováková' }])
    expect(filterByName(cases, '')).toBe(cases)
  })
})
