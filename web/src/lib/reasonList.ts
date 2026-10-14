export type ReasonOption = { text: string; source: 'team' | 'saved'; count?: number }

/** Team reasons first (most used first), then the agent's saved ones; the first `top` become chips, the rest go in a dropdown. */
export function splitReasons(saved: string[], team: { text: string; count: number }[], top = 3) {
  const seen = new Set<string>()
  const all: ReasonOption[] = []
  for (const t of [...team].sort((a, b) => b.count - a.count)) {
    if (seen.has(t.text.toLowerCase())) continue
    seen.add(t.text.toLowerCase())
    all.push({ text: t.text, source: 'team', count: t.count })
  }
  for (const text of saved) {
    if (seen.has(text.toLowerCase())) continue
    seen.add(text.toLowerCase())
    all.push({ text, source: 'saved' })
  }
  return { chips: all.slice(0, top), more: all.slice(top) }
}
