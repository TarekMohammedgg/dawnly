import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useState, type FormEvent, type ReactNode } from 'react'
import { apiFetch, ApiClientError } from '../../lib/api/client'
import { useAuthSession } from '../../lib/auth/sessionContext'
import {
  clearLocalEncryptionKey,
  setLocalEncryptionKey,
} from '../../lib/local/encryption'
import { migrateLegacyLocalData } from '../../lib/local/transactions'
import type { VerifyPinSuccess } from '../../types/api'

type PinGateProps = {
  children: ReactNode
}

export function PinGate({ children }: PinGateProps) {
  const { session, setSession } = useAuthSession()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    return children
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const result = await apiFetch<VerifyPinSuccess>('/api/auth/verify-pin', {
        method: 'POST',
        body: { pin },
      })
      await setLocalEncryptionKey(pin)
      await migrateLegacyLocalData()
      setSession({
        token: result.token,
        expiresAt: result.expires_at,
      })
      setPin('')
    } catch (cause) {
      clearLocalEncryptionKey()
      if (cause instanceof ApiClientError) {
        setError(cause.message)
      } else {
        setError('تعذر التحقق من الرقم السري')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        bgcolor: 'background.default',
      }}
    >
      <Stack
        component="form"
        onSubmit={onSubmit}
        spacing={2}
        sx={{ width: '100%', maxWidth: 360 }}
      >
        <Typography
          variant="h5"
          component="h1"
          sx={{ textAlign: 'center' }}
        >
          Dawnly
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: 'center' }}
        >
          أدخل الرقم السري المكوّن من ٦ أرقام للمتابعة
        </Typography>
        <TextField
          label="الرقم السري"
          type="password"
          autoComplete="one-time-code"
          value={pin}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, '').slice(0, 6)
            setPin(next)
          }}
          slotProps={{
            htmlInput: {
              maxLength: 6,
              inputMode: 'numeric',
              'aria-label': 'الرقم السري',
            },
          }}
          fullWidth
          required
        />
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Button
          type="submit"
          variant="contained"
          disabled={submitting || pin.length !== 6}
          fullWidth
        >
          دخول
        </Button>
      </Stack>
    </Box>
  )
}
