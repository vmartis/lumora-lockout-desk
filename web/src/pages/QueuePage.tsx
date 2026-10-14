import { Inbox } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function QueuePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Locked accounts</CardTitle>
        <CardDescription>Customers waiting for an unlock, oldest first.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <Inbox className="size-8" aria-hidden />
        <p>The lockout queue will appear here.</p>
      </CardContent>
    </Card>
  )
}
