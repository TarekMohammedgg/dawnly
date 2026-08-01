/** Exact Arabic CSV headers accepted by Dawnly import/export. */
export const CSV_HEADERS = {
  name: 'الاسم',
  direction: 'النوع',
  amount: 'المبلغ',
  date: 'التاريخ',
  currency: 'العملة',
  notes: 'ملاحظات',
} as const

export const CSV_REQUIRED_HEADERS = [
  CSV_HEADERS.name,
  CSV_HEADERS.direction,
  CSV_HEADERS.amount,
  CSV_HEADERS.date,
] as const

export const CSV_EXPORT_HEADERS = [
  CSV_HEADERS.name,
  CSV_HEADERS.direction,
  CSV_HEADERS.amount,
  CSV_HEADERS.date,
  CSV_HEADERS.currency,
  CSV_HEADERS.notes,
] as const

export const CSV_UTF8_BOM = '\uFEFF'

export const CSV_SEPARATOR = ','
