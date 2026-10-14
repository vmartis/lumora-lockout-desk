import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LoginPage } from '@/pages/LoginPage'
import { api, ApiError, SESSION_ENDED } from '@/lib/api'

// The signed-in agent comes from the server session (httpOnly cookie); the browser never holds the token.
type Session = { agentId: string; name: string }
type AgentState = Session & { isValid: true; logout: () => Promise<void> }
const AgentContext = createContext<AgentState | null>(null)

export function AgentProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Session>('/me'), retry: false })

  // Any API call that comes back 401 (session expired) sends the agent back to the login page.
  useEffect(() => {
    const ended = () => queryClient.resetQueries({ queryKey: ['me'] })
    window.addEventListener(SESSION_ENDED, ended)
    return () => window.removeEventListener(SESSION_ENDED, ended)
  }, [queryClient])

  if (me.isPending) return <Skeleton className="m-6 h-40" />
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) return <LoginPage />
    return (
      <Alert variant="destructive" className="m-6 w-auto">
        <AlertTitle>Could not reach the Lockout Desk server</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{me.error.message}</p>
          <Button size="sm" variant="outline" onClick={() => me.refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const logout = async () => {
    try {
      await api('/logout', { method: 'POST', body: '{}' })
    } catch {
      /* even if the server call fails, forget everything on this screen */
    } finally {
      queryClient.clear()
      await queryClient.resetQueries({ queryKey: ['me'] })
    }
  }
  return <AgentContext.Provider value={{ ...me.data, isValid: true, logout }}>{children}</AgentContext.Provider>
}

export function useAgentId(): AgentState {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error('useAgentId must be used inside AgentProvider')
  return ctx
}
