import { describe, expect, it } from 'vitest'
import { splitReasons } from './reasonList'

describe('splitReasons – top 3 as chips, the rest in a dropdown', () => {
  const team = [
    { text: 'Camera did not find face; verified', count: 5 },
    { text: 'Poor light; verified', count: 3 },
  ]
  it('ranks team reasons by use, then saved ones, and keeps 3 as chips', () => {
    const r = splitReasons(['My saved one', 'Another saved one'], team, 3)
    expect(r.chips.map((c) => c.text)).toEqual(['Camera did not find face; verified', 'Poor light; verified', 'My saved one'])
    expect(r.more.map((c) => c.text)).toEqual(['Another saved one'])
  })
  it('shows no duplicates (case-insensitive) and marks the source', () => {
    const r = splitReasons(['poor light; VERIFIED'], team, 3)
    expect(r.chips).toHaveLength(2)
    expect(r.chips[1]).toEqual({ text: 'Poor light; verified', source: 'team', count: 3 })
    expect(r.more).toEqual([])
  })
  it('handles nothing to show', () => {
    expect(splitReasons([], [], 3)).toEqual({ chips: [], more: [] })
  })
})
