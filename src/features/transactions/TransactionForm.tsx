import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useState, type FormEvent, type MouseEvent } from 'react'
import { ApiClientError } from '../../lib/api/client'
import { todayIsoDate } from '../../lib/format/date'
import {
  validateTransactionForm,
  type TransactionFormErrors,
  type TransactionFormValues,
  type ValidTransactionForm,
} from '../../lib/transaction/formValidation'
import { DIRECTION_LABELS, type Transaction } from '../../types/transaction'

type TransactionFormProps = {
  nameSuggestions: string[]
  initialTransaction?: Transaction | null
  /** Prefills the form (e.g. voice draft). Takes precedence over initialTransaction. */
  initialValues?: TransactionFormValues | null
  submitLabel?: string
  onSubmit: (value: ValidTransactionForm) => Promise<void>
  onCancel?: () => void
}

function toFormValues(transaction?: Transaction | null): TransactionFormValues {
  if (!transaction) {
    return {
      name: '',
      direction: '',
      amount: '',
      notes: '',
      transactionDate: todayIsoDate(),
    }
  }

  return {
    name: transaction.name,
    direction: transaction.direction,
    amount: String(transaction.amount),
    notes: transaction.notes ?? '',
    transactionDate: transaction.transactionDate,
  }
}

function resolveInitialValues(
  initialValues?: TransactionFormValues | null,
  initialTransaction?: Transaction | null,
): TransactionFormValues {
  if (initialValues) {
    return initialValues
  }
  return toFormValues(initialTransaction)
}

export function TransactionForm({
  nameSuggestions,
  initialTransaction = null,
  initialValues = null,
  submitLabel = 'حفظ المعاملة',
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const [values, setValues] = useState<TransactionFormValues>(() =>
    resolveInitialValues(initialValues, initialTransaction),
  )
  const [errors, setErrors] = useState<TransactionFormErrors>({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSuccess(null)
    setSubmitError(null)

    const result = validateTransactionForm(values)
    if (result.ok === false) {
      setErrors(result.errors)
      return
    }

    setErrors({})
    setSaving(true)

    try {
      await onSubmit(result.value)
      setSuccess(
        initialTransaction ? 'تم تحديث المعاملة' : 'تم حفظ المعاملة',
      )
      if (!initialTransaction) {
        setValues({
          name: '',
          direction: '',
          amount: '',
          notes: '',
          transactionDate: todayIsoDate(),
        })
      }
    } catch (cause) {
      setSubmitError(
        cause instanceof ApiClientError
          ? cause.message
          : 'تعذر حفظ المعاملة',
      )
    } finally {
      setSaving(false)
    }
  }

  function onDirectionChange(
    _event: MouseEvent<HTMLElement>,
    next: 'receivable' | 'payable' | null,
  ) {
    if (!next) {
      return
    }
    setValues((current) => ({ ...current, direction: next }))
  }

  return (
    <Stack component="form" onSubmit={handleSubmit} spacing={2.5} noValidate>
      <Autocomplete
        freeSolo
        options={nameSuggestions}
        inputValue={values.name}
        onInputChange={(_event, next) => {
          setValues((current) => ({ ...current, name: next }))
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="الاسم"
            error={Boolean(errors.name)}
            helperText={errors.name}
            slotProps={{
              ...params.slotProps,
              htmlInput: {
                ...params.slotProps.htmlInput,
                'aria-label': 'اسم الشخص',
              },
            }}
          />
        )}
      />

      <Stack spacing={1}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          النوع
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          color="primary"
          value={values.direction || null}
          onChange={onDirectionChange}
          aria-label="نوع المعاملة"
          sx={{
            '& .MuiToggleButton-root': {
              fontWeight: 700,
              py: 1.25,
              minHeight: 44,
            },
          }}
        >
          <ToggleButton value="receivable">
            {DIRECTION_LABELS.receivable}
          </ToggleButton>
          <ToggleButton value="payable">{DIRECTION_LABELS.payable}</ToggleButton>
        </ToggleButtonGroup>
        {errors.direction ? (
          <Typography variant="caption" color="error">
            {errors.direction}
          </Typography>
        ) : null}
      </Stack>

      <TextField
        label="المبلغ"
        value={values.amount}
        onChange={(event) => {
          setValues((current) => ({
            ...current,
            amount: event.target.value,
          }))
        }}
        required
        error={Boolean(errors.amount)}
        helperText={errors.amount}
        inputMode="numeric"
        slotProps={{
          htmlInput: {
            'aria-label': 'المبلغ',
            inputMode: 'numeric',
          },
        }}
      />

      <TextField
        label="ملاحظات"
        value={values.notes}
        onChange={(event) => {
          setValues((current) => ({
            ...current,
            notes: event.target.value,
          }))
        }}
        error={Boolean(errors.notes)}
        helperText={errors.notes ?? 'اختياري — مثل سكر أو تفاصيل إضافية'}
        multiline
        minRows={2}
        slotProps={{
          htmlInput: {
            'aria-label': 'ملاحظات',
          },
        }}
      />

      <TextField
        label="التاريخ"
        type="date"
        value={values.transactionDate}
        onChange={(event) => {
          setValues((current) => ({
            ...current,
            transactionDate: event.target.value,
          }))
        }}
        required
        error={Boolean(errors.transactionDate)}
        helperText={errors.transactionDate}
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: {
            'aria-label': 'تاريخ المعاملة',
          },
        }}
      />

      <TextField
        label="العملة"
        value="EGP"
        disabled
        helperText="الجنيه المصري فقط"
        slotProps={{
          htmlInput: {
            'aria-label': 'العملة',
          },
        }}
      />

      {success ? <Alert severity="success">{success}</Alert> : null}
      {submitError ? <Alert severity="error">{submitError}</Alert> : null}

      <Stack direction="row" spacing={1.5}>
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={saving}
          sx={{ fontWeight: 700, minHeight: 44 }}
        >
          {saving ? 'جاري الحفظ…' : submitLabel}
        </Button>
        {onCancel ? (
          <Button
            type="button"
            variant="outlined"
            color="inherit"
            size="large"
            onClick={onCancel}
            disabled={saving}
            sx={{ minHeight: 44 }}
          >
            إلغاء
          </Button>
        ) : null}
      </Stack>
    </Stack>
  )
}
