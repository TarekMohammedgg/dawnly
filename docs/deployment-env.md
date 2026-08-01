# Dawnly deployment environment

## Deployment environments

Use two Vercel environments with the same variable names and different values:

- **Preview:** pull-request and branch deployments; use the preview Dawnly URL,
  preview Supabase project or approved shared project, and preview-only secrets.
- **Production:** the production domain; use the production Supabase project and
  production-only secrets. Never copy a production secret into Preview.

The public URL is configuration, not a credential. Every value marked
**server-only** below must not be prefixed with `VITE_` and must not be read by
React code.

## Supabase project

| Field | Value |
| --- | --- |
| Organization | mac-store |
| Project name | dawnly |
| Project URL | `https://qapysuvrqqobnmwcqyuz.supabase.co` |
| Project ref | `qapysuvrqqobnmwcqyuz` |

## Environment variables

| Name | Scope | Notes |
| --- | --- | --- |
| `VITE_DAWNLY_PUBLIC_URL` | Public | Installed app origin; safe to expose |
| `VITE_SUPABASE_URL` | Public | Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public | `sb_publishable_…` key |
| `SUPABASE_URL` | Server | Same project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Used only to verify anon/RLS denial |
| `SUPABASE_SECRET_KEY` | Server only | `sb_secret_…` (or legacy service-role). Never expose to the browser. |
| `DAWNLY_PIN_HASH` | Server only | Output of `node scripts/hash-pin.mjs <pin>` |
| `DAWNLY_SESSION_SECRET` | Server only | Long random signing secret for session tokens |
| `DAWNLY_CRON_SECRET` | **Server-only** | Shared secret checked by the health endpoint; never put in a URL or client bundle |
| `OPENROUTER_API_KEY` | Server only (optional) | Bootstrap fallback if Vault has no `OPENROUTER_API_KEY` secret |
| `MINIMAX_API_KEY` | Server only (optional) | Bootstrap fallback if Vault has no `MINIMAX_API_KEY` (Token Plan) secret |

## AI provider keys in Supabase Vault

Preferred storage is Supabase Vault:

| Secret name | Purpose |
| --- | --- |
| `AI_PROVIDER` | Active provider: `openrouter` or `minimax` (default `openrouter`) |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `MINIMAX_API_KEY` | MiniMax Token Plan Subscription Key |

- Update from the app: Settings → مزود الذكاء الاصطناعي (requires PIN session).
- Or create/update in the Supabase Dashboard: **Project Settings → Vault**.
- Server RPCs: `dawnly_ai_key_status`, `dawnly_get_ai_key(provider)`,
  `dawnly_upsert_ai_key(provider, secret)`, `dawnly_set_ai_provider(provider)`
  (executable by `service_role` only).

The browser never receives plaintext keys—only
`{ provider, openrouter: { configured, updated_at? }, minimax: { configured, updated_at? } }`.

Pinned extraction models (server configuration only):

| Provider | Endpoint | Model |
| --- | --- | --- |
| OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | `openai/gpt-5.6-luna` |
| MiniMax Token Plan | `https://api.minimax.io/v1/chat/completions` | `MiniMax-M3` |

Transcription uses the browser `SpeechRecognition` API (`ar-EG`); AI providers are
not used for speech-to-text.

## PIN lockout store cleanup

`public.pin_attempt_state` holds a single row (`id = 'default'`). Failed attempts and
`locked_until` are updated by `POST /api/auth/verify-pin`. Successful PIN entry
resets the row. Expired lockouts are treated as unlocked on the next attempt; no
scheduled job is required. Optional manual cleanup:

```sql
UPDATE public.pin_attempt_state
SET failed_attempts = 0, locked_until = NULL, updated_at = now()
WHERE id = 'default';
```

## Sample data removal

After confirming the app works, delete seeded rows:

```sql
DELETE FROM public.transactions
WHERE id IN (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333'
);
```
