import { Copy, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

/** A read-only text with a copy button. `internal` texts look different so they are not sent to a customer by mistake. */
export function CopyTextCard({
  title,
  description,
  text,
  copyLabel,
  internal = false,
}: {
  title: string
  description: string
  text: string
  copyLabel: string
  internal?: boolean
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${title} copied`)
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.')
    }
  }

  return (
    <Card className={cn(internal && 'border-amber-500 bg-amber-50/50')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          {internal && (
            <Badge variant="outline" className="border-amber-600 text-amber-700">
              <Lock aria-hidden /> INTERNAL
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea readOnly value={text} rows={text.split('\n').length + 1} aria-label={title} />
        <Button onClick={copy} variant={internal ? 'outline' : 'default'}>
          <Copy aria-hidden /> {copyLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
