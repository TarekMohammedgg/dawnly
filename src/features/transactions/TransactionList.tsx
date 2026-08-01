import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { AmountDisplay } from '../../components/AmountDisplay'
import { DateDisplay } from '../../components/DateDisplay'
import { EmptyState } from '../../components/EmptyState'
import { DIRECTION_LABELS, type Transaction } from '../../types/transaction'

type TransactionListProps = {
  transactions: Transaction[]
  onEdit?: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
  onSelectPerson?: (name: string) => void
  emptyTitle?: string
  emptyDescription?: string
}

export function TransactionList({
  transactions,
  onEdit,
  onDelete,
  onSelectPerson,
  emptyTitle = 'لا توجد معاملات',
  emptyDescription = 'ستظهر المعاملات هنا بالترتيب من الأحدث إلى الأقدم.',
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    )
  }

  return (
    <List disablePadding aria-label="قائمة المعاملات">
      {transactions.map((transaction) => {
        const directionLabel = DIRECTION_LABELS[transaction.direction]

        return (
          <ListItem
            key={transaction.id}
            divider
            secondaryAction={
              onEdit || onDelete ? (
                <Stack direction="row" spacing={0.5}>
                  {onEdit ? (
                    <IconButton
                      edge="end"
                      aria-label={`تعديل معاملة ${transaction.name}`}
                      onClick={() => {
                        onEdit(transaction)
                      }}
                      sx={{ minWidth: 44, minHeight: 44 }}
                    >
                      <EditOutlinedIcon />
                    </IconButton>
                  ) : null}
                  {onDelete ? (
                    <IconButton
                      edge="end"
                      aria-label={`حذف معاملة ${transaction.name}`}
                      onClick={() => {
                        onDelete(transaction)
                      }}
                      sx={{ minWidth: 44, minHeight: 44 }}
                    >
                      <DeleteOutlinedIcon />
                    </IconButton>
                  ) : null}
                </Stack>
              ) : undefined
            }
            sx={{ pr: onEdit || onDelete ? 12 : undefined }}
          >
            <ListItemButton
              component={onSelectPerson ? 'button' : 'div'}
              disabled={!onSelectPerson}
              onClick={() => {
                onSelectPerson?.(transaction.name)
              }}
              sx={{
                borderRadius: 1,
                px: 1,
                '&.Mui-disabled': { opacity: 1 },
              }}
              aria-label={
                onSelectPerson
                  ? `عرض تفاصيل ${transaction.name}`
                  : undefined
              }
            >
              <ListItemText
                primary={
                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}
                  >
                    <Typography component="span" sx={{ fontWeight: 700 }}>
                      {transaction.name}
                    </Typography>
                    <Typography
                      component="span"
                      variant="body2"
                      color={
                        transaction.direction === 'receivable'
                          ? 'success.main'
                          : 'warning.main'
                      }
                      sx={{ fontWeight: 600 }}
                    >
                      {directionLabel}
                    </Typography>
                  </Stack>
                }
                secondary={
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      gap: 1.5,
                      mt: 0.5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <AmountDisplay amount={transaction.amount} />
                    <DateDisplay isoDate={transaction.transactionDate} />
                    {transaction.notes ? (
                      <Typography component="span" variant="body2" color="text.secondary">
                        {transaction.notes}
                      </Typography>
                    ) : null}
                  </Box>
                }
                slotProps={{
                  secondary: { component: 'div' },
                }}
              />
            </ListItemButton>
          </ListItem>
        )
      })}
    </List>
  )
}
