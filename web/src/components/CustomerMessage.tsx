import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import type { CaseDetail } from '@/lib/api'
import { customerMessage } from '@/lib/messages'

export function CustomerMessage({ detail }: { detail: CaseDetail }) {
  const text = customerMessage(detail)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Message copied')
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Message to the customer</CardTitle>
        <CardDescription>Paste it into the chat or ticket reply so every customer hears the same thing.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea readOnly value={text} rows={text.split('\n').length + 1} aria-label="Message to the customer" />
        <Button onClick={copy}>
          <Copy aria-hidden /> Copy message
        </Button>
      </CardContent>
    </Card>
  )
}
