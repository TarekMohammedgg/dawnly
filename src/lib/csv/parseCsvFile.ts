import Papa from 'papaparse'
import {
  CSV_HEADERS,
  CSV_MAX_FILE_BYTES,
  CSV_REQUIRED_HEADERS,
  CSV_SEPARATOR,
  CSV_UTF8_BOM,
} from './constants'

export type RawCsvRecord = Record<string, string>

export type CsvFileParseResult =
  | { ok: true; records: RawCsvRecord[]; headers: string[] }
  | { ok: false; message: string }

function stripBom(text: string): string {
  return text.startsWith(CSV_UTF8_BOM) ? text.slice(CSV_UTF8_BOM.length) : text
}

function trimCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  return String(value).trim()
}

function isBlankRecord(record: RawCsvRecord): boolean {
  return Object.values(record).every((value) => value.trim() === '')
}

function normalizeHeaders(fields: string[] | undefined): string[] {
  return (fields ?? []).map((field) => field.trim()).filter(Boolean)
}

function missingRequiredHeaders(headers: string[]): string[] {
  const present = new Set(headers)
  return CSV_REQUIRED_HEADERS.filter((header) => !present.has(header))
}

function isCsvTooLarge(text: string): boolean {
  return new TextEncoder().encode(text).byteLength > CSV_MAX_FILE_BYTES
}

/**
 * Parses a comma-separated CSV text in the browser.
 * Strips a UTF-8 BOM, trims headers/values, and ignores blank rows.
 */
export function parseCsvText(text: string): CsvFileParseResult {
  if (isCsvTooLarge(text)) {
    return { ok: false, message: 'ملف CSV كبير جداً' }
  }

  const cleaned = stripBom(text)
  if (!cleaned.trim()) {
    return { ok: false, message: 'تعذر قراءة الملف. تأكد أنه ملف CSV صالح' }
  }

  const parsed = Papa.parse<Record<string, unknown>>(cleaned, {
    header: true,
    skipEmptyLines: 'greedy',
    delimiter: CSV_SEPARATOR,
    transformHeader: (header) => header.trim(),
  })

  if (parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
    return { ok: false, message: 'تعذر قراءة الملف. تأكد أنه ملف CSV صالح' }
  }

  const headers = normalizeHeaders(parsed.meta.fields)
  const missing = missingRequiredHeaders(headers)
  if (missing.length > 0) {
    return {
      ok: false,
      message: `عناوين ناقصة: ${missing.join('، ')}. العناوين المطلوبة: الاسم، النوع، المبلغ، التاريخ`,
    }
  }

  const records: RawCsvRecord[] = []
  for (const row of parsed.data) {
    const record: RawCsvRecord = {
      [CSV_HEADERS.name]: trimCell(row[CSV_HEADERS.name]),
      [CSV_HEADERS.direction]: trimCell(row[CSV_HEADERS.direction]),
      [CSV_HEADERS.amount]: trimCell(row[CSV_HEADERS.amount]),
      [CSV_HEADERS.date]: trimCell(row[CSV_HEADERS.date]),
      [CSV_HEADERS.currency]: trimCell(row[CSV_HEADERS.currency]),
    }
    if (!isBlankRecord(record)) {
      records.push(record)
    }
  }

  if (records.length === 0) {
    return { ok: false, message: 'الملف لا يحتوي على صفوف للاستيراد' }
  }

  return { ok: true, records, headers }
}

/** Reads a single File as UTF-8 text then parses it as CSV. */
export async function parseCsvFile(file: File): Promise<CsvFileParseResult> {
  if (file.size > CSV_MAX_FILE_BYTES) {
    return { ok: false, message: 'ملف CSV كبير جداً' }
  }

  try {
    const text = await file.text()
    return parseCsvText(text)
  } catch {
    return { ok: false, message: 'تعذر قراءة الملف. تأكد أنه ملف CSV صالح' }
  }
}
