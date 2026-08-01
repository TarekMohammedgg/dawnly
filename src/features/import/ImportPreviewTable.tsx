import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { CsvFieldKey, CsvPreviewRow } from '../../lib/csv/types'
import { DIRECTION_LABELS } from '../../types/transaction'

type ImportPreviewTableProps = {
  rows: CsvPreviewRow[]
  onChangeRow: (rowId: string, field: CsvFieldKey, value: string) => void
}

const STATUS_LABELS: Record<CsvPreviewRow['status'], string> = {
  valid: 'صالح',
  invalid: 'غير صالح',
  duplicate: 'مكرر',
}

function statusHint(row: CsvPreviewRow): string {
  if (row.status === 'duplicate') {
    return row.duplicateSource === 'existing'
      ? 'موجودة مسبقًا'
      : 'مكررة داخل الملف'
  }
  if (row.status === 'invalid') {
    const firstError = Object.values(row.fieldErrors)[0]
    return firstError ?? 'تحقق من الحقول'
  }
  return 'جاهزة للاستيراد'
}

export function ImportPreviewTable({
  rows,
  onChangeRow,
}: ImportPreviewTableProps) {
  return (
    <TableContainer
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        maxHeight: 480,
        overflow: 'auto',
      }}
    >
      <Table stickyHeader size="small" aria-label="معاينة صفوف الاستيراد">
        <TableHead>
          <TableRow>
            <TableCell>الحالة</TableCell>
            <TableCell>الاسم</TableCell>
            <TableCell>النوع</TableCell>
            <TableCell>المبلغ</TableCell>
            <TableCell>التاريخ</TableCell>
            <TableCell>العملة</TableCell>
            <TableCell>ملاحظات</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              sx={{
                bgcolor:
                  row.status === 'valid'
                    ? 'transparent'
                    : row.status === 'duplicate'
                      ? 'action.hover'
                      : 'error.light',
              }}
            >
              <TableCell sx={{ minWidth: 120, verticalAlign: 'top' }}>
                <Stack spacing={0.5}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {STATUS_LABELS[row.status]}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {statusHint(row)}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell sx={{ minWidth: 140, verticalAlign: 'top' }}>
                <TextField
                  size="small"
                  fullWidth
                  value={row.name}
                  onChange={(event) => {
                    onChangeRow(row.id, 'name', event.target.value)
                  }}
                  error={Boolean(row.fieldErrors.name)}
                  helperText={row.fieldErrors.name}
                  slotProps={{
                    htmlInput: {
                      'aria-label': `الاسم للصف ${row.sourceIndex}`,
                    },
                  }}
                />
              </TableCell>
              <TableCell sx={{ minWidth: 120, verticalAlign: 'top' }}>
                <TextField
                  select
                  size="small"
                  fullWidth
                  value={
                    row.directionLabel === DIRECTION_LABELS.receivable ||
                    row.directionLabel === DIRECTION_LABELS.payable
                      ? row.directionLabel
                      : ''
                  }
                  onChange={(event) => {
                    onChangeRow(row.id, 'direction', event.target.value)
                  }}
                  error={Boolean(row.fieldErrors.direction)}
                  helperText={row.fieldErrors.direction}
                  slotProps={{
                    htmlInput: {
                      'aria-label': `النوع للصف ${row.sourceIndex}`,
                    },
                  }}
                >
                  <MenuItem value={DIRECTION_LABELS.receivable}>
                    {DIRECTION_LABELS.receivable}
                  </MenuItem>
                  <MenuItem value={DIRECTION_LABELS.payable}>
                    {DIRECTION_LABELS.payable}
                  </MenuItem>
                </TextField>
              </TableCell>
              <TableCell sx={{ minWidth: 110, verticalAlign: 'top' }}>
                <TextField
                  size="small"
                  fullWidth
                  value={row.amount}
                  onChange={(event) => {
                    onChangeRow(row.id, 'amount', event.target.value)
                  }}
                  error={Boolean(row.fieldErrors.amount)}
                  helperText={row.fieldErrors.amount}
                  slotProps={{
                    htmlInput: {
                      inputMode: 'numeric',
                      'aria-label': `المبلغ للصف ${row.sourceIndex}`,
                    },
                  }}
                />
              </TableCell>
              <TableCell sx={{ minWidth: 140, verticalAlign: 'top' }}>
                <TextField
                  size="small"
                  fullWidth
                  value={row.transactionDate}
                  onChange={(event) => {
                    onChangeRow(row.id, 'transactionDate', event.target.value)
                  }}
                  error={Boolean(row.fieldErrors.transactionDate)}
                  helperText={row.fieldErrors.transactionDate}
                  placeholder="يوم/شهر/سنة"
                  slotProps={{
                    htmlInput: {
                      'aria-label': `التاريخ للصف ${row.sourceIndex}`,
                    },
                  }}
                />
              </TableCell>
              <TableCell sx={{ minWidth: 100, verticalAlign: 'top' }}>
                <TextField
                  size="small"
                  fullWidth
                  value={row.currency}
                  onChange={(event) => {
                    onChangeRow(row.id, 'currency', event.target.value)
                  }}
                  error={Boolean(row.fieldErrors.currency)}
                  helperText={row.fieldErrors.currency}
                  slotProps={{
                    htmlInput: {
                      'aria-label': `العملة للصف ${row.sourceIndex}`,
                    },
                  }}
                />
              </TableCell>
              <TableCell sx={{ minWidth: 160, verticalAlign: 'top' }}>
                <TextField
                  size="small"
                  fullWidth
                  value={row.notes}
                  onChange={(event) => {
                    onChangeRow(row.id, 'notes', event.target.value)
                  }}
                  error={Boolean(row.fieldErrors.notes)}
                  helperText={row.fieldErrors.notes}
                  slotProps={{
                    htmlInput: {
                      'aria-label': `ملاحظات للصف ${row.sourceIndex}`,
                    },
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
