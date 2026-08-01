import Typography from '@mui/material/Typography'
import { formatDisplayDate } from '../lib/format/date'

type DateDisplayProps = {
  isoDate: string
  'aria-label'?: string
}

export function DateDisplay({
  isoDate,
  'aria-label': ariaLabel,
}: DateDisplayProps) {
  const display = formatDisplayDate(isoDate)

  return (
    <Typography
      component="time"
      variant="body2"
      color="text.secondary"
      dateTime={isoDate}
      aria-label={ariaLabel ?? `التاريخ ${display}`}
    >
      {display}
    </Typography>
  )
}
