import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { LogOut, ShieldCheck, UserRound } from 'lucide-react'
import { HealthBadge } from '@/components/HealthBadge'
import { Button } from '@/components/ui/button'
import { useAgentId } from '@/lib/agent'

export function AppShell({ children }: { children: ReactNode }) {
  const { agentId, name, logout } = useAgentId()
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
          <Link to="/" className="mr-auto flex items-center gap-3">
            <ShieldCheck className="size-6 text-primary" aria-hidden />
            <div>
              <h1 className="text-lg font-semibold leading-tight">Lockout Desk</h1>
              <p className="text-xs text-muted-foreground">Lumora Bank · Customer Care</p>
            </div>
          </Link>
          <HealthBadge />
          <div className="flex items-center gap-2 text-sm">
            <Link to="/profile" className="flex items-center gap-2 hover:underline" title="Your profile">
              <UserRound className="size-4 text-muted-foreground" aria-hidden />
              <span>
                {name} <span className="text-muted-foreground">({agentId})</span>
              </span>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              <LogOut aria-hidden /> Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  )
}
