import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleTransactions } from '../../test/fixtures/transactions'
import { CSV_MAX_FILE_BYTES, CSV_UTF8_BOM } from './constants'
import { buildTransactionsCsv } from './exportCsv'
import { importParsedTransactions } from './importRows'
import { parseCsvText } from './parseCsvFile'
import {
  buildPreviewFromRecords,
  collectValidImportPayloads,
  refreshPreviewRows,
} from './preview'
import { validateCsvRow } from './validateCsvRow'
import { clearLocalDatabase, dawnlyDb } from '../local/database'
import { readCachedTransactions } from '../local/transactions'

const VALID_HEADER =
  'الاسم,النوع,المبلغ,التاريخ,العملة'

function csv(...lines: string[]): string {
  return [VALID_HEADER, ...lines].join('\n')
}

describe('parseCsvText', () => {
  it('rejects missing required headers in Arabic', () => {
    const result = parseCsvText('الاسم,المبلغ\nأحمد,50')
    expect(result.ok).toBe(false)
    if (result.ok === true) {
      return
    }
    expect(result.message).toContain('عناوين ناقصة')
    expect(result.message).toContain('النوع')
  })

  it('strips a UTF-8 BOM and ignores blank rows', () => {
    const result = parseCsvText(
      `${CSV_UTF8_BOM}${csv('أحمد,ليّا,50,01/08/2026,EGP', '', '  , , , ,  ')}`,
    )
    expect(result.ok).toBe(true)
    if (result.ok === false) {
      return
    }
    expect(result.records).toHaveLength(1)
    expect(result.records[0]?.['الاسم']).toBe('أحمد')
  })

  it('rejects CSV text over the file-size limit before parsing', () => {
    const result = parseCsvText('x'.repeat(CSV_MAX_FILE_BYTES + 1))
    expect(result).toEqual({ ok: false, message: 'ملف CSV كبير جداً' })
  })
})

describe('validateCsvRow', () => {
  it('fills blank currency as EGP and accepts Arabic digits and zero amounts', () => {
    const result = validateCsvRow({
      name: '  أحمد  ',
      directionLabel: 'ليّا',
      amount: '٥٠',
      transactionDate: '01/08/2026',
      currency: '',
      notes: '',
    })
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'أحمد',
        direction: 'receivable',
        amount: 50,
        notes: null,
        transactionDate: '2026-08-01',
        currency: 'EGP',
      },
    })

    expect(
      validateCsvRow({
        name: 'محمود',
        directionLabel: 'عليّا',
        amount: '0',
        transactionDate: '01/08/2026',
        currency: 'EGP',
        notes: 'كيس سكر',
      }),
    ).toEqual({
      ok: true,
      value: {
        name: 'محمود',
        direction: 'payable',
        amount: 0,
        notes: 'كيس سكر',
        transactionDate: '2026-08-01',
        currency: 'EGP',
      },
    })
  })

  it('rejects non-EGP currency, invalid dates, and non-whole amounts', () => {
    expect(
      validateCsvRow({
        name: 'أحمد',
        directionLabel: 'ليّا',
        amount: '50',
        transactionDate: '01/08/2026',
        currency: 'USD',
        notes: '',
      }).ok,
    ).toBe(false)

    expect(
      validateCsvRow({
        name: 'أحمد',
        directionLabel: 'عليّا',
        amount: '10',
        transactionDate: '32/08/2026',
        currency: 'EGP',
        notes: '',
      }).ok,
    ).toBe(false)

    expect(
      validateCsvRow({
        name: 'أحمد',
        directionLabel: 'عليّا',
        amount: '10.5',
        transactionDate: '01/08/2026',
        currency: 'EGP',
        notes: '',
      }).ok,
    ).toBe(false)

    expect(
      validateCsvRow({
        name: 'أحمد',
        directionLabel: 'مدين',
        amount: '10',
        transactionDate: '01/08/2026',
        currency: 'EGP',
        notes: '',
      }).ok,
    ).toBe(false)
  })
})

describe('preview duplicates and edits', () => {
  it('flags in-file and existing duplicates without blocking differing date or direction', () => {
    const parsed = parseCsvText(
      csv(
        'أحمد,ليّا,250,28/07/2026,EGP',
        'نورة,ليّا,40,01/08/2026,EGP',
        'نورة,ليّا,40,01/08/2026,EGP',
        'أحمد,عليّا,250,28/07/2026,EGP',
        'أحمد,ليّا,250,29/07/2026,EGP',
      ),
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok === false) {
      return
    }

    const preview = buildPreviewFromRecords(parsed.records, sampleTransactions)
    expect(preview.ok).toBe(true)
    if (preview.ok === false) {
      return
    }

    expect(preview.summary).toEqual({
      total: 5,
      valid: 3,
      invalid: 0,
      duplicate: 2,
    })
    expect(preview.rows[0]?.status).toBe('duplicate')
    expect(preview.rows[0]?.duplicateSource).toBe('existing')
    expect(preview.rows[1]?.status).toBe('valid')
    expect(preview.rows[2]?.status).toBe('duplicate')
    expect(preview.rows[2]?.duplicateSource).toBe('csv')
    expect(preview.rows[3]?.status).toBe('valid')
    expect(preview.rows[4]?.status).toBe('valid')
  })

  it('revalidates edited preview rows before import', () => {
    const parsed = parseCsvText(csv(' ,ليّا,50,01/08/2026,EGP'))
    expect(parsed.ok).toBe(true)
    if (parsed.ok === false) {
      return
    }

    const preview = buildPreviewFromRecords(parsed.records, [])
    expect(preview.ok).toBe(true)
    if (preview.ok === false) {
      return
    }
    expect(preview.rows[0]?.status).toBe('invalid')

    const edited = [
      {
        ...preview.rows[0]!,
        name: 'منى',
      },
    ]
    const refreshed = refreshPreviewRows(edited, [])
    expect(refreshed.rows[0]?.status).toBe('valid')
    expect(collectValidImportPayloads(refreshed.rows)).toEqual([
      {
        name: 'منى',
        direction: 'receivable',
        amount: 50,
        notes: null,
        transactionDate: '2026-08-01',
        currency: 'EGP',
      },
    ])
  })
})

describe('exportCsv', () => {
  it('emits UTF-8 BOM, Arabic headers, comma separator, newest-first EGP rows', () => {
    const csvText = buildTransactionsCsv(sampleTransactions)
    expect(csvText.startsWith(CSV_UTF8_BOM)).toBe(true)

    const body = csvText.slice(CSV_UTF8_BOM.length)
    const lines = body.trimEnd().split('\n')
    expect(lines[0]).toBe('الاسم,النوع,المبلغ,التاريخ,العملة,ملاحظات')
    expect(lines[1]).toBe('أحمد,ليّا,250,28/07/2026,EGP,')
    expect(lines[2]).toBe('سارة,عليّا,100,27/07/2026,EGP,')
    expect(lines[3]).toBe('أحمد,عليّا,50,26/07/2026,EGP,')
  })

  it('prefixes formula-like names and notes with a tab', () => {
    const csvText = buildTransactionsCsv([
      {
        ...sampleTransactions[0]!,
        name: '=HYPERLINK("https://example.com")',
        notes: '@SUM(1,2)',
      },
    ])

    expect(csvText).toContain('\t=HYPERLINK')
    expect(csvText).toContain('\t@SUM')
  })
})

describe('importParsedTransactions', () => {
  beforeEach(async () => {
    await clearLocalDatabase()
  })

  afterEach(async () => {
    await clearLocalDatabase()
    vi.unstubAllGlobals()
  })

  it('queues local creates offline without requiring the network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline')
      }),
    )

    const imported = await importParsedTransactions(
      [
        {
          name: 'منى',
          direction: 'receivable',
          amount: 75,
          notes: null,
          transactionDate: '2026-08-01',
          currency: 'EGP',
        },
      ],
      'test-token',
    )

    expect(imported).toBe(1)
    const cached = await readCachedTransactions({})
    expect(cached).toHaveLength(1)
    expect(cached[0]?.name).toBe('منى')
    const local = await dawnlyDb.transactions.toArray()
    expect(local[0]?.syncState).toBe('pending')
    const pending = await dawnlyDb.pendingMutations.count()
    expect(pending).toBe(1)
  })
})
