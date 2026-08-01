# Dawnly Phase 7 security review

## Automated evidence

Run these commands from the repository root:

```text
npm run lint
npm test
npm run release:check
git diff --check
npm audit --audit-level=high
```

The release check scans only the generated client artifacts. It rejects the
server-only environment names and any configured server-only values, while
allowing the public Supabase URL and publishable key.

## Implementation evidence captured 2026-08-01

- `npm run lint`: passed.
- `npm test`: 19 files and 95 tests passed, including concurrent PIN
  lockout, hashed durable AI rate-limit calls, encrypted IndexedDB payloads,
  CSV formula neutralization, and input-size limits.
- `npm run release:check`: passed; the generated PWA shell contains no
  server-only values and the service worker denies `/api/*` navigation
  fallback.
- `npm audit --audit-level=high`: 0 vulnerabilities. The unused vulnerable
  `@vercel/node` development dependency was removed and its small request /
  response type boundary is now local.
- Migration `20260801000006_security_hardening.sql` was applied to the live
  Supabase project. Service-side RPC smoke checks returned an accepted PIN
  decision and an allowed hashed AI-quota decision; the live publishable-key
  RLS test still returns no transaction rows.

The boundary checkboxes below remain deployment-gated. The current Vercel
deployment must be replaced with this commit before its headers, atomic PIN
store, durable AI quota, and encrypted-cache client behavior can be treated
as production evidence.

## Boundary review

- [ ] `GET /api/health/supabase` rejects a missing or wrong
  `x-dawnly-cron-secret` header.
- [ ] The health route compares fixed-size digests and performs a server-only
  Supabase `HEAD` read without returning transaction rows.
- [ ] Protected API routes reject missing, expired, or forged Dawnly sessions.
- [ ] The live Supabase RLS test passes when `SUPABASE_URL` and the publishable
  key are configured; an anonymous transaction read returns no rows.
- [ ] Five incorrect PIN attempts produce the documented one-minute lockout.
- [ ] AI keys and the PIN hash exist only in server/Vault configuration.
- [ ] Logs contain route/event/status metadata only; they do not contain the
  PIN, PIN hash, API keys, transcript text, transaction names, or amounts.
- [ ] Voice code contains no audio blob, MediaRecorder, object URL, or audio
  persistence path.
- [ ] The service worker precaches the app shell but excludes `/api/*` from
  navigation fallback and does not cache ledger responses.

Any unchecked item is a release blocker. Do not mark the Phase 7 checklist
complete until the evidence is recorded for the target deployment.
