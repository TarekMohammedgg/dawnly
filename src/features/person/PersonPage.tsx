import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { AmountDisplay } from '../../components/AmountDisplay'
import { EmptyState } from '../../components/EmptyState'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { SummaryCards } from '../transactions/SummaryCards'
import { TransactionList } from '../transactions/TransactionList'
import { useTransactions } from '../transactions/useTransactions'
import { useAppRouter } from '../../lib/routing/routerContext'
import { APP_ROUTES } from '../../lib/routing/routes'
import { normalizePersonNameKey } from '../../lib/transaction/normalizeName'
import { summarizePerson } from '../../lib/transaction/summaries'
import { DIRECTION_LABELS } from '../../types/transaction'

function readPersonName(search: string): string {
  return new URLSearchParams(search).get('name')?.trim() ?? ''
}

export function PersonPage() {
  const { search, navigate } = useAppRouter()
  const personName = readPersonName(search)
  const { transactions, loading, error, reload } = useTransactions(
    personName ? { name: personName } : {},
  )

  if (!personName) {
    return (
      <EmptyState
        title="لم يُحدد اسم"
        description="اختر شخصًا من السجل لعرض تفاصيله."
        action={
          <Button
            variant="contained"
            onClick={() => {
              navigate(APP_ROUTES.ledger)
            }}
          >
            العودة إلى السجل
          </Button>
        }
      />
    )
  }

  if (loading) {
    return <LoadingState label="جاري تحميل تفاصيل الشخص…" />
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

  const personKey = normalizePersonNameKey(personName)
  const personTransactions = transactions.filter(
    (row) => normalizePersonNameKey(row.name) === personKey,
  )
  const displayName = personTransactions[0]?.name ?? personName
  const summary = summarizePerson(displayName, personTransactions)

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
          {displayName}
        </Typography>
        <Button
          variant="text"
          onClick={() => {
            navigate(APP_ROUTES.ledger)
          }}
          sx={{ minHeight: 44 }}
        >
          رجوع
        </Button>
      </Stack>

      <SummaryCards
        receivableTotal={summary.receivable}
        payableTotal={summary.payable}
      />

      <Stack
        spacing={0.5}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          px: 2,
          py: 1.5,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          الصافي
        </Typography>
        <Typography variant="body1" sx={{ fontWeight: 700 }}>
          {summary.net === 0 ? (
            'متوازن'
          ) : summary.net > 0 ? (
            <>
              {DIRECTION_LABELS.receivable}{' '}
              <AmountDisplay amount={summary.net} />
            </>
          ) : (
            <>
              {DIRECTION_LABELS.payable}{' '}
              <AmountDisplay amount={Math.abs(summary.net)} />
            </>
          )}
        </Typography>
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }}>
          معاملات {displayName}
        </Typography>
        <TransactionList
          transactions={personTransactions}
          emptyTitle="لا توجد معاملات لهذا الشخص"
          emptyDescription="لم يُسجَّل أي مبلغ ليّا أو عليّا تحت هذا الاسم."
        />
      </Stack>
    </Stack>
  )
}
