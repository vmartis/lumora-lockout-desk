import { ShieldAlert, Camera } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { Risk } from '@/lib/api'

export function RiskBadge({ risk }: { risk: Risk }) {
  return risk === 'ATTACK' ? (
    <Badge variant="destructive">
      <ShieldAlert aria-hidden /> Looks like an attack
    </Badge>
  ) : (
    <Badge variant="secondary">
      <Camera aria-hidden /> Camera / light problem
    </Badge>
  )
}
