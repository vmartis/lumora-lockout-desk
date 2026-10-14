import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { Inbox } from 'lucide-react'
import { RiskBadge } from '@/components/RiskBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, formatTime, type CaseSummary } from '@/lib/api'

export function QueuePage() {
  const navigate = useNavigate()
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['cases'],
    queryFn: () => api<CaseSummary[]>('/cases'),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Locked accounts</CardTitle>
        <CardDescription>Customers with an open ticket who are locked out, longest wait first.</CardDescription>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Waiting since</TableHead>
                <TableHead>Locked at</TableHead>
                <TableHead>Tickets</TableHead>
                <TableHead>Verdict</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow
                  key={c.accountId}
                  className="cursor-pointer"
                  tabIndex={0}
                  onClick={() => navigate(`/cases/${c.accountId}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/cases/${c.accountId}`)}
                >
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.accountId}</div>
                  </TableCell>
                  <TableCell>{formatTime(c.waitingSince)}</TableCell>
                  <TableCell>{formatTime(c.lockedAt)}</TableCell>
                  <TableCell>
                    {c.ticketCount} · {c.channels.join(', ')}
                  </TableCell>
                  <TableCell>
                    <RiskBadge risk={c.risk} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
