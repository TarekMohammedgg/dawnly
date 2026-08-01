-- Dawnly Phase 4 idempotency receipts.
-- A client mutation ID is stored once with the authoritative server snapshot.
-- Retention: the owner may remove receipts older than the local queue horizon
-- after confirming no browser still has pending mutations from that period.

CREATE TABLE public.transaction_mutation_receipts (
  client_mutation_id uuid PRIMARY KEY,
  operation text NOT NULL,
  transaction_id uuid NOT NULL,
  snapshot jsonb,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT transaction_mutation_receipts_operation
    CHECK (operation IN ('create', 'update', 'delete')),
  CONSTRAINT transaction_mutation_receipts_snapshot_state
    CHECK ((deleted AND snapshot IS NULL) OR (NOT deleted AND snapshot IS NOT NULL))
);

CREATE INDEX transaction_mutation_receipts_created_at_idx
  ON public.transaction_mutation_receipts (created_at DESC);

ALTER TABLE public.transaction_mutation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_mutation_receipts FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE public.transaction_mutation_receipts IS
  'Server-only idempotency snapshots for local-first transaction mutations.';
COMMENT ON INDEX public.transaction_mutation_receipts_created_at_idx IS
  'Supports owner-controlled cleanup of old idempotency receipts.';
