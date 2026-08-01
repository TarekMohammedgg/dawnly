import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { AmountDisplay } from '../../components/AmountDisplay'
import type { PersonSummary } from '../../lib/transaction/summaries'

type PersonCardProps = {
  summary: PersonSummary
  transactionCount: number
  onClick: () => void
}

function firstCharacter(name: string): string {
  return [...name.trim()][0] ?? '؟'
}

function transactionCountLabel(count: number): string {
  return count === 1 ? 'معاملة واحدة' : `${count} معاملات`
}

export function PersonCard({
  summary,
  transactionCount,
  onClick,
}: PersonCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 3,
        bgcolor: 'background.paper',
        transition:
          'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: 2,
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CardActionArea
        onClick={onClick}
        aria-label={`عرض سجل ${summary.name}`}
        sx={{ height: '100%', p: 1.75, textAlign: 'right' }}
      >
        <Stack spacing={1.5} sx={{ height: '100%' }}>
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
              <Avatar
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  fontWeight: 800,
                }}
              >
                {firstCharacter(summary.name)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="subtitle1"
                  noWrap
                  sx={{ fontWeight: 700 }}
                >
                  {summary.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {transactionCountLabel(transactionCount)}
                </Typography>
              </Box>
            </Stack>
            <ArrowBackIosNewRoundedIcon
              fontSize="small"
              sx={{ color: 'text.secondary', flexShrink: 0 }}
              aria-hidden="true"
            />
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 1.25,
              mt: 'auto',
              pt: 1.25,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                ليّا
              </Typography>
              <Box sx={{ mt: 0.25 }}>
                <AmountDisplay
                  amount={summary.receivable}
                  aria-label={`إجمالي ليّا لـ ${summary.name}`}
                />
              </Box>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                عليّا
              </Typography>
              <Box sx={{ mt: 0.25 }}>
                <AmountDisplay
                  amount={summary.payable}
                  aria-label={`إجمالي عليّا لـ ${summary.name}`}
                />
              </Box>
            </Box>
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  )
}
