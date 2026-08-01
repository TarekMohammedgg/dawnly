# Dawnly owner handoff

## Change the PIN

1. Generate a new hash locally without committing the PIN:

   ```text
   node scripts/hash-pin.mjs <six-digit-pin>
   ```

2. Replace `DAWNLY_PIN_HASH` in both Vercel Preview and Production with the
   generated hash.
3. Redeploy the affected environment and verify the old PIN fails and the new
   PIN unlocks it.

The PIN, hash, and session-signing secret must never be stored in source code,
browser storage, CSV exports, or logs.

## Remove sample data

After acceptance testing, run the owner cleanup query in
[docs/deployment-env.md](deployment-env.md) against the intended Supabase
project. Confirm the rows are gone after a fresh authenticated load.

## Export a backup

Unlock Dawnly, open **الإعدادات**, and choose the CSV export action. Store the
downloaded UTF-8 CSV in the owner's private backup location. Do not upload it
to the repository or share it with logs/support tools.

## Inspect failures

- Vercel: open the deployment's **Logs** view and filter for the structured
  `[dawnly]` event prefix.
- Cloudflare: open the health Worker logs and inspect the event
  `dawnly_health_check_failed` if a scheduled request fails.
- Search only by route, event, operation, provider, status, error type, or API
  error code. Logs intentionally omit transaction content and credentials.

## Resume Supabase

If the project is paused, resume it from the Supabase dashboard, confirm the
health Worker receives a 200 response, then unlock Dawnly and allow the pending
local queue to synchronize. Supabase remains the remote source of truth for
conflicts.

## Rotate secrets

Rotate one boundary at a time and redeploy the matching environment:

1. Generate a new `DAWNLY_SESSION_SECRET`, update Vercel, and verify a fresh PIN
   unlock produces a working session.
2. Generate a new `DAWNLY_CRON_SECRET`, update Vercel and the matching Cloudflare
   Worker environment, then verify the health route rejects the old value and
   accepts the new one.
3. Rotate provider keys in Supabase Vault through **الإعدادات** or the Supabase
   dashboard. The app should show configured/not-configured status only.

Never place a secret in a URL, a `VITE_` variable, a committed file, or a
client-visible response.
