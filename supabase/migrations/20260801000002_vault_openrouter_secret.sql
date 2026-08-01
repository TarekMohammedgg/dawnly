-- OpenRouter API key in Supabase Vault.
-- Plaintext never leaves the database except through SECURITY DEFINER RPCs
-- called only with the Dawnly secret (service-role) key from Vercel.
-- The React client never queries vault.* and never receives the full key.

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

CREATE OR REPLACE FUNCTION public.dawnly_ai_key_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  secret_updated_at timestamptz;
BEGIN
  SELECT s.updated_at
  INTO secret_updated_at
  FROM vault.secrets AS s
  WHERE s.name = 'OPENROUTER_API_KEY'
  LIMIT 1;

  IF secret_updated_at IS NULL THEN
    RETURN jsonb_build_object('configured', false);
  END IF;

  RETURN jsonb_build_object(
    'configured', true,
    'updated_at', secret_updated_at
  );
END;
$$;

COMMENT ON FUNCTION public.dawnly_ai_key_status() IS
  'Returns whether OPENROUTER_API_KEY exists in Vault. Never returns plaintext.';

CREATE OR REPLACE FUNCTION public.dawnly_get_ai_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  value text;
BEGIN
  SELECT d.decrypted_secret
  INTO value
  FROM vault.decrypted_secrets AS d
  WHERE d.name = 'OPENROUTER_API_KEY'
  LIMIT 1;

  RETURN NULLIF(btrim(value), '');
END;
$$;

COMMENT ON FUNCTION public.dawnly_get_ai_key() IS
  'Server-only plaintext OpenRouter key from Vault. Call only from Vercel with secret key.';

CREATE OR REPLACE FUNCTION public.dawnly_upsert_ai_key(new_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_id uuid;
  cleaned text := btrim(new_secret);
BEGIN
  IF cleaned IS NULL OR char_length(cleaned) < 8 THEN
    RAISE EXCEPTION 'invalid_ai_key'
      USING ERRCODE = '22023';
  END IF;

  SELECT s.id
  INTO existing_id
  FROM vault.secrets AS s
  WHERE s.name = 'OPENROUTER_API_KEY'
  LIMIT 1;

  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(
      cleaned,
      'OPENROUTER_API_KEY',
      'OpenRouter API key for Dawnly AI field extraction'
    );
  ELSE
    PERFORM vault.update_secret(
      existing_id,
      cleaned,
      'OPENROUTER_API_KEY',
      'OpenRouter API key for Dawnly AI field extraction'
    );
  END IF;

  RETURN public.dawnly_ai_key_status();
END;
$$;

COMMENT ON FUNCTION public.dawnly_upsert_ai_key(text) IS
  'Creates or updates OPENROUTER_API_KEY in Vault. Server-only via secret key.';

REVOKE ALL ON FUNCTION public.dawnly_ai_key_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dawnly_ai_key_status() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dawnly_ai_key_status() TO service_role;

REVOKE ALL ON FUNCTION public.dawnly_get_ai_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dawnly_get_ai_key() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dawnly_get_ai_key() TO service_role;

REVOKE ALL ON FUNCTION public.dawnly_upsert_ai_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dawnly_upsert_ai_key(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dawnly_upsert_ai_key(text) TO service_role;
