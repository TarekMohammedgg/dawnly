-- One-time sample ledger rows for initial verification.
-- Owner cleanup (run manually in SQL editor after confirming the app works):
--   DELETE FROM public.transactions
--   WHERE id IN (
--     '11111111-1111-4111-8111-111111111111',
--     '22222222-2222-4222-8222-222222222222',
--     '33333333-3333-4333-8333-333333333333'
--   );

INSERT INTO public.transactions (
  id,
  name,
  direction,
  amount,
  transaction_date,
  currency,
  created_at,
  updated_at
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'أحمد',
    'receivable',
    250,
    '2026-07-28',
    'EGP',
    '2026-07-28T10:00:00.000Z',
    '2026-07-28T10:00:00.000Z'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'سارة',
    'payable',
    100,
    '2026-07-27',
    'EGP',
    '2026-07-27T09:00:00.000Z',
    '2026-07-27T09:00:00.000Z'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'أحمد',
    'payable',
    50,
    '2026-07-26',
    'EGP',
    '2026-07-26T08:00:00.000Z',
    '2026-07-26T08:00:00.000Z'
  )
ON CONFLICT (id) DO NOTHING;
