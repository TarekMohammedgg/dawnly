import type { Transaction } from '../../types/transaction'

/** Sample ledger rows for UI and unit tests only. Never seed Supabase from here. */
export const sampleTransactions: Transaction[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'أحمد',
    direction: 'receivable',
    amount: 250,
    notes: null,
    transactionDate: '2026-07-28',
    currency: 'EGP',
    createdAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-07-28T10:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'سارة',
    direction: 'payable',
    amount: 100,
    notes: null,
    transactionDate: '2026-07-27',
    currency: 'EGP',
    createdAt: '2026-07-27T09:00:00.000Z',
    updatedAt: '2026-07-27T09:00:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'أحمد',
    direction: 'payable',
    amount: 50,
    notes: null,
    transactionDate: '2026-07-26',
    currency: 'EGP',
    createdAt: '2026-07-26T08:00:00.000Z',
    updatedAt: '2026-07-26T08:00:00.000Z',
  },
]
