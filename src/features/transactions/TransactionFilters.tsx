import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { FormEvent } from 'react'
import {
  EMPTY_LEDGER_FILTERS,
  type LedgerFilters,
} from '../../lib/routing/ledgerFilters'
import { DIRECTION_LABELS } from '../../types/transaction'

type TransactionFiltersProps = {
  value: LedgerFilters
  onChange: (next: LedgerFilters) => void
  onApply: (next: LedgerFilters) => void
}

export function TransactionFilters({
  value,
  onChange,
  onApply,
}: TransactionFiltersProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onApply(value)
  }

  function clearFilters() {
    const cleared = { ...EMPTY_LEDGER_FILTERS }
    onChange(cleared)
    onApply(cleared)
  }

  return (
    <Stack
      component="form"
      onSubmit={handleSubmit}
      spacing={2}
      aria-label="بحث وتصفية المعاملات"
    >
      <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }}>
        بحث وتصفية
      </Typography>

      <TextField
        label="الاسم"
        value={value.name}
        onChange={(event) => {
          onChange({ ...value, name: event.target.value })
        }}
        fullWidth
        slotProps={{
          htmlInput: { 'aria-label': 'بحث بالاسم' },
        }}
      />

      <TextField
        select
        label="النوع"
        value={value.direction}
        onChange={(event) => {
          const next = event.target.value
          onChange({
            ...value,
            direction:
              next === 'receivable' || next === 'payable' ? next : '',
          })
        }}
        fullWidth
        slotProps={{
          htmlInput: { 'aria-label': 'تصفية حسب النوع' },
        }}
      >
        <MenuItem value="">الكل</MenuItem>
        <MenuItem value="receivable">{DIRECTION_LABELS.receivable}</MenuItem>
        <MenuItem value="payable">{DIRECTION_LABELS.payable}</MenuItem>
      </TextField>

      <TextField
        label="المبلغ"
        value={value.amount}
        onChange={(event) => {
          onChange({ ...value, amount: event.target.value })
        }}
        fullWidth
        inputMode="numeric"
        slotProps={{
          htmlInput: {
            'aria-label': 'تصفية حسب المبلغ',
            inputMode: 'numeric',
          },
        }}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="من تاريخ"
          type="date"
          value={value.dateFrom}
          onChange={(event) => {
            onChange({ ...value, dateFrom: event.target.value })
          }}
          fullWidth
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'aria-label': 'من تاريخ' },
          }}
        />
        <TextField
          label="إلى تاريخ"
          type="date"
          value={value.dateTo}
          onChange={(event) => {
            onChange({ ...value, dateTo: event.target.value })
          }}
          fullWidth
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { 'aria-label': 'إلى تاريخ' },
          }}
        />
      </Stack>

      <TextField
        select
        label="العملة"
        value={value.currency || 'EGP'}
        onChange={(event) => {
          onChange({
            ...value,
            currency: event.target.value === 'EGP' ? 'EGP' : '',
          })
        }}
        fullWidth
        slotProps={{
          htmlInput: { 'aria-label': 'العملة' },
        }}
      >
        <MenuItem value="EGP">EGP</MenuItem>
      </TextField>

      <Stack direction="row" spacing={1.5}>
        <Button
          type="submit"
          variant="contained"
          sx={{ fontWeight: 700, minHeight: 44 }}
        >
          تطبيق
        </Button>
        <Button
          type="button"
          variant="outlined"
          color="inherit"
          onClick={clearFilters}
          sx={{ minHeight: 44 }}
        >
          مسح
        </Button>
      </Stack>
    </Stack>
  )
}
