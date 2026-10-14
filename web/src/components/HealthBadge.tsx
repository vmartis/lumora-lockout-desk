import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { api, type Health } from '@/lib/api'

export function HealthBadge() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api<Health>('/health'),
    refetchInterval: 30_000,
  })
  if (isPending) return <Badge variant="outline">Checking…</Badge>
  if (isError) return <Badge variant="destructive">Backend unreachable</Badge>
  if (data.adminApi === 'DOWN') return <Badge variant="destructive">Identity Admin API down</Badge>
  return <Badge variant="secondary">API connected</Badge>
}
