import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useId, useState, type ChangeEvent } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useAuthSession } from '../../lib/auth/sessionContext'
import { importParsedTransactions } from '../../lib/csv/importRows'
import { parseCsvFile } from '../../lib/csv/parseCsvFile'
import {
  buildPreviewFromRecords,
  collectValidImportPayloads,
  refreshPreviewRows,
} from '../../lib/csv/preview'
import type {
  CsvFieldKey,
  CsvPreviewRow,
  CsvPreviewSummary,
} from '../../lib/csv/types'
import { readCachedTransactions } from '../../lib/local/transactions'
import { ImportPreviewTable } from './ImportPreviewTable'

const EMPTY_SUMMARY: CsvPreviewSummary = {
  total: 0,
  valid: 0,
  invalid: 0,
  duplicate: 0,
}

function mapFieldKey(field: CsvFieldKey): keyof CsvPreviewRow {
  if (field === 'direction') {
    return 'directionLabel'
  }
  return field
}

export function ImportPage() {
  const { session } = useAuthSession()
  const fileInputId = useId()
  const [preview, setPreview] = useState<{
    rows: CsvPreviewRow[]
    summary: CsvPreviewSummary
  }>({ rows: [], summary: EMPTY_SUMMARY })
  const [parseError, setParseError] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    setParseError(null)
    setImportMessage(null)
    setImportError(null)
    setPreview({ rows: [], summary: EMPTY_SUMMARY })
    setFileName(null)

    if (!file) {
      return
    }

    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('اختر ملف CSV واحدًا فقط بفاصل فاصلة')
      return
    }

    const parsed = await parseCsvFile(file)
    if (parsed.ok === false) {
      setParseError(parsed.message)
      return
    }

    const existing = await readCachedTransactions({})
    const nextPreview = buildPreviewFromRecords(parsed.records, existing)
    if (nextPreview.ok === false) {
      setParseError(nextPreview.message)
      return
    }

    setFileName(file.name)
    setPreview({ rows: nextPreview.rows, summary: nextPreview.summary })
  }

  async function handleRowChange(
    rowId: string,
    field: CsvFieldKey,
    value: string,
  ) {
    const property = mapFieldKey(field)
    const existing = await readCachedTransactions({})
    setPreview((current) => {
      const nextRows = current.rows.map((row) =>
        row.id === rowId ? { ...row, [property]: value } : row,
      )
      return refreshPreviewRows(nextRows, existing)
    })
  }

  async function confirmImport() {
    setConfirmOpen(false)
    setImporting(true)
    setImportError(null)
    setImportMessage(null)

    try {
      const payloads = collectValidImportPayloads(preview.rows)
      if (payloads.length === 0) {
        setImportError('لا توجد صفوف صالحة للاستيراد')
        return
      }

      const imported = await importParsedTransactions(
        payloads,
        session?.token ?? null,
      )
      setImportMessage(`تم استيراد ${imported} معاملة. ستُحفظ تلقائيًا عند توفر الإنترنت.`)
      setPreview({ rows: [], summary: EMPTY_SUMMARY })
      setFileName(null)
    } catch {
      setImportError('تعذر استيراد الصفوف. حاول مرة أخرى.')
    } finally {
      setImporting(false)
    }
  }

  const { rows, summary } = preview

  return (
    <Stack spacing={2.5}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
        استيراد
      </Typography>

      <Stack spacing={1}>
        <Typography variant="body1">
          استورد ملف CSV واحدًا فقط. الفاصل المقبول هو الفاصلة فقط.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          العناوين المقبولة بالضبط: الاسم، النوع، المبلغ، التاريخ، العملة، ملاحظات.
          عمودا العملة والملاحظات اختياريان؛ إن كانت العملة فارغة تُستخدم EGP.
        </Typography>
      </Stack>

      <Button
        component="label"
        variant="contained"
        size="large"
        htmlFor={fileInputId}
        sx={{ alignSelf: 'start', fontWeight: 700 }}
      >
        اختيار ملف CSV
        <input
          id={fileInputId}
          type="file"
          accept=".csv,text/csv"
          hidden
          aria-label="ملف CSV"
          onChange={(event) => {
            void handleFileChange(event)
          }}
        />
      </Button>

      {fileName ? (
        <Typography variant="body2" color="text.secondary">
          الملف: {fileName}
        </Typography>
      ) : null}

      {parseError ? <Alert severity="error">{parseError}</Alert> : null}
      {importError ? <Alert severity="error">{importError}</Alert> : null}
      {importMessage ? <Alert severity="success">{importMessage}</Alert> : null}

      {rows.length > 0 ? (
        <Stack spacing={2}>
          <Alert severity="info">
            الإجمالي {summary.total} — صالح {summary.valid} — غير صالح{' '}
            {summary.invalid} — مكرر {summary.duplicate}
          </Alert>

          <ImportPreviewTable rows={rows} onChangeRow={(rowId, field, value) => {
            void handleRowChange(rowId, field, value)
          }} />

          <Button
            variant="contained"
            size="large"
            disabled={importing || summary.valid === 0}
            onClick={() => {
              setConfirmOpen(true)
            }}
            sx={{ alignSelf: 'start', fontWeight: 700 }}
          >
            تأكيد استيراد الصفوف الصالحة
          </Button>
        </Stack>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="تأكيد الاستيراد"
        description={`سيتم استيراد ${summary.valid} صف صالح فقط. الصفوف غير الصالحة والمكررة لن تُضاف.`}
        confirmLabel="استيراد"
        confirmColor="primary"
        onConfirm={() => {
          void confirmImport()
        }}
        onCancel={() => {
          setConfirmOpen(false)
        }}
      />
    </Stack>
  )
}
