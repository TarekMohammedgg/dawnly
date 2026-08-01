import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import {
  ledgerFiltersToQuery,
  ledgerFiltersToSearchParams,
  parseLedgerFilters,
  type LedgerFilters,
} from '../../lib/routing/ledgerFilters'
import { useAppRouter } from '../../lib/routing/routerContext'
import { personPath } from '../../lib/routing/routes'
import type { ValidTransactionForm } from '../../lib/transaction/formValidation'
import { uniqueSortedNames } from '../../lib/transaction/summaries'
import type { Transaction } from '../../types/transaction'
import { TransactionFilters } from '../transactions/TransactionFilters'
import { TransactionForm } from '../transactions/TransactionForm'
import { TransactionList } from '../transactions/TransactionList'
import { useTransactions } from '../transactions/useTransactions'

function LedgerFilterDraft({
  search,
  onApply,
}: {
  search: string
  onApply: (next: LedgerFilters) => void
}) {
  const [draftFilters, setDraftFilters] = useState<LedgerFilters>(() =>
    parseLedgerFilters(search),
  )

  return (
    <TransactionFilters
      value={draftFilters}
      onChange={setDraftFilters}
      onApply={onApply}
    />
  )
}

export function LedgerPage() {
  const { search, setSearchParams, navigate } = useAppRouter()
  const appliedFilters = parseLedgerFilters(search)
  const query = ledgerFiltersToQuery(appliedFilters)

  const {
    transactions,
    loading,
    error,
    reload,
    update,
    remove,
  } = useTransactions(query)

  const [editing, setEditing] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  const nameSuggestions = uniqueSortedNames(transactions)

  function applyFilters(next: LedgerFilters) {
    setSearchParams(ledgerFiltersToSearchParams(next), { replace: true })
  }

  async function handleUpdate(value: ValidTransactionForm) {
    if (!editing) {
      return
    }
    await update(editing.id, value)
    setEditing(null)
  }

  async function confirmDelete() {
    if (!deleting) {
      return
    }
    setDeletingBusy(true)
    try {
      await remove(deleting.id)
      setDeleting(null)
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
        السجل
      </Typography>

      <LedgerFilterDraft
        key={search}
        search={search}
        onApply={applyFilters}
      />

      {loading ? <LoadingState label="جاري تحميل السجل…" /> : null}

      {!loading && error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            void reload()
          }}
        />
      ) : null}

      {!loading && !error ? (
        <TransactionList
          transactions={transactions}
          onEdit={setEditing}
          onDelete={setDeleting}
          onSelectPerson={(name) => {
            navigate(personPath(name))
          }}
        />
      ) : null}

      <Dialog
        open={Boolean(editing)}
        onClose={() => {
          setEditing(null)
        }}
        fullWidth
        maxWidth="sm"
        transitionDuration={0}
        aria-labelledby="edit-transaction-title"
      >
        <DialogTitle id="edit-transaction-title">تعديل المعاملة</DialogTitle>
        <DialogContent>
          <Stack sx={{ pt: 1 }}>
            {editing ? (
              <TransactionForm
                key={editing.id}
                nameSuggestions={nameSuggestions}
                initialTransaction={editing}
                submitLabel="حفظ التعديلات"
                onSubmit={handleUpdate}
                onCancel={() => {
                  setEditing(null)
                }}
              />
            ) : null}
          </Stack>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف المعاملة"
        description={
          deleting
            ? `هل تريد حذف معاملة ${deleting.name}؟ لا يمكن التراجع عن هذا الإجراء.`
            : ''
        }
        confirmLabel={deletingBusy ? 'جاري الحذف…' : 'حذف'}
        cancelLabel="إلغاء"
        onCancel={() => {
          if (!deletingBusy) {
            setDeleting(null)
          }
        }}
        onConfirm={() => {
          if (!deletingBusy) {
            void confirmDelete()
          }
        }}
      />
    </Stack>
  )
}
