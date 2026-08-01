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
      direction="row"
      spacing={{ xs: 1.25, sm: 2 }}
      aria-label="ملخص الإجماليات"
    >
      <SummaryCard
        title={DIRECTION_LABELS.receivable}
        amount={receivableTotal}
        tone="success"
        icon={<NorthEastRoundedIcon />}
      />
      <SummaryCard
        title={DIRECTION_LABELS.payable}
        amount={payableTotal}
        tone="warning"
        icon={<SouthWestRoundedIcon />}
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
        minWidth: 0,
        borderColor: `${tone}.main`,
        borderRadius: 4,
        bgcolor: 'background.paper',
        boxShadow: 'none',
      }}
    >
      <CardContent
        sx={{
          p: { xs: 1.5, sm: 2.25 },
          '&:last-child': { pb: { xs: 1.5, sm: 2.25 } },
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography
            variant="subtitle1"
            color={`${tone}.dark`}
            sx={{ fontWeight: 800 }}
          >
            {title}
          </Typography>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 2,
              bgcolor: `${tone}.light`,
              color: `${tone}.dark`,
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Box
          sx={{
            mt: 1.5,
            '& .MuiTypography-root': {
              fontSize: { xs: '1.35rem', sm: '1.65rem' },
              fontWeight: 800,
            },
          }}
        >
          <AmountDisplay amount={amount} aria-label={`إجمالي ${title}`} />
        </Box>
      </CardContent>
    </Card>
  )
}
