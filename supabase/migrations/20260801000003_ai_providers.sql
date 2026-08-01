-- Dual AI providers: OpenRouter + MiniMax (Token Plan), plus active provider.
-- Extends 20260801000002_vault_openrouter_secret.sql.
-- Plaintext never leaves the database except via SECURITY DEFINER RPCs
-- called only with the Dawnly secret (service-role) key from Vercel.

CREATE OR REPLACE FUNCTION public.dawnly_ai_provider_secret_name(provider text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF provider = 'openrouter' THEN
    RETURN 'OPENROUTER_API_KEY';
  ELSIF provider = 'minimax' THEN
    RETURN 'MINIMAX_API_KEY';
  ELSE
    RAISE EXCEPTION 'invalid_ai_provider'
      USING ERRCODE = '22023';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.dawnly_ai_provider_secret_name(text) IS
  'Maps openrouter|minimax to Vault secret names.';

CREATE OR REPLACE FUNCTION public.dawnly_ai_key_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  active_provider text := 'openrouter';
  openrouter_updated_at timestamptz;
  minimax_updated_at timestamptz;
  provider_value text;
BEGIN
  SELECT d.decrypted_secret
  INTO provider_value
  FROM vault.decrypted_secrets AS d
  WHERE d.name = 'AI_PROVIDER'
  LIMIT 1;

  IF provider_value IS NOT NULL AND btrim(provider_value) IN ('openrouter', 'minimax') THEN
    active_provider := btrim(provider_value);
  END IF;

  SELECT s.updated_at
  INTO openrouter_updated_at
  FROM vault.secrets AS s
  WHERE s.name = 'OPENROUTER_API_KEY'
  LIMIT 1;

  SELECT s.updated_at
  INTO minimax_updated_at
  FROM vault.secrets AS s
  WHERE s.name = 'MINIMAX_API_KEY'
  LIMIT 1;

  RETURN jsonb_build_object(
    'provider', active_provider,
    'openrouter', CASE
      WHEN openrouter_updated_at IS NULL THEN
        jsonb_build_object('configured', false)
      ELSE
        jsonb_build_object(
          'configured', true,
          'updated_at', openrouter_updated_at
        )
    END,
    'minimax', CASE
      WHEN minimax_updated_at IS NULL THEN
        jsonb_build_object('configured', false)
      ELSE
        jsonb_build_object(
          'configured', true,
          'updated_at', minimax_updated_at
        )
    END
  );
END;
$$;

COMMENT ON FUNCTION public.dawnly_ai_key_status() IS
  'Returns active AI provider and configured status per key. Never returns plaintext keys.';

-- Drop the previous no-arg getter so the provider-scoped signature can replace it.
DROP FUNCTION IF EXISTS public.dawnly_get_ai_key();

CREATE OR REPLACE FUNCTION public.dawnly_get_ai_key(provider text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  secret_name text;
  value text;
BEGIN
  secret_name := public.dawnly_ai_provider_secret_name(provider);

  SELECT d.decrypted_secret
  INTO value
  FROM vault.decrypted_secrets AS d
  WHERE d.name = secret_name
  LIMIT 1;

  RETURN NULLIF(btrim(value), '');
END;
$$;

COMMENT ON FUNCTION public.dawnly_get_ai_key(text) IS
  'Server-only plaintext AI key from Vault for openrouter|minimax. Call only from Vercel with secret key.';

-- Drop the previous single-arg upsert so the provider-scoped signature can replace it.
DROP FUNCTION IF EXISTS public.dawnly_upsert_ai_key(text);

CREATE OR REPLACE FUNCTION public.dawnly_upsert_ai_key(provider text, new_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  secret_name text;
  existing_id uuid;
  cleaned text := btrim(new_secret);
  description text;
BEGIN
  secret_name := public.dawnly_ai_provider_secret_name(provider);

  IF cleaned IS NULL OR char_length(cleaned) < 8 THEN
    RAISE EXCEPTION 'invalid_ai_key'
      USING ERRCODE = '22023';
  END IF;

  IF provider = 'openrouter' THEN
    description := 'OpenRouter API key for Dawnly AI field extraction';
  ELSE
    description := 'MiniMax Token Plan Subscription Key for Dawnly AI field extraction';
  END IF;

  SELECT s.id
  INTO existing_id
  FROM vault.secrets AS s
  WHERE s.name = secret_name
  LIMIT 1;

  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(cleaned, secret_name, description);
  ELSE
    PERFORM vault.update_secret(existing_id, cleaned, secret_name, description);
  END IF;

  RETURN public.dawnly_ai_key_status();
END;
$$;

COMMENT ON FUNCTION public.dawnly_upsert_ai_key(text, text) IS
  'Creates or updates the Vault secret for openrouter|minimax. Server-only via secret key.';

CREATE OR REPLACE FUNCTION public.dawnly_set_ai_provider(provider text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cleaned text := btrim(provider);
  existing_id uuid;
BEGIN
  IF cleaned IS NULL OR cleaned NOT IN ('openrouter', 'minimax') THEN
    RAISE EXCEPTION 'invalid_ai_provider'
      USING ERRCODE = '22023';
  END IF;

  SELECT s.id
  INTO existing_id
  FROM vault.secrets AS s
  WHERE s.name = 'AI_PROVIDER'
  LIMIT 1;

  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(
      cleaned,
      'AI_PROVIDER',
      'Active Dawnly AI provider: openrouter or minimax'
    );
  ELSE
    PERFORM vault.update_secret(
      existing_id,
      cleaned,
      'AI_PROVIDER',
      'Active Dawnly AI provider: openrouter or minimax'
    );
  END IF;

  RETURN public.dawnly_ai_key_status();
END;
$$;

COMMENT ON FUNCTION public.dawnly_set_ai_provider(text) IS
  'Sets AI_PROVIDER in Vault to openrouter|minimax. Server-only via secret key.';

REVOKE ALL ON FUNCTION public.dawnly_ai_provider_secret_name(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dawnly_ai_provider_secret_name(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dawnly_ai_provider_secret_name(text) TO service_role;

REVOKE ALL ON FUNCTION public.dawnly_ai_key_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dawnly_ai_key_status() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dawnly_ai_key_status() TO service_role;

REVOKE ALL ON FUNCTION public.dawnly_get_ai_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dawnly_get_ai_key(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dawnly_get_ai_key(text) TO service_role;

REVOKE ALL ON FUNCTION public.dawnly_upsert_ai_key(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dawnly_upsert_ai_key(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dawnly_upsert_ai_key(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.dawnly_set_ai_provider(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dawnly_set_ai_provider(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dawnly_set_ai_provider(text) TO service_role;
