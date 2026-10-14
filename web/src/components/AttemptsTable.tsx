import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatTime, type Attempt } from '@/lib/api'
import { cn } from '@/lib/utils'

const SUSPICIOUS = 'bg-destructive/10 font-medium text-destructive'

/** Login attempts, newest first; cells that made the verdict say "attack" are highlighted. */
export function AttemptsTable({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length === 0) return <p className="text-sm text-muted-foreground">No login attempts found.</p>
  return (
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
        {attempts.map((a) => {
          const flag = (f: Attempt['flags'][number]) => a.flags.includes(f)
          const time = Number.isNaN(Date.parse(a.timestamp)) ? a.timestamp : formatTime(a.timestamp)
          return (
            <TableRow key={a.attemptId}>
              <TableCell className="whitespace-nowrap">{time}</TableCell>
              <TableCell className={cn(flag('reason') && SUSPICIOUS)}>
                {a.result === 'SUCCESS' ? 'Success' : a.failReason || 'Fail'}
              </TableCell>
              <TableCell className={cn(flag('device') && SUSPICIOUS)}>
                {a.deviceModel}
                {!a.deviceTrusted && ' (untrusted)'}
              </TableCell>
              <TableCell className={cn(flag('country') && SUSPICIOUS)}>{a.country || 'unknown'}</TableCell>
              <TableCell className={cn(flag('liveness') && SUSPICIOUS)}>{a.livenessScore || '–'}</TableCell>
              <TableCell>{a.appVersion}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
