import Typography from '@mui/material/Typography'
import { formatAmount } from '../lib/format/amount'

type AmountDisplayProps = {
  amount: number
  'aria-label'?: string
}

export function AmountDisplay({
  amount,
  'aria-label': ariaLabel,
}: AmountDisplayProps) {
  return (
    <Typography
      component="span"
      variant="body1"
      sx={{ fontWeight: 600 }}
      aria-label={ariaLabel ?? `المبلغ ${formatAmount(amount)}`}
    >
      {formatAmount(amount)}
    </Typography>
  )
}
