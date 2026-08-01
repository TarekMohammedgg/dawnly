import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
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
        const directionColor =
          transaction.direction === 'receivable'
            ? 'success.main'
            : 'warning.main'

        return (
          <ListItem
            key={transaction.id}
            disableGutters
            sx={{
              display: 'block',
              p: 0,
              mb: 1.25,
              '&:last-child': { mb: 0 },
            }}
          >
            <Card
              variant="outlined"
              sx={{
                overflow: 'hidden',
                borderColor: 'divider',
                borderRadius: 2,
                transition: 'border-color 160ms ease, box-shadow 160ms ease',
                '&:hover, &:focus-within': {
                  borderColor: 'primary.main',
                  boxShadow: 1,
                },
              }}
            >
              <Stack direction="row" sx={{ alignItems: 'stretch', minWidth: 0 }}>
                <ListItemButton
                  component={onSelectPerson ? 'button' : 'div'}
                  disabled={!onSelectPerson}
                  onClick={() => {
                    onSelectPerson?.(transaction.name)
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    alignItems: 'center',
                    px: { xs: 1.25, sm: 1.5 },
                    py: 1.25,
                    borderRadius: 0,
                    textAlign: 'right',
                    '&.Mui-disabled': {
                      opacity: 1,
                      color: 'inherit',
                    },
                    '&:hover': { backgroundColor: 'action.hover' },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: '-2px',
                    },
                  }}
                  aria-label={
                    onSelectPerson
                      ? `عرض تفاصيل ${transaction.name}`
                      : undefined
                  }
                >
                  <Box sx={{ width: '100%', minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      useFlexGap
                      sx={{
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        minWidth: 0,
                        width: '100%',
                        direction: 'rtl',
                        justifyContent: 'flex-start',
                        textAlign: 'right',
                      }}
                    >
                      <Typography
                        component="span"
                        variant="subtitle1"
                        sx={{
                          minWidth: 0,
                          flex: '0 1 auto',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: 700,
                          textAlign: 'right',
                        }}
                      >
                        {transaction.name}
                      </Typography>
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.75,
                          flexShrink: 0,
                          color: directionColor,
                        }}
                      >
                        <Box
                          component="span"
                          aria-hidden="true"
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: directionColor,
                          }}
                        />
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ fontWeight: 700 }}
                        >
                          {directionLabel}
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack
                      direction="row"
                      spacing={1.5}
                      useFlexGap
                      sx={{
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        mt: 0.5,
                      }}
                    >
                      <Box sx={{ color: directionColor }}>
                        <AmountDisplay amount={transaction.amount} />
                      </Box>
                      <Box
                        component="span"
                        aria-hidden="true"
                        sx={{
                          width: 3,
                          height: 3,
                          borderRadius: '50%',
                          bgcolor: 'divider',
                        }}
                      />
                      <DateDisplay isoDate={transaction.transactionDate} />
                    </Stack>

                    {transaction.notes ? (
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          mt: 0.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {transaction.notes}
                      </Typography>
                    ) : null}
                  </Box>
                </ListItemButton>

                {onEdit || onDelete ? (
                  <Stack
                    direction="row"
                    spacing={0.25}
                    sx={{
                      alignItems: 'center',
                      px: 0.75,
                      borderInlineStart: '1px solid',
                      borderColor: 'divider',
                      flexShrink: 0,
                    }}
                  >
                    {onEdit ? (
                      <IconButton
                        aria-label={`تعديل معاملة ${transaction.name}`}
                        onClick={() => {
                          onEdit(transaction)
                        }}
                        sx={{
                          minWidth: 44,
                          minHeight: 44,
                          color: 'text.secondary',
                          '&:hover': {
                            color: 'primary.main',
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        <EditOutlinedIcon />
                      </IconButton>
                    ) : null}
                    {onDelete ? (
                      <IconButton
                        aria-label={`حذف معاملة ${transaction.name}`}
                        onClick={() => {
                          onDelete(transaction)
                        }}
                        sx={{
                          minWidth: 44,
                          minHeight: 44,
                          color: 'text.secondary',
                          '&:hover': {
                            color: 'error.main',
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        <DeleteOutlinedIcon />
                      </IconButton>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            </Card>
          </ListItem>
        )
      })}
    </List>
  )
}
