import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { ErrorState } from '../../components/ErrorState'
import { LoadingState } from '../../components/LoadingState'
import { ApiClientError } from '../../lib/api/client'
import { useAuthSession } from '../../lib/auth/sessionContext'
import { useAppRouter } from '../../lib/routing/routerContext'
import { personPath } from '../../lib/routing/routes'
import {
  summarizeDirections,
  uniqueSortedNames,
} from '../../lib/transaction/summaries'
import type {
  TransactionFormValues,
  ValidTransactionForm,
} from '../../lib/transaction/formValidation'
import { draftToFormValues } from '../../lib/voice/draftToFormValues'
import { extractTransactionFromTranscript } from '../../lib/voice/extractClient'
import type { TranscriptionResult } from '../../lib/voice/transcriptionProvider'
import { SummaryCards } from '../transactions/SummaryCards'
import { TransactionForm } from '../transactions/TransactionForm'
import { TransactionList } from '../transactions/TransactionList'
import { useTransactions } from '../transactions/useTransactions'
import { HoldToRecordButton } from '../voice/HoldToRecordButton'
import { VoiceReviewDialog } from '../voice/VoiceReviewDialog'

const RECENT_LIMIT = 5

export function DashboardPage() {
  const { navigate } = useAppRouter()
  const { session } = useAuthSession()
  const { transactions, loading, error, reload, create } = useTransactions()
  const [formOpen, setFormOpen] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [reviewTranscript, setReviewTranscript] = useState<string | null>(null)
  const [reviewValues, setReviewValues] = useState<TransactionFormValues | null>(
    null,
  )

  const totals = summarizeDirections(transactions)
  const recent = transactions.slice(0, RECENT_LIMIT)
  const nameSuggestions = uniqueSortedNames(transactions)

  function clearVoiceState() {
    setReviewTranscript(null)
    setReviewValues(null)
    setVoiceError(null)
    setExtracting(false)
  }

  async function handleCreate(value: ValidTransactionForm) {
    await create(value)
    setFormOpen(false)
  }

  async function handleVoiceConfirm(value: ValidTransactionForm) {
    await create(value)
    clearVoiceState()
  }

  async function handleTranscript(result: TranscriptionResult) {
    if (!session?.token) {
      setVoiceError('يلزم تسجيل الدخول بالرقم السري')
      return
    }

    setVoiceError(null)
    setExtracting(true)

    try {
      const response = await extractTransactionFromTranscript(
        session.token,
        result.transcript,
      )
      setReviewTranscript(response.transcript)
      setReviewValues(draftToFormValues(response.draft))
    } catch (cause) {
      setVoiceError(
        cause instanceof ApiClientError
          ? cause.message
          : 'تعذر تحليل التسجيل الصوتي',
      )
    } finally {
      setExtracting(false)
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
        الرئيسية
      </Typography>

      {loading ? <LoadingState label="جاري تحميل الرئيسية…" /> : null}

      {!loading && error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            void reload()
          }}
        />
      ) : null}

      {!loading && !error ? (
        <>
          <SummaryCards
            receivableTotal={totals.receivable}
            payableTotal={totals.payable}
          />

          <Button
            variant="contained"
            size="large"
            onClick={() => {
              setFormOpen(true)
            }}
            sx={{ fontWeight: 700, minHeight: 48, alignSelf: 'stretch' }}
          >
            إضافة معاملة
          </Button>

          <HoldToRecordButton
            disabled={extracting}
            onTranscript={(result) => {
              void handleTranscript(result)
            }}
            onUnsupportedManual={() => {
              setFormOpen(true)
            }}
            onError={setVoiceError}
          />

          {extracting ? (
            <Alert severity="info">جاري تحليل التسجيل…</Alert>
          ) : null}
          {voiceError ? <Alert severity="error">{voiceError}</Alert> : null}

          <Stack spacing={1.5}>
            <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }}>
              أحدث المعاملات
            </Typography>
            <TransactionList
              transactions={recent}
              emptyTitle="لا توجد معاملات بعد"
              emptyDescription="ستظهر هنا إجماليات ليّا وعليّا بعد إضافة المعاملات."
              onSelectPerson={(name) => {
                navigate(personPath(name))
              }}
            />
          </Stack>

          <Dialog
            open={formOpen}
            onClose={() => {
              setFormOpen(false)
            }}
            fullWidth
            maxWidth="sm"
            transitionDuration={0}
            aria-labelledby="add-transaction-title"
          >
            <DialogTitle id="add-transaction-title">إضافة معاملة</DialogTitle>
            <DialogContent>
              <Stack sx={{ pt: 1 }}>
                <TransactionForm
                  nameSuggestions={nameSuggestions}
                  onSubmit={handleCreate}
                  onCancel={() => {
                    setFormOpen(false)
                  }}
                />
              </Stack>
            </DialogContent>
          </Dialog>

          {reviewTranscript && reviewValues ? (
            <VoiceReviewDialog
              open
              transcript={reviewTranscript}
              initialValues={reviewValues}
              nameSuggestions={nameSuggestions}
              onConfirm={handleVoiceConfirm}
              onCancel={clearVoiceState}
            />
          ) : null}
        </>
      ) : null}
    </Stack>
  )
}
