import AddRoundedIcon from '@mui/icons-material/AddRounded'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
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
    <Stack spacing={{ xs: 2.5, sm: 3 }}>
      <Stack spacing={0.75}>
        <Typography
          variant="overline"
          component="h2"
          sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.08em' }}
        >
          الرئيسية
        </Typography>
        <Typography variant="h4" component="p">
          حساباتك واضحة وهادية.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          سجّل اللي ليك واللي عليك بالطريقة اللي تريحك.
        </Typography>
      </Stack>

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

          <Button
            variant="outlined"
            color="primary"
            size="large"
            startIcon={<AddRoundedIcon />}
            onClick={() => {
              setFormOpen(true)
            }}
            sx={{ minHeight: 52, alignSelf: 'stretch' }}
          >
            إضافة معاملة
          </Button>

          {extracting ? (
            <Alert severity="info">جاري تحليل التسجيل…</Alert>
          ) : null}
          {voiceError ? <Alert severity="error">{voiceError}</Alert> : null}

          <Paper
            variant="outlined"
            sx={{
              overflow: 'hidden',
              borderRadius: 4,
              bgcolor: 'background.paper',
            }}
          >
            <Box sx={{ px: 2, pt: 2, pb: 1 }}>
              <Typography variant="h6" component="h3">
                أحدث المعاملات
              </Typography>
              <Typography variant="caption" color="text.secondary">
                آخر ما تم تسجيله
              </Typography>
            </Box>
            <TransactionList
              transactions={recent}
              emptyTitle="لا توجد معاملات بعد"
              emptyDescription="ستظهر هنا إجماليات ليّا وعليّا بعد إضافة المعاملات."
              onSelectPerson={(name) => {
                navigate(personPath(name))
              }}
            />
          </Paper>

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
