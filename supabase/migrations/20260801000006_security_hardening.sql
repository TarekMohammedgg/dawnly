-- Security hardening for authentication and AI extraction.
-- These tables are server-only. The browser never receives their contents.

CREATE OR REPLACE FUNCTION public.dawnly_record_pin_attempt(
  p_pin_accepted boolean,
  p_attempt_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  attempt_at timestamptz := COALESCE(p_attempt_at, now());
  failed_attempts integer;
  locked_until timestamptz;
  next_failed_attempts integer;
  next_locked_until timestamptz;
BEGIN
  IF p_pin_accepted IS NULL THEN
    RAISE EXCEPTION 'invalid_pin_attempt'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.pin_attempt_state (
    id,
    failed_attempts,
    locked_until,
    updated_at
  )
  VALUES ('default', 0, NULL, attempt_at)
  ON CONFLICT (id) DO NOTHING;

  SELECT s.failed_attempts, s.locked_until
  INTO failed_attempts, locked_until
  FROM public.pin_attempt_state AS s
  WHERE s.id = 'default'
  FOR UPDATE;

  IF locked_until IS NOT NULL AND locked_until > attempt_at THEN
    RETURN jsonb_build_object(
      'status', 'locked',
      'locked_until', locked_until,
      'retry_after_seconds', GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (locked_until - attempt_at)))::integer
      )
    );
  END IF;

  IF p_pin_accepted THEN
    UPDATE public.pin_attempt_state
    SET failed_attempts = 0,
        locked_until = NULL,
        updated_at = attempt_at
    WHERE id = 'default';

    RETURN jsonb_build_object('status', 'accepted');
  END IF;

  IF locked_until IS NOT NULL AND locked_until <= attempt_at THEN
    failed_attempts := 0;
  END IF;

  next_failed_attempts := failed_attempts + 1;
  next_locked_until := CASE
    WHEN next_failed_attempts >= 5 THEN attempt_at + INTERVAL '60 seconds'
    ELSE NULL
  END;

  UPDATE public.pin_attempt_state
  SET failed_attempts = next_failed_attempts,
      locked_until = next_locked_until,
      updated_at = attempt_at
  WHERE id = 'default';

  IF next_locked_until IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'locked',
      'locked_until', next_locked_until,
      'retry_after_seconds', 60
    );
  END IF;

  RETURN jsonb_build_object('status', 'invalid');
END;
$$;

COMMENT ON FUNCTION public.dawnly_record_pin_attempt(boolean, timestamptz) IS
  'Atomically records a PIN result and enforces the five-failure, one-minute lockout.';

REVOKE ALL ON FUNCTION public.dawnly_record_pin_attempt(boolean, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dawnly_record_pin_attempt(boolean, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dawnly_record_pin_attempt(boolean, timestamptz) TO service_role;

CREATE TABLE public.ai_extract_rate_limits (
  key_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ai_extract_rate_limits_key_hash_sha256
    CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ai_extract_rate_limits_request_count_nonnegative
    CHECK (request_count >= 0)
);

CREATE INDEX ai_extract_rate_limits_updated_at_idx
  ON public.ai_extract_rate_limits (updated_at);

ALTER TABLE public.ai_extract_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_extract_rate_limits FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ai_extract_rate_limits IS
  'Server-only AI extraction windows keyed by a SHA-256 session-token digest.';

CREATE OR REPLACE FUNCTION public.dawnly_allow_ai_extract(
  p_key_hash text,
  p_request_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  request_at timestamptz := COALESCE(p_request_at, now());
  window_started_at timestamptz;
  request_count integer;
BEGIN
  IF p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_ai_rate_limit_key'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ai_extract_rate_limits (
    key_hash,
    window_started_at,
    request_count,
    updated_at
  )
  VALUES (p_key_hash, request_at, 1, request_at)
  ON CONFLICT (key_hash) DO NOTHING;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'retry_after_seconds', 0
    );
  END IF;

  SELECT r.window_started_at, r.request_count
  INTO window_started_at, request_count
  FROM public.ai_extract_rate_limits AS r
  WHERE r.key_hash = p_key_hash
  FOR UPDATE;

  IF window_started_at + INTERVAL '60 seconds' <= request_at THEN
    UPDATE public.ai_extract_rate_limits
    SET window_started_at = request_at,
        request_count = 1,
        updated_at = request_at
    WHERE key_hash = p_key_hash;

    RETURN jsonb_build_object(
      'allowed', true,
      'retry_after_seconds', 0
    );
  END IF;

  IF request_count >= 20 THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', GREATEST(
        1,
        CEIL(EXTRACT(EPOCH FROM (
          window_started_at + INTERVAL '60 seconds' - request_at
        )))::integer
      )
    );
  END IF;

  UPDATE public.ai_extract_rate_limits
  SET request_count = request_count + 1,
      updated_at = request_at
  WHERE key_hash = p_key_hash;

  RETURN jsonb_build_object(
    'allowed', true,
    'retry_after_seconds', 0
  );
END;
$$;

COMMENT ON FUNCTION public.dawnly_allow_ai_extract(text, timestamptz) IS
  'Atomically allows up to twenty AI extraction requests per session per minute.';

REVOKE ALL ON FUNCTION public.dawnly_allow_ai_extract(text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dawnly_allow_ai_extract(text, timestamptz) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dawnly_allow_ai_extract(text, timestamptz) TO service_role;

