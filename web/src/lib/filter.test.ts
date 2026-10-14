import { describe, expect, it } from 'vitest'
import { filterByName, filterCases, looksLikeCustomerNumber, matchesCase, matchesName, toAccountId } from './filter'

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

describe('matchesCase – name or customer number (N2)', () => {
  const c = { name: 'Jana Bauer', accountId: 'LB-000083' }
  it.each(['83', '000083', 'LB-000083', 'lb-000083', 'LB83', ' 83 ', 'bauer'])('finds LB-000083 by %j', (q) => {
    expect(matchesCase(c, q)).toBe(true)
  })
  it.each(['183', '8', 'LB-000084', '830'])('does not find LB-000083 by %j', (q) => {
    expect(matchesCase(c, q)).toBe(false)
  })
  it('recognises a number query', () => {
    expect(looksLikeCustomerNumber('LB-000083')).toBe(true)
    expect(looksLikeCustomerNumber('83')).toBe(true)
    expect(looksLikeCustomerNumber('bauer')).toBe(false)
  })
  it('filters a list by number', () => {
    const list = [c, { name: 'Eva Hruska', accountId: 'LB-000183' }]
    expect(filterCases(list, '83')).toEqual([c])
    expect(filterCases(list, '')).toBe(list)
  })
})

describe('toAccountId (N2 review)', () => {
  it.each([
    ['83', 'LB-000083'],
    ['LB 52', 'LB-000052'],
    ['lb-000118', 'LB-000118'],
  ])('%j -> %s', (q, id) => expect(toAccountId(q)).toBe(id))
  it.each(['bauer', '', '1234567'])('%j -> null', (q) => expect(toAccountId(q)).toBeNull())
})
