import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { useAppRouter } from '../../lib/routing/routerContext'
import { APP_ROUTES, personPath } from '../../lib/routing/routes'
import { normalizePersonNameKey } from '../../lib/transaction/normalizeName'
import { summarizePerson, uniqueSortedNames } from '../../lib/transaction/summaries'
import { PersonCard } from './PersonCard'
import { useTransactions } from '../transactions/useTransactions'

export function PeoplePage() {
  const { navigate } = useAppRouter()
  const { transactions, loading, error, reload } = useTransactions()

  if (loading) {
    return <LoadingState label="جاري تحميل الأشخاص…" />
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          void reload()
        }}
      />
    )
  }

  const people = uniqueSortedNames(transactions).map((personName) => {
    const personKey = normalizePersonNameKey(personName)
    const personTransactions = transactions.filter(
      (transaction) => normalizePersonNameKey(transaction.name) === personKey,
    )

    return {
      summary: summarizePerson(personName, personTransactions),
      transactionCount: personTransactions.length,
    }
  })

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: 'action.hover',
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          <PeopleOutlinedIcon />
        </Box>
        <Box>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
            الأشخاص
          </Typography>
          <Typography variant="body2" color="text.secondary">
            اختر اسمًا لعرض سجله بالكامل.
          </Typography>
        </Box>
      </Stack>

      {people.length === 0 ? (
        <EmptyState
          title="لا يوجد أشخاص بعد"
          description="أضف أول معاملة ليظهر الشخص هنا في قائمة مرتبة وسهلة الوصول."
          action={
            <Button
              variant="contained"
              onClick={() => {
                navigate(APP_ROUTES.dashboard)
              }}
            >
              إضافة معاملة
            </Button>
          }
        />
      ) : (
        <Box
          aria-label="قائمة الأشخاص"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
            },
            gap: 1.5,
          }}
        >
          {people.map(({ summary, transactionCount }) => (
            <PersonCard
              key={summary.name}
              summary={summary}
              transactionCount={transactionCount}
              onClick={() => {
                navigate(personPath(summary.name))
              }}
            />
          ))}
        </Box>
      )}
    </Stack>
  )
}
