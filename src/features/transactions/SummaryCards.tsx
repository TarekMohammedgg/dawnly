import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { AmountDisplay } from '../../components/AmountDisplay'
import { DIRECTION_LABELS } from '../../types/transaction'

type SummaryCardsProps = {
  receivableTotal: number
  payableTotal: number
}

export function SummaryCards({
  receivableTotal,
  payableTotal,
}: SummaryCardsProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      aria-label="ملخص الإجماليات"
    >
      <SummaryCard
        title={DIRECTION_LABELS.receivable}
        amount={receivableTotal}
        tone="success"
      />
      <SummaryCard
        title={DIRECTION_LABELS.payable}
        amount={payableTotal}
        tone="warning"
      />
    </Stack>
  )
}

function SummaryCard({
  title,
  amount,
  tone,
}: {
  title: string
  amount: number
  tone: 'success' | 'warning'
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        flex: 1,
        borderColor: `${tone}.main`,
        bgcolor: 'background.paper',
      }}
    >
      <CardContent>
        <Typography
          variant="subtitle1"
          color={`${tone}.main`}
          sx={{ fontWeight: 700, mb: 1 }}
        >
          {title}
        </Typography>
        <Box sx={{ '& .MuiTypography-root': { fontSize: '1.35rem' } }}>
          <AmountDisplay amount={amount} aria-label={`إجمالي ${title}`} />
        </Box>
      </CardContent>
    </Card>
  )
}
