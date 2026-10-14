import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { Inbox, Mail, Search, X, MessageSquare, Phone, RefreshCw, type LucideIcon } from 'lucide-react'
import { RiskBadge } from '@/components/RiskBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, formatTime, type CaseSummary } from '@/lib/api'
import { filterByName } from '@/lib/filter'
import { summarize, waitingFor } from '@/lib/queue'
import { cn } from '@/lib/utils'

const CHANNEL_ICONS: Record<string, LucideIcon> = { phone: Phone, chat: MessageSquare, email: Mail }

function ChannelBadge({ channel }: { channel: string }) {
  const Icon = CHANNEL_ICONS[channel.toLowerCase()]
  return (
    <Badge variant="outline" className="capitalize">
      {Icon && <Icon aria-hidden />}
      {channel}
    </Badge>
  )
}

/** Current time, refreshed every minute so "waiting" texts stay fresh. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function QueuePage() {
  const navigate = useNavigate()
  const now = useNow()
  const { data, isPending, isError, error, isFetching, refetch } = useQuery({
    queryKey: ['cases'],
    queryFn: () => api<CaseSummary[]>('/cases'),
  })
  const counts = data ? summarize(data) : null
  // Kept in the URL (?q=) and handed to the case page, so "Back to queue" and browser Back keep the filter.
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true })
  const visible = data ? filterByName(data, query) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Locked accounts</CardTitle>
        <CardDescription>Customers with an open ticket who are locked out, longest wait first.</CardDescription>
        {counts && counts.total > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Queue summary">
            <Badge variant="secondary">{counts.total} waiting</Badge>
            <Badge variant={counts.attacks > 0 ? 'destructive' : 'outline'}>{counts.attacks} {counts.attacks === 1 ? 'attack' : 'attacks'}</Badge>
            <Badge variant="outline">{counts.camera} camera</Badge>
          </div>
        )}
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn(isFetching && 'animate-spin')} aria-hidden />
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isPending && (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        )}
        {isError && (
          <Alert variant="destructive">
            <AlertTitle>Could not load the queue</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        {data && data.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <Inbox className="size-8" aria-hidden />
            <p>No locked customers are waiting. Nice work.</p>
          </div>
        )}
        {data && data.length > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by customer name"
                aria-label="Filter by customer name"
                maxLength={100}
                className="pl-8"
              />
            </div>
            {query.trim() !== '' && (
              <span className="text-sm text-muted-foreground">
                {visible.length} of {data.length} shown
              </span>
            )}
          </div>
        )}
        {data && data.length > 0 && visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <Search className="size-8" aria-hidden />
            <p>No locked customer matches “{query.trim()}”.</p>
            <Button variant="outline" size="sm" onClick={() => setQuery('')}>
              <X aria-hidden /> Clear filter
            </Button>
          </div>
        )}
        {visible.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Waiting</TableHead>
                <TableHead>Locked at</TableHead>
                <TableHead>Tickets</TableHead>
                <TableHead>Verdict</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => {
                const attack = c.risk === 'ATTACK'
                return (
                  <TableRow
                    key={c.accountId}
                    className={cn(
                      'cursor-pointer border-l-2 border-l-transparent',
                      attack && 'border-l-destructive bg-destructive/5 hover:bg-destructive/10',
                    )}
                    tabIndex={0}
                    aria-label={`Open case for ${c.name}`}
                    onClick={() => navigate(`/cases/${c.accountId}`, { state: { queueSearch: params.toString() } })}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/cases/${c.accountId}`, { state: { queueSearch: params.toString() } })}
                  >
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.accountId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold">{waitingFor(c.waitingSince, now)}</div>
                      <div className="text-xs text-muted-foreground">{formatTime(c.waitingSince)}</div>
                    </TableCell>
                    <TableCell>{formatTime(c.lockedAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="tabular-nums">{c.ticketCount}</span>
                        {c.channels.map((ch) => (
                          <ChannelBadge key={ch} channel={ch} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <RiskBadge risk={c.risk} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
