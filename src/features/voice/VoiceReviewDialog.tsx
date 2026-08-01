import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { TransactionForm } from '../transactions/TransactionForm'
import type { ValidTransactionForm } from '../../lib/transaction/formValidation'
import type { TransactionFormValues } from '../../lib/transaction/formValidation'

type VoiceReviewDialogProps = {
  open: boolean
  transcript: string
  initialValues: TransactionFormValues
  nameSuggestions: string[]
  onConfirm: (value: ValidTransactionForm) => Promise<void>
  onCancel: () => void
}

export function VoiceReviewDialog({
  open,
  transcript,
  initialValues,
  nameSuggestions,
  onConfirm,
  onCancel,
}: VoiceReviewDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      fullWidth
      maxWidth="sm"
      transitionDuration={0}
      aria-labelledby="voice-review-title"
    >
      <DialogTitle id="voice-review-title">مراجعة التسجيل الصوتي</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Alert severity="info">
            راجع الحقول المستخرجة قبل التأكيد. لن تُحفظ المعاملة إلا بعد الضغط على
            تأكيد الحفظ.
          </Alert>
          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              النص المسجّل
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {transcript}
            </Typography>
          </Stack>
          <TransactionForm
            key={`${transcript}:${initialValues.name}:${initialValues.amount}`}
            nameSuggestions={nameSuggestions}
            initialValues={initialValues}
            submitLabel="تأكيد الحفظ"
            onSubmit={onConfirm}
            onCancel={onCancel}
          />
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
