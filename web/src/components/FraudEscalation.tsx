import { CopyTextCard } from '@/components/CopyTextCard'
import { useAgentId } from '@/lib/agent'
import type { CaseDetail } from '@/lib/api'
import { fraudSummary } from '@/lib/fraud'

export function FraudEscalation({ detail }: { detail: CaseDetail }) {
  const { agentId, isValid } = useAgentId()
  return (
    <CopyTextCard
      title="Escalation to the Fraud team"
      description="Internal only – never send this to the customer. Paste it into the Fraud team's channel or ticket."
      text={fraudSummary(detail, isValid ? agentId : '')}
      copyLabel="Copy for Fraud team (internal)"
      internal
    />
  )
}
