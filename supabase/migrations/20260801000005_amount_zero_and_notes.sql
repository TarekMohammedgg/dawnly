-- Phase 6b: allow amount = 0 and optional notes (ملاحظات).
-- Rebuilds the dedupe unique index to include normalized notes.

ALTER TABLE public.transactions
  DROP CONSTRAINT transactions_amount_positive_integer;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_amount_nonnegative_integer
    CHECK (amount >= 0);

ALTER TABLE public.transactions
  ADD COLUMN notes text;

-- Empty strings are not stored; use NULL for absent notes.
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_notes_trimmed_or_null
    CHECK (
      notes IS NULL
      OR (length(btrim(notes)) > 0 AND notes = btrim(notes))
    );

DROP INDEX IF EXISTS public.transactions_dedupe_uidx;

-- Deduplication: name + direction + amount + date + notes.
-- NULL and missing notes compare equal via coalesce to empty string after normalize.
CREATE UNIQUE INDEX transactions_dedupe_uidx
  ON public.transactions (
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g')),
    direction,
    amount,
    transaction_date,
    lower(regexp_replace(btrim(coalesce(notes, '')), '\s+', ' ', 'g'))
  );

COMMENT ON COLUMN public.transactions.notes IS
  'Optional Arabic notes (ملاحظات) for in-kind items or extra detail; NULL when absent.';

COMMENT ON CONSTRAINT transactions_amount_nonnegative_integer ON public.transactions IS
  'Non-negative whole-number amount; zero allowed for non-monetary entries.';

COMMENT ON INDEX public.transactions_dedupe_uidx IS
  'Prevents duplicates on normalized name + direction + amount + transaction_date + normalized notes.';
