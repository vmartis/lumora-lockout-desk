import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'

type Summary = {
  waiting: { total: number; attacks: number; camera: number }
  causes: { cause: string; failures: number }[]
  appVersions: { version: string; lockedCustomers: number; attempts: number; failures: number; failureRate: number }[]
}

const CAUSE_WORDS: Record<string, string> = {
  NO_FACE_DETECTED: 'Camera did not find a face',
  POOR_LIGHT: 'Poor light',
  LOW_MATCH: 'Face did not match well enough',
  TIMEOUT: 'Timed out',
  LIVENESS_FAIL: 'Failed liveness check (possible attack)',
}

const pct = (r: number) => `${Math.round(r * 100)}%`

/** Lockout picture for the team lead (N7): figures only, no customer data. */
export function SummaryPage() {
  const { data, isPending, isError, error } = useQuery({ queryKey: ['summary'], queryFn: () => api<Summary>('/summary') })
  const maxCause = Math.max(1, ...(data?.causes.map((c) => c.failures) ?? []))

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
          <AlertTitle>Could not load the summary</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Lockout summary</CardTitle>
              <CardDescription>Locked customers with an open ticket, and their face-login attempts. Figures only.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge variant="secondary">{data.waiting.total} waiting</Badge>
              <Badge variant={data.waiting.attacks > 0 ? 'destructive' : 'outline'}>{data.waiting.attacks} look like attacks</Badge>
              <Badge variant="outline">{data.waiting.camera} camera / light problems</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Failure rate by app version</CardTitle>
              <CardDescription>Camera-problem cases only (attack attempts come from the attacker’s device). Share of face-login attempts that failed, worst first.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.appVersions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No camera-problem cases are waiting.</p>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App version</TableHead>
                    <TableHead>Failed attempts</TableHead>
                    <TableHead>Failure rate</TableHead>
                    <TableHead>Customers currently on it</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.appVersions.map((v) => (
                    <TableRow key={v.version}>
                      <TableCell className="font-medium">{v.version}</TableCell>
                      <TableCell>
                        {v.failures} of {v.attempts}
                      </TableCell>
                      <TableCell>
                        <Badge variant={v.failureRate >= 0.5 ? 'destructive' : 'outline'}>{pct(v.failureRate)}</Badge>
                      </TableCell>
                      <TableCell>{v.lockedCustomers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Why face logins failed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.causes.length === 0 && <p className="text-muted-foreground">No failed face-login attempts.</p>}
              {data.causes.map((c) => (
                <div key={c.cause} className="grid grid-cols-[14rem_1fr_3rem] items-center gap-3">
                  <span>{CAUSE_WORDS[c.cause] ?? c.cause}</span>
                  <div className="h-2 rounded bg-muted">
                    <div className="h-2 rounded bg-primary" style={{ width: `${(c.failures / maxCause) * 100}%` }} />
                  </div>
                  <span className="text-right tabular-nums">{c.failures}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
