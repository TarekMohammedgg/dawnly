# 1. Idea

Dawnly is an Arabic-first, installable personal ledger for one user. It records
money owed to the user (`ليّا`) and money the user owes (`عليّا`) in EGP.

The canonical product specification is [docs/PRD.md](docs/PRD.md). Read it
before planning or implementing work. Keep the experience calm, simple, RTL,
and accessible to a non-technical user. Do not add out-of-scope features.

# 2. Rules and Instructions

1. Treat `docs/PRD.md` as the product source of truth. Follow its business
   rules, acceptance criteria, privacy requirements, and technical decisions.
2. Use the current Supabase configuration, SDK patterns, and security guidance.
   Do not introduce legacy Supabase code, deprecated APIs, or obsolete
   configuration. Prefer publishable (`sb_publishable_…`) and secret
   (`sb_secret_…`) API keys. Keep all Supabase and AI secrets server-side; never
   expose privileged keys to the React client. Store the active AI provider
   (`AI_PROVIDER`: `openrouter` | `minimax`), the OpenRouter API key
   (`OPENROUTER_API_KEY`), and the MiniMax Token Plan key (`MINIMAX_API_KEY`) in
   Supabase Vault; allow updates only through the authenticated Settings → API
   route path. Optional Vercel env `OPENROUTER_API_KEY` and `MINIMAX_API_KEY` are
   bootstrap fallbacks only.
3. Preserve the local-first architecture: IndexedDB is the offline cache and
   pending-sync queue; Supabase is the remote source of truth.
4. Maintain the six-digit PIN gate, one-minute lockout after five failures,
   protected server-side API routes, and restrictive Supabase RLS policies.
5. Keep all visible interface text Arabic and RTL. Support only EGP,
   non-negative whole-number amounts (including zero), optional notes
   (`ملاحظات`), and the `ليّا` / `عليّا` transaction directions.
6. After finishing every milestone, run the available lint, clean-code review,
   and test guards. Fix all newly introduced issues before marking the
   milestone complete; add focused tests when behavior changes.
7. Update both `docs/PRD.md` and `AGENTS.md` whenever a product decision,
   implementation rule, architecture choice, or scope changes.
8. Keep commits focused. Do not modify unrelated files, expose credentials, or
   retain source audio after voice analysis.

# 3. Tech Stack

| Area | Pinned version / choice |
| --- | --- |
| Runtime | Node.js `24.18.0`; npm `11.16.0` |
| Frontend | React `19.2.8`; React DOM `19.2.8`; TypeScript `6.0.3`; MUI `9.2.0` |
| Build | Vite `8.2.0`; `@vitejs/plugin-react` `6.0.5`; `vite-plugin-pwa` `1.3.0` |
| Database | `@supabase/supabase-js` `2.111.0`; publishable + secret API keys; current Supabase configuration only |
| Data utilities | Dexie `4.4.4`; Papa Parse `5.5.4`; Zod `4.4.3` |
| Quality | ESLint `10.8.0`; `typescript-eslint` `8.65.0` |
| Testing | Vitest `4.1.10`; Testing Library React `16.3.2`; fake-indexeddb `6.2.5` |
| AI/API | OpenRouter (`openai/gpt-5.6-luna`) or MiniMax Token Plan (`MiniMax-M3`), selectable in Settings; server-side Vercel `fetch`; keys and active provider in Supabase Vault with optional `OPENROUTER_API_KEY` / `MINIMAX_API_KEY` env fallbacks; browser `SpeechRecognition` (`ar-EG`) for transcription only |

Use these exact versions for implementation and testing. Test suites must run
against the same locked dependency versions as the application; do not use a
different React, TypeScript, Node.js, or Supabase SDK version in CI or locally.
Use exact package versions in `package.json` and commit the lockfile. Before any
dependency upgrade, update this table and `docs/PRD.md`, then run all guards.
9. Use MUI `9.2.0` as the component library for the UI.
10. Phase 4 local-first data must use the shared `LocalTransaction` and
    `PendingMutation` shapes, Dexie tables named `transactions`,
    `pendingMutations`, and `metadata`, and one sequential sync worker. Every
    queued server mutation carries a client mutation ID; server receipts remain
    server-only and are never stored in the browser.
11. Keep the dashboard in the initial client bundle and lazy-load the import,
    ledger, person, and settings routes so the initial mobile download stays
    below the production bundle warning threshold.
12. Phase 7 uses `vite-plugin-pwa` to generate an Arabic RTL standalone app
    shell. The service worker may cache static shell assets and navigation but
    must exclude `/api/*`; never cache transaction responses in the service
    worker.
13. The Vercel `GET /api/health/supabase` route is an operations-only endpoint.
    It requires `DAWNLY_CRON_SECRET` in the `x-dawnly-cron-secret` header,
    compares fixed-size digests, uses the server-only Supabase client for a
    minimal read, and returns no transaction data.
14. Cloudflare keep-alive configuration lives in `wrangler.jsonc` and calls the
    health route once daily. `DAWNLY_CRON_SECRET` is a Cloudflare Worker Secret
    and a server-only Vercel variable; it must never appear in a URL, `VITE_`
    variable, browser bundle, or log.
15. Release readiness requires `npm run lint`, `npm test`, `npm run
    release:check`, `git diff --check`, and completion of the Preview,
    Production, desktop, and Android checks in `docs/release-checklist.md`.
