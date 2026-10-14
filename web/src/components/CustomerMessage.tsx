import { CopyTextCard } from '@/components/CopyTextCard'
import type { CaseDetail } from '@/lib/api'
import { customerMessage } from '@/lib/messages'

export function CustomerMessage({ detail }: { detail: CaseDetail }) {
  return (
    <CopyTextCard
      title="Message to the customer"
      description="Paste it into the chat or ticket reply so every customer hears the same thing."
      text={customerMessage(detail)}
      copyLabel="Copy message for customer"
    />
  )
}
