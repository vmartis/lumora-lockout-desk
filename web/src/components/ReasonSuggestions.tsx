import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bookmark, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { splitReasons } from '@/lib/reasonList'
import { loadReasons, saveReason } from '@/lib/savedReasons'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Top = { text: string; count: number; verification: string }[]

/** Chips that fill the reason box (still editable) and a button to save the current reason in this browser. */
export function ReasonSuggestions({
  current,
  method,
  onPick,
}: {
  current: string
  method: string | null
  onPick: (text: string) => void
}) {
  const [saved, setSaved] = useState(() => loadReasons())
  const { data: top = [] } = useQuery({ queryKey: ['reasons-top'], queryFn: () => api<Top>('/reasons/top') })
  // Only wording the team used with the same verification method, so an SMS reason is never offered for a branch visit.
  const team = top.filter((t) => t.verification === method)
  // Friction fix: only the 3 most used as chips; everything else in a dropdown so the row stays short.
  const { chips, more } = splitReasons(saved, team, 3)

  const save = () => {
    if (saveReason(current)) {
      setSaved(loadReasons())
      toast.success('Reason saved in this browser')
    } else {
      toast.error('Not saved: write 5 to 500 characters, without names, numbers, account IDs or e-mail')
    }
  }

  const chip = (text: string, icon: React.ReactNode, title: string) => (
    <Badge
      key={text}
      asChild
      variant="outline"
      className="max-w-full cursor-pointer truncate font-normal hover:bg-muted"
    >
      <button type="button" title={title} onClick={() => onPick(text)}>
        {icon}
        <span className="truncate">{text}</span>
      </button>
    </Badge>
  )

  return (
    <div className="space-y-1.5">
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Most used reasons">
          {chips.map((c) =>
            c.source === 'team'
              ? chip(c.text, <Users aria-hidden />, `Used for ${c.count} customers by the team – click to use, then edit:\n${c.text}`)
              : chip(c.text, <Bookmark aria-hidden />, `Your saved reason – click to use, then edit:\n${c.text}`),
          )}
          {more.length > 0 && (
            <Select value="" onValueChange={(text) => onPick(text)}>
              <SelectTrigger size="sm" className="h-6 w-auto text-xs" aria-label="More reasons">
                <SelectValue placeholder={`More reasons (${more.length})…`} />
              </SelectTrigger>
              <SelectContent className="max-w-md">
                {more.map((m) => (
                  <SelectItem key={m.text} value={m.text} title={m.text}>
                    <span className="truncate">{m.source === 'team' ? '👥 ' : '🔖 '}{m.text}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={save}>
        <Bookmark aria-hidden /> Save reason
      </Button>
    </div>
  )
}
