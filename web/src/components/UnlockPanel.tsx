import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CheckCircle2, MessageSquareText, LockOpen } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { ReasonSuggestions } from '@/components/ReasonSuggestions'
import { useAgentId } from '@/lib/agent'
import { api } from '@/lib/api'
import { canUnlock, methodOptions, SMS_NOT_ALLOWED_NOTE, type Verification } from './verificationMethods'

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'The code has 6 digits') })
const unlockSchema = z.object({ reason: z.string().trim().min(5, 'Say why (at least 5 characters)').max(500) })

export function UnlockPanel({
  accountId,
  phone,
  allowedVerifications,
}: {
  accountId: string
  phone: string
  allowedVerifications: string[]
}) {
  const queryClient = useQueryClient()
  const { agentId, isValid: agentOk } = useAgentId()
  const options = methodOptions(allowedVerifications)
  const [picked, setMethod] = useState<Verification | null>(options[0]?.value ?? null)
  // If the allowed methods change after a refetch, fall back to the first one still offered.
  const method = options.some((o) => o.value === picked) ? picked : (options[0]?.value ?? null)
  const [confirmed, setConfirmed] = useState(false)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const chosen = options.find((o) => o.value === method)
  const smsAllowed = options.some((o) => o.value === 'SMS_CHALLENGE')

  const codeForm = useForm({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } })
  const unlockForm = useForm({
    resolver: zodResolver(unlockSchema),
    defaultValues: { reason: '' },
  })

  const sendSms = useMutation({
    mutationFn: () => api<{ challengeId: string }>(`/cases/${accountId}/sms`, { method: 'POST', body: '{}' }),
    onSuccess: ({ challengeId }) => {
      setChallengeId(challengeId)
      setVerified(false)
      codeForm.reset()
      toast.success(`Code sent to ${phone}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const checkCode = useMutation({
    mutationFn: (code: string) =>
      api<{ verified: boolean }>(`/cases/${accountId}/sms/${challengeId}/check`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    onSuccess: ({ verified }) => {
      setVerified(verified)
      if (verified) toast.success('Customer verified')
      else codeForm.setError('code', { message: 'Wrong code. After 3 wrong codes, send a new one.' })
    },
    onError: (e) => toast.error(e.message),
  })

  const unlock = useMutation({
    mutationFn: (reason: string) =>
      api(`/cases/${accountId}/unlock`, {
        method: 'POST',
        body: JSON.stringify(
          method === 'SMS_CHALLENGE'
            ? { agentId, verification: method, challengeId, reason }
            : { agentId, verification: method, reason },
        ),
      }),
    onSuccess: () => {
      toast.success('Account unlocked')
      queryClient.invalidateQueries({ queryKey: ['case', accountId] })
      queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify and unlock</CardTitle>
        <CardDescription>Policy: verify identity first. Never ask for passwords or full card numbers.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">How did you verify the customer?</p>
          <RadioGroup
            value={method ?? ''}
            onValueChange={(v) => {
              setMethod(v as Verification)
              setConfirmed(false)
            }}
          >
            {options.map((o) => (
              <div key={o.value} className="flex items-center gap-2">
                <RadioGroupItem value={o.value} id={`method-${o.value}`} />
                <Label htmlFor={`method-${o.value}`} className="font-normal">
                  {o.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {!smsAllowed && <p className="text-sm text-muted-foreground">{SMS_NOT_ALLOWED_NOTE}</p>}
        </div>

        {method === 'SMS_CHALLENGE' && (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">1. Send a code to the registered phone ({phone})</p>
              <Button variant={challengeId ? 'outline' : 'default'} onClick={() => sendSms.mutate()} disabled={sendSms.isPending}>
                <MessageSquareText aria-hidden /> {challengeId ? 'Send a new code' : 'Send SMS code'}
              </Button>
            </div>

            <form className="space-y-2" onSubmit={codeForm.handleSubmit(({ code }) => checkCode.mutate(code))}>
              <Label htmlFor="code">2. Type the code the customer reads to you</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  placeholder="123456"
                  className="w-32"
                  disabled={!challengeId || verified}
                  {...codeForm.register('code')}
                />
                <Button type="submit" variant="outline" disabled={!challengeId || verified || checkCode.isPending}>
                  Check code
                </Button>
                {verified && (
                  <span className="flex items-center gap-1 text-sm text-green-700">
                    <CheckCircle2 className="size-4" aria-hidden /> Verified
                  </span>
                )}
              </div>
              {codeForm.formState.errors.code && (
                <p className="text-sm text-destructive">{codeForm.formState.errors.code.message}</p>
              )}
            </form>
          </>
        )}

        {chosen?.confirm && (
          <div className="flex items-center gap-2">
            <Checkbox id="confirmed" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <Label htmlFor="confirmed" className="font-normal">
              {chosen.confirm}
            </Label>
          </div>
        )}

        <form className="space-y-2" onSubmit={unlockForm.handleSubmit(({ reason }) => unlock.mutate(reason))}>
          <Label htmlFor="reason">
            {method === 'SMS_CHALLENGE' ? '3. ' : ''}Reason for the unlock (saved in the audit log)
          </Label>
          <Textarea
            id="reason"
            rows={2}
            maxLength={500}
            placeholder={chosen?.reasonExample}
            {...unlockForm.register('reason')}
          />
          <ReasonSuggestions
            current={unlockForm.watch('reason')}
            method={method}
            onPick={(text) => unlockForm.setValue('reason', text, { shouldValidate: true })}
          />
          {unlockForm.formState.errors.reason && (
            <p className="text-sm text-destructive">{unlockForm.formState.errors.reason.message}</p>
          )}
          {!agentOk && (
            <Alert>
              <AlertTitle>Enter your agent ID</AlertTitle>
              <AlertDescription>Type it in the header first. It is saved with the unlock.</AlertDescription>
            </Alert>
          )}
          <Button
            type="submit"
            disabled={!canUnlock({ method, agentOk, smsVerified: verified, confirmed }) || unlock.isPending}
          >
            <LockOpen aria-hidden /> Unlock account
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
