import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bookmark, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { loadReasons, saveReason } from '@/lib/savedReasons'

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
  const savedSet = new Set(saved.map((r) => r.toLowerCase()))
  // Only wording the team used with the same verification method, so an SMS reason is never offered for a branch visit.
  const team = top.filter((t) => t.verification === method && !savedSet.has(t.text.toLowerCase()))

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
      {(saved.length > 0 || team.length > 0) && (
        <div className="flex flex-wrap gap-1.5" aria-label="Reason suggestions">
          {saved.map((r) => chip(r, <Bookmark aria-hidden />, `Your saved reason – click to use, then edit:\n${r}`))}
          {team.map((t) => chip(t.text, <Users aria-hidden />, `Used for ${t.count} customers by the team – click to use, then edit:\n${t.text}`))}
        </div>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={save}>
        <Bookmark aria-hidden /> Save reason
      </Button>
    </div>
  )
}
