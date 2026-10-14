import { useState } from 'react'

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

export function useAgentId() {
  const [agentId, setAgentIdState] = useState(read)
  const setAgentId = (value: string) => {
    setAgentIdState(value)
    try {
      sessionStorage.setItem(KEY, value)
    } catch {
      /* storage blocked: keep it in memory only */
    }
  }
  return { agentId, setAgentId, isValid: AGENT_ID_PATTERN.test(agentId) }
}
