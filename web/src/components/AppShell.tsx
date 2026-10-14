import type { ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'
import { HealthBadge } from '@/components/HealthBadge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAgentId } from '@/lib/agent'

export function AppShell({ children }: { children: ReactNode }) {
  const { agentId, setAgentId, isValid } = useAgentId()
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          <div className="mr-auto">
            <h1 className="text-lg font-semibold leading-tight">Lockout Desk</h1>
            <p className="text-xs text-muted-foreground">Lumora Bank · Customer Care</p>
          </div>
          <HealthBadge />
          <div className="flex items-center gap-2">
            <Label htmlFor="agent-id" className="text-sm text-muted-foreground">
              Agent ID
            </Label>
            <Input
              id="agent-id"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value.trim())}
              placeholder="e.g. agent-042"
              maxLength={32}
              aria-invalid={agentId !== '' && !isValid}
              className="h-8 w-36"
            />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  )
}
