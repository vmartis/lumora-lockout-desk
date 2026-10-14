import { createContext, useContext, useState, type ReactNode } from 'react'

// Agent ID is typed by the agent (no login in this environment, see PRODUCT_NOTE.md) and kept for the browser tab only.
const KEY = 'lockout-desk.agentId'
export const AGENT_ID_PATTERN = /^[A-Za-z0-9._-]{2,32}$/

function read(): string {
  try {
    return sessionStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

type AgentState = { agentId: string; setAgentId: (v: string) => void; isValid: boolean }
const AgentContext = createContext<AgentState | null>(null)

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agentId, setState] = useState(read)
  const setAgentId = (value: string) => {
    setState(value)
    try {
      sessionStorage.setItem(KEY, value)
    } catch {
      /* storage blocked: keep it in memory only */
    }
  }
  return (
    <AgentContext.Provider value={{ agentId, setAgentId, isValid: AGENT_ID_PATTERN.test(agentId) }}>
      {children}
    </AgentContext.Provider>
  )
}

export function useAgentId(): AgentState {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error('useAgentId must be used inside AgentProvider')
  return ctx
}
