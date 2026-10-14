import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { ArrowLeft, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { CustomerMessage } from '@/components/CustomerMessage'
import { RiskBadge } from '@/components/RiskBadge'
import { UnlockPanel } from '@/components/UnlockPanel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, formatTime, type CaseDetail } from '@/lib/api'

export function CasePage() {
  const { accountId = '' } = useParams()
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['case', accountId],
    queryFn: () => api<CaseDetail>(`/cases/${encodeURIComponent(accountId)}`),
  })

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/">
          <ArrowLeft aria-hidden /> Back to queue
        </Link>
      </Button>

      {isPending && <Skeleton className="h-64 w-full" />}
      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load this case</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-3">
                {data.account.fullName}
                <span className="text-sm font-normal text-muted-foreground">{data.account.accountId}</span>
                <Badge variant={data.account.status === 'LOCKED' ? 'outline' : 'secondary'}>{data.account.status}</Badge>
              </CardTitle>
              <CardDescription>
                Lives in {data.account.country} · phone {data.account.registeredPhone} · app {data.account.lastAppVersion}
                {data.account.lockedAt && <> · locked {formatTime(data.account.lockedAt)}</>}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Verdict:</span>
                <RiskBadge risk={data.verdict.kind} />
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {data.verdict.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {data.account.status === 'ACTIVE' ? (
            <Alert>
              <CheckCircle2 aria-hidden />
              <AlertTitle>This account is not locked</AlertTitle>
              <AlertDescription>Nothing to unlock. The customer can log in again.</AlertDescription>
            </Alert>
          ) : data.verdict.kind === 'ATTACK' ? (
            <Alert variant="destructive">
              <ShieldAlert aria-hidden />
              <AlertTitle>Do not unlock. Escalate to the Fraud team.</AlertTitle>
              <AlertDescription>
                Tell the customer we are protecting their account. Unlocking is blocked in this tool for this case.
              </AlertDescription>
            </Alert>
          ) : (
            <UnlockPanel
              accountId={data.account.accountId}
              phone={data.account.registeredPhone}
              allowedVerifications={data.allowedVerifications}
            />
          )}

          <CustomerMessage detail={data} />

          <Card>
            <CardHeader>
              <CardTitle>Tickets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.tickets.length === 0 && <p className="text-muted-foreground">No open ticket.</p>}
              {data.tickets.map((t) => (
                <div key={t.ticketId} className="rounded-md border p-3">
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t.ticketId} · {t.channel} · {formatTime(t.createdAt)} · {t.status}
                  </div>
                  {t.text}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Login attempts</CardTitle>
              <CardDescription>Most recent first, up to 50.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Liveness</TableHead>
                    <TableHead>App</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attempts.map((a) => (
                    <TableRow key={a.attemptId}>
                      <TableCell className="whitespace-nowrap">{a.timestamp}</TableCell>
                      <TableCell>{a.result === 'SUCCESS' ? 'Success' : a.failReason || 'Fail'}</TableCell>
                      <TableCell>
                        {a.deviceModel} {a.deviceTrusted ? '' : <Badge variant="destructive">untrusted</Badge>}
                      </TableCell>
                      <TableCell>{a.country}</TableCell>
                      <TableCell>{a.livenessScore}</TableCell>
                      <TableCell>{a.appVersion}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
