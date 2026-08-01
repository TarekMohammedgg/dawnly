# Dawnly Phase 7 security review

## Automated evidence

Run these commands from the repository root:

```text
npm run lint
npm test
npm run release:check
git diff --check
```

The release check scans only the generated client artifacts. It rejects the
server-only environment names and any configured server-only values, while
allowing the public Supabase URL and publishable key.

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
