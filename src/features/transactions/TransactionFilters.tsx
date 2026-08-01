import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
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

  const hasAdvancedFilters = Boolean(
    value.direction ||
      value.amount.trim() ||
      value.dateFrom ||
      value.dateTo ||
      !value.currency,
  )

  return (
    <Stack
      component="form"
      onSubmit={handleSubmit}
      spacing={1.5}
      aria-label="بحث وتصفية المعاملات"
    >
      <Paper
        variant="outlined"
        sx={{ p: 1.5, borderRadius: 3, bgcolor: 'background.paper' }}
      >
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 700 }}>
            بحث وتصفية
          </Typography>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            sx={{ alignItems: { sm: 'center' } }}
          >
            <TextField
              label="بحث بالاسم"
              value={value.name}
              onChange={(event) => {
                onChange({ ...value, name: event.target.value })
              }}
              fullWidth
              slotProps={{
                htmlInput: { 'aria-label': 'بحث بالاسم' },
              }}
              sx={{ flex: 1 }}
            />
            <Stack direction="row" spacing={1.25}>
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

          <Accordion
            disableGutters
            elevation={0}
            defaultExpanded={hasAdvancedFilters}
            sx={{
              bgcolor: 'transparent',
              '&::before': { display: 'none' },
              borderTop: 1,
              borderColor: 'divider',
              borderRadius: 0,
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreRoundedIcon />}
              sx={{
                px: 0,
                minHeight: 48,
                '& .MuiAccordionSummary-content': { my: 1 },
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TuneRoundedIcon fontSize="small" color="action" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    فلاتر إضافية
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    النوع، المبلغ، التاريخ، والعملة
                  </Typography>
                </Box>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pb: 0 }}>
              <Stack spacing={1.5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField
                    select
                    label="النوع"
                    value={value.direction}
                    onChange={(event) => {
                      const next = event.target.value
                      onChange({
                        ...value,
                        direction:
                          next === 'receivable' || next === 'payable'
                            ? next
                            : '',
                      })
                    }}
                    fullWidth
                    slotProps={{
                      htmlInput: { 'aria-label': 'تصفية حسب النوع' },
                    }}
                  >
                    <MenuItem value="">الكل</MenuItem>
                    <MenuItem value="receivable">
                      {DIRECTION_LABELS.receivable}
                    </MenuItem>
                    <MenuItem value="payable">
                      {DIRECTION_LABELS.payable}
                    </MenuItem>
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
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
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
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Stack>
      </Paper>
    </Stack>
  )
}
