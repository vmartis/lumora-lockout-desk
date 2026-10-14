import { Link } from 'react-router'
import { ArrowLeft, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAgentId } from '@/lib/agent'
import { formatTime } from '@/lib/api'

/** Read-only profile of the signed-in agent (N9). Accounts are managed in config/agents.json, not here. */
export function ProfilePage() {
  const { name, agentId, username, sessionEndsAt } = useAgentId()
  const rows: [string, string][] = [
    ['Name', name],
    ['Agent ID (shown in the audit log)', agentId],
    ['Username', username || '–'],
    ['Session ends', sessionEndsAt ? formatTime(sessionEndsAt) : '–'],
  ]
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/">
          <ArrowLeft aria-hidden /> Back to queue
        </Link>
      </Button>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-5" aria-hidden /> Your profile
          </CardTitle>
          <CardDescription>Read only. To change your details or password, ask your team lead.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
