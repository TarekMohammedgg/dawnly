import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

type LoadingStateProps = {
  label?: string
}

export function LoadingState({ label = 'جاري التحميل…' }: LoadingStateProps) {
  return (
    <Box
      role="status"
      aria-live="polite"
      aria-busy="true"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        py: 6,
        px: 2,
      }}
    >
      <CircularProgress aria-hidden="true" />
      <Typography variant="body1">{label}</Typography>
    </Box>
  )
}
