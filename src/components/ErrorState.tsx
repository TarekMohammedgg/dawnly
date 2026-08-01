import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import type { ReactNode } from 'react'

type ErrorStateProps = {
  title?: string
  message: string
  onRetry?: () => void
  action?: ReactNode
}

export function ErrorState({
  title = 'حدث خطأ',
  message,
  onRetry,
  action,
}: ErrorStateProps) {
  return (
    <Box
      role="alert"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        py: 4,
        px: 2,
      }}
    >
      <Alert severity="error" sx={{ alignItems: 'center' }}>
        <strong>{title}</strong>
        <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
          {message}
        </Box>
      </Alert>
      {onRetry ? (
        <Button variant="outlined" onClick={onRetry} sx={{ alignSelf: 'start' }}>
          إعادة المحاولة
        </Button>
      ) : null}
      {action}
    </Box>
  )
}
