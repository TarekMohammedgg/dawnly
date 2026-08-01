import NorthEastRoundedIcon from '@mui/icons-material/NorthEastRounded'
import SouthWestRoundedIcon from '@mui/icons-material/SouthWestRounded'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'
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
        icon={<NorthEastRoundedIcon fontSize="small" />}
      />
      <SummaryCard
        title={DIRECTION_LABELS.payable}
        amount={payableTotal}
        tone="warning"
        icon={<SouthWestRoundedIcon fontSize="small" />}
      />
    </Stack>
  )
}

function SummaryCard({
  title,
  amount,
  tone,
  icon,
}: {
  title: string
  amount: number
  tone: 'success' | 'warning'
  icon: ReactNode
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        flex: 1,
        borderColor: `${tone}.main`,
        bgcolor: 'background.paper',
        borderRadius: 3,
        transition:
          'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        '&:hover': {
          borderColor: `${tone}.main`,
          boxShadow: 2,
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: 'action.hover',
              color: `${tone}.main`,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              color={`${tone}.main`}
              sx={{ fontWeight: 700, lineHeight: 1.3 }}
            >
              {title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              إجمالي المبالغ
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ mt: 1.5, '& .MuiTypography-root': { fontSize: '1.35rem' } }}>
          <AmountDisplay amount={amount} aria-label={`إجمالي ${title}`} />
        </Box>
      </CardContent>
    </Card>
  )
}
