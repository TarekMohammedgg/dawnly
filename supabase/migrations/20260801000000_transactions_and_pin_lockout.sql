-- Dawnly Phase 2 schema: transactions + PIN lockout state.
-- Indexes and constraints are documented inline below.
-- Apply once via migration; do not re-run as a seed.

-- Direction enum: receivable = ليّا, payable = عليّا
CREATE TYPE public.transaction_direction AS ENUM ('receivable', 'payable');

-- Primary ledger table (PRD §9).
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  direction public.transaction_direction NOT NULL,
  amount integer NOT NULL,
  transaction_date date NOT NULL,
  currency text NOT NULL DEFAULT 'EGP',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Trimmed non-empty person name (whitespace-only rejected).
  CONSTRAINT transactions_name_trimmed_nonempty
    CHECK (length(btrim(name)) > 0 AND name = btrim(name)),

  -- Positive whole-number amount only (rejects 0, negatives, negatives).
  CONSTRAINT transactions_amount_positive_integer
    CHECK (amount > 0),

  -- Currency is fixed to Egyptian pounds.
  CONSTRAINT transactions_currency_egp
    CHECK (currency = 'EGP')
);

-- Deduplication: identical name + direction + amount + date is rejected.
-- Name is compared after lowercasing and collapsing internal whitespace.
CREATE UNIQUE INDEX transactions_dedupe_uidx
  ON public.transactions (
    lower(regexp_replace(btrim(name), '\s+', ' ', 'g')),
    direction,
    amount,
    transaction_date
  );

-- Common list/filter support (newest-first ledger queries).
CREATE INDEX transactions_transaction_date_idx
  ON public.transactions (transaction_date DESC);

CREATE INDEX transactions_created_at_idx
  ON public.transactions (created_at DESC);

CREATE INDEX transactions_name_normalized_idx
  ON public.transactions (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));

-- Keep updated_at current on every row change (conflict / sync field).
CREATE OR REPLACE FUNCTION public.set_transactions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_transactions_updated_at();

-- RLS: no policies → anonymous/authenticated JWT clients cannot read or write.
-- Server routes use the secret (service-role) key only after Dawnly session auth.
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

-- Server-only PIN lockout state. A page reload must not clear lockout.
-- Cleanup: rows older than 24h with locked_until in the past may be deleted by
-- the verify-pin handler (optional) or left; a single-row store is expected.
CREATE TABLE public.pin_attempt_state (
  id text PRIMARY KEY DEFAULT 'default',
  failed_attempts integer NOT NULL DEFAULT 0
    CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pin_attempt_state_singleton CHECK (id = 'default')
);

ALTER TABLE public.pin_attempt_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_attempt_state FORCE ROW LEVEL SECURITY;

INSERT INTO public.pin_attempt_state (id, failed_attempts, locked_until)
VALUES ('default', 0, NULL)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.transactions IS
  'Personal ledger entries. Access only via Dawnly Vercel API with secret key.';
COMMENT ON TABLE public.pin_attempt_state IS
  'Server-only PIN failure/lockout counter. No client policies; service role only.';
COMMENT ON INDEX public.transactions_dedupe_uidx IS
  'Prevents duplicates on normalized name + direction + amount + transaction_date.';
