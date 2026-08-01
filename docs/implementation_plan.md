# Dawnly Implementation Plan

This is the execution plan for Dawnly. Every checkbox is intentionally small,
unambiguous, and independently verifiable so implementation can be safely
delegated to lower-cost models.

## Fixed stack and implementation rules

Install packages with exact versions (`npm install --save-exact` or
`npm install --save-dev --save-exact`); do not use `^` or `~` ranges. Commit
the generated `package-lock.json`. The application and all tests must use the
same locked dependency graph.

| Area | Required version / decision |
| --- | --- |
| Runtime | Node.js `24.18.0`; npm `11.16.0` |
| Application | React `19.2.8`; React DOM `19.2.8`; TypeScript `6.0.3` |
| Build | Vite `8.2.0`; `@vitejs/plugin-react` `6.0.5` |
| UI | MUI `9.2.0`; `@mui/icons-material` `9.2.0`; `@emotion/react` `11.14.0`; `@emotion/styled` `11.14.1`; `@emotion/cache` `11.14.0`; `stylis-plugin-rtl` `2.1.1` |
| Database | Supabase PostgreSQL; `@supabase/supabase-js` `2.111.0` |
| Local data | Dexie `4.4.4`; Zod `4.4.3` |
| CSV | Papa Parse `5.5.4`; `@types/papaparse` `5.5.2` |
| PWA | `vite-plugin-pwa` `1.3.0` |
| Testing | Vitest `4.1.10`; Testing Library React `16.3.2`; Testing Library user-event `14.6.1`; jsdom `30.0.1`; fake-indexeddb `6.2.5` |
| Linting | ESLint `10.8.0`; `typescript-eslint` `8.65.0` |
| Field extraction | Active Settings provider: OpenRouter (`openai/gpt-5.6-luna`) or MiniMax Token Plan (`MiniMax-M3` at `https://api.minimax.io/v1`); non-streaming JSON; `temperature: 0`; `max_tokens`/`max_completion_tokens: 200`; reasoning/thinking disabled |

Use native `fetch` in Vercel functions; do not add an OpenRouter or MiniMax SDK.
The browser must never receive `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`,
`MINIMAX_API_KEY`, the fixed PIN, a PIN hash, or the Cloudflare Cron secret.

### Required folder boundaries

- `src/components/`: presentational React and MUI components only.
- `src/features/<feature>/`: feature UI, hooks, and feature tests.
- `src/lib/`: pure validation, formatting, date, CSV, IndexedDB, and sync code.
- `src/types/`: shared TypeScript types and Zod schemas.
- `api/`: Vercel serverless endpoints only; keep secrets and privileged
  Supabase access here.
- `supabase/migrations/`: SQL migrations only; never edit production schema by
  hand without adding a migration.
- `src/test/`: reusable test setup, fake IndexedDB setup, factories, and mocks.

### Milestone close-out rule

After every phase, run `npm run lint`, `npm run test`, and `npm run build`.
Perform a clean-code review for duplicated logic, missing Arabic/RTL handling,
secret exposure, and untested business rules. Fix new issues before starting the
next phase. Update `docs/PRD.md` and `AGENTS.md` if a product, scope, security,
or architecture decision changes.

## Phase 1 — Product Foundation and Experience

**Outcome:** A version-pinned, tested, Arabic RTL application shell with the
approved Dawnly visual language and no backend dependency.

- [x] P1-01: Replace version ranges in `package.json` with exact versions for
  the existing React, TypeScript, Vite, and ESLint packages; regenerate and
  commit `package-lock.json`.
- [x] P1-02: Install the exact MUI, Emotion, RTL, PWA, data, CSV, validation,
  and testing packages listed in the fixed stack table. Do not add a second UI
  library, CSS framework, state-management framework, or date library.
- [x] P1-03: Add `test`, `test:watch`, and `test:coverage` npm scripts using
  Vitest `4.1.10`; configure jsdom and load fake-indexeddb in one shared test
  setup file.
- [x] P1-04: Create the application structure described in “Required folder
  boundaries”; keep the initial root component limited to providers, routing,
  and the app shell.
- [x] P1-05: Configure MUI for Arabic RTL: `direction: 'rtl'`, an Emotion cache
  using `stylis-plugin-rtl`, Arabic locale text, and a calm neutral palette for
  light and dark themes. Do not use gradients.
- [x] P1-06: Add global CSS for `dir="rtl"`, Arabic font fallbacks, accessible
  focus states, reduced-motion support, and touch controls no smaller than
  44×44 CSS pixels.
- [x] P1-07: Build the locked application shell: app bar, dashboard route,
  ledger route, import route, settings route, and a mobile bottom navigation.
  Use Arabic labels only.
- [x] P1-08: Add a reusable empty state, loading state, error state, confirm
  dialog, amount display, and `DD/MM/YYYY` date display component.
- [x] P1-09: Add sample transaction fixtures only in `src/test/`; do not seed
  Supabase in this phase.
- [x] P1-10: Test RTL document direction, Arabic navigation labels, keyboard
  navigation, dark-mode theme switch, and narrow mobile layout rendering.

## Phase 2 — Secure Backend and Data Foundation

**Outcome:** A protected Supabase schema and Vercel API boundary, with no
public transaction access and a fixed six-digit PIN gate.

- [x] P2-01: Create a Supabase project using the current dashboard
  configuration. Store the project URL and public anon key in Vercel public
  environment variables only; keep the service-role key server-only.
- [x] P2-02: Add a timestamped migration that creates a `transaction_direction`
  enum (`receivable`, `payable`) and a `transactions` table with `id`, `name`,
  `direction`, `amount`, `transaction_date`, `currency`, `created_at`, and
  `updated_at` exactly as specified in the PRD.
- [x] P2-03: Add database constraints: trimmed non-empty name, `amount > 0`,
  integer amount, currency fixed to `EGP`, valid direction, and a unique index
  on normalized name + direction + amount + transaction date for deduplication.
  *(Superseded by Phase 6b: `amount >= 0` and notes in the dedupe key.)*
- [x] P2-04: Add an `updated_at` trigger in the same migration. Document all
  indexes and constraints in migration comments.
- [x] P2-05: Enable RLS and add no anonymous read/write policies for
  `transactions`. Verify an anon request is rejected; Vercel server functions
  use the service-role client only after a valid Dawnly session is checked.
- [x] P2-06: Add a server-only `DAWNLY_PIN_HASH` environment variable using a
  slow password hash. Never store the plain PIN in source control, browser
  storage, or Supabase.
- [x] P2-07: Implement `POST /api/auth/verify-pin`: validate exactly six ASCII
  digits, enforce five failures followed by a 60-second lockout, compare the
  submitted PIN server-side, and return a short-lived signed token held only in
  React memory.
- [x] P2-08: Persist lockout state server-side, not in localStorage, so a page
  reload cannot bypass it. Use a minimal server-only table or durable store;
  document its cleanup behavior.
- [x] P2-09: Implement one request-authentication helper for all protected
  `/api/*` endpoints. It must reject missing, expired, malformed, or forged
  tokens before it creates a service-role Supabase client.
- [x] P2-10: Create typed API contracts and Zod schemas shared by client and
  server for transaction create, update, list, delete, and API error responses.
- [x] P2-11: Seed sample transactions through a versioned SQL seed/migration
  that runs once in the target Supabase project. Include a documented manual
  deletion query for the owner; never reseed at each browser launch.
- [x] P2-12: Test the schema constraints, anonymous-access rejection, valid PIN,
  fifth-failure lockout, locked response, expired token, and protected endpoint
  rejection. Use test secrets only.

## Phase 3 — Core Ledger Experience

**Outcome:** The user can securely create, read, edit, search, filter, and
delete transactions through a simple Arabic interface.

- [x] P3-01: Build an in-memory authentication state that starts locked on each
  application load and loses its token on refresh, tab close, or explicit sign
  out. Render no ledger data before successful PIN verification.
- [x] P3-02: Implement `GET /api/transactions` with newest-first sorting and
  typed filters for normalized name, direction, exact amount, date range, and
  currency. Currency is fixed to EGP but remains a visible filter value.
- [x] P3-03: Implement `POST /api/transactions`, returning either the created
  transaction or a typed duplicate error. Normalize whitespace before matching.
- [x] P3-04: Implement `PATCH /api/transactions/:id` and `DELETE
  /api/transactions/:id`; reject nonexistent IDs and use the same validation as
  creation.
- [x] P3-05: Build the dashboard with only two primary summary cards: total
  `ليّا` and total `عليّا`. Calculate totals from the fetched transaction set;
  do not add a third total card.
- [x] P3-06: Build the manual entry form with name suggestions, direction,
  whole-number amount, date prefilled to today, fixed EGP display, inline Arabic
  validation, and save confirmation feedback.
- [x] P3-07: Build the ledger list with newest-first ordering, transaction
  details, an edit flow that pre-populates the same form, and a deletion dialog
  that cannot delete until confirmation.
- [x] P3-08: Build a person detail page keyed by normalized name. It must show
  that person's `ليّا` total, `عليّا` total, net balance, and their ledger
  entries; it must not merge or delete opposite-direction records.
- [x] P3-09: Build accessible search and filter controls. Preserve active filters
  in the URL query string so a reload maintains the current ledger view.
- [x] P3-10: Test manual validation, date defaulting, Arabic name suggestions,
  duplicate handling, summaries, person totals, filtering, edit persistence,
  and deletion confirmation.

## Phase 4 — Local-First Reliability and Synchronization

**Outcome:** Dawnly displays cached data offline, accepts local changes while
offline, and synchronizes them automatically and safely when connectivity returns.

- [x] P4-01: Define one local transaction shape and one mutation-queue shape;
  include operation type, transaction ID, payload, client mutation ID, attempt
  count, timestamps, and last error.
- [x] P4-02: Create a Dexie `4.4.4` database with separate `transactions`,
  `pendingMutations`, and `metadata` tables. Add a schema version constant and
  migrations for future local changes.
- [x] P4-03: Cache every successful server list response locally, then render
  cached data immediately before revalidating from the API.
- [x] P4-04: Apply create, update, and delete optimistically to Dexie. Queue the
  matching mutation before attempting the network request so network loss cannot
  lose a confirmed UI action.
- [x] P4-05: Implement a single sequential sync worker. Trigger it on app start,
  after a local mutation, and on the browser `online` event; never create a
  manual Sync button.
- [x] P4-06: Make all server mutation routes idempotent with the client mutation
  ID. A retry must never create a second transaction.
- [x] P4-07: On a server conflict, treat the Supabase response as authoritative,
  replace the local record, remove or mark the queued mutation, and show a clear
  Arabic message without exposing technical details.
- [x] P4-08: Keep pending changes after a browser restart. Require the PIN again
  before reloading remote data or flushing the pending queue.
- [x] P4-09: Add an unobtrusive Arabic offline/pending status indicator. It must
  explain that changes will save automatically when internet returns, without a
  user-action button.
- [x] P4-10: Test offline read, offline create/edit/delete, restart persistence,
  online replay order, repeated retry idempotency, server-wins conflict handling,
  and the absence of duplicate records.

## Phase 5 — CSV Import and Backup Export

**Outcome:** The user can safely preview, correct, import, and export small to
medium comma-separated transaction files.

- [x] P5-01: Add an import page with Arabic instructions showing the accepted
  headers exactly: `الاسم، النوع، المبلغ، التاريخ، العملة`. State that the only
  separator is a comma and only one CSV file is accepted at a time.
  *(Extended in Phase 6b with optional `ملاحظات`.)*
- [x] P5-02: Parse the selected file in the browser with Papa Parse `5.5.4`.
  Strip a UTF-8 BOM, trim headers and values, ignore blank rows, and report
  unreadable files in Arabic.
- [x] P5-03: Accept a missing `العملة` column or blank currency value by filling
  `EGP`; reject a non-EGP currency. Require the other four columns.
- [x] P5-04: Parse CSV dates strictly as `DD/MM/YYYY`; reject ambiguous or
  invalid Gregorian dates rather than silently changing them.
- [x] P5-05: Convert Arabic and Western whole-number digits to a normalized
  integer. Reject zero, negatives, decimals, and non-numeric values.
  *(Superseded by Phase 6b: zero amounts are accepted.)*
- [x] P5-06: Map `ليّا` to `receivable` and `عليّا` to `payable`; mark all other
  direction values invalid. Normalize name whitespace before validation.
- [x] P5-07: Render an editable, keyboard-accessible MUI table with one row per
  parsed transaction, row status, field-level Arabic errors, and a clear summary
  of valid, invalid, and duplicate rows.
- [x] P5-08: Check duplicates both within the CSV and against the current local
  and server data using name + direction + amount + date. Do not prevent valid
  records that differ by date or direction.
  *(Extended in Phase 6b: notes participate in the duplicate key.)*
- [x] P5-09: On confirmation, create local queued mutations for valid edited
  rows, then use the Phase 4 sync path. Do not bypass local-first behavior for
  imports.
- [x] P5-10: Add Settings export. Generate a UTF-8 BOM CSV with the required
  Arabic headers, comma separator, stable newest-first ordering, and EGP values.
- [x] P5-11: Test header failures, missing currency fallback, Arabic digits,
  invalid dates, in-file duplicates, server duplicates, edited preview rows,
  offline import, and exact export content.

## Phase 6 — Egyptian-Arabic Voice Entry

**Outcome:** Holding the record control produces a reviewable transaction draft
without retaining original audio and without exposing AI keys.

> **Provider constraint:** MiniMax's current public documentation describes
> speech synthesis, not a confirmed speech-to-text endpoint. Do not implement an
> unverified MiniMax transcription call. The initial provider is the browser
> `SpeechRecognition` API with `lang = 'ar-EG'`, behind a provider interface.
> If a server transcription provider is later selected, it must implement the
> same interface, keep its key in Vercel, and delete uploaded source audio in a
> `finally` block. This preserves the PRD behavior while avoiding an unsupported
> API assumption.

- [x] P6-01: Define a `TranscriptionProvider` interface that returns transcript,
  confidence when available, and a typed error. Implement a browser provider
  using `SpeechRecognition`/`webkitSpeechRecognition` with `ar-EG`.
- [x] P6-02: Implement the hold-to-record interaction: start recognition on
  pointer down, stop it on pointer up, pointer cancel, pointer leave, Escape,
  and component unmount. Prevent duplicate start calls.
- [x] P6-03: Detect unsupported browsers before recording. Show an Arabic
  fallback that directs the user to the manual entry form; do not fake a
  transcript or upload an audio recording without an approved provider.
- [x] P6-04: Keep no recorded blob in IndexedDB, localStorage, React state after
  processing, Supabase, or Vercel logs. Clear transcript processing state on
  cancel and on successful save.
- [x] P6-05: Implement `POST /api/ai/extract-transaction`, protected by the
  standard Dawnly session. It accepts text only, limits transcript length, and
  calls the active Settings provider: OpenRouter (`openai/gpt-5.6-luna`) or
  MiniMax Token Plan (`MiniMax-M3`) with `temperature: 0`, max 200 tokens, and
  reasoning/thinking disabled.
- [x] P6-06: Require a strict JSON response with `name`, `direction`, `amount`,
  `transaction_date`, and `currency`. Validate the result with the same Zod
  schema used by manual and CSV flows; set `currency` to EGP only.
  *(Extended in Phase 6b with optional `notes` and amount `>= 0`.)*
- [x] P6-07: Write a minimal Arabic extraction prompt with examples such as
  `أحمد عليه ٥٠ جنيه النهارده`. Instruct the model to return `null` for unknown
  values, never invent dates or amounts, and return JSON only.
- [x] P6-08: Build a review screen that displays the original transcript and all
  editable transaction fields. Reuse the manual form validation and require an
  explicit confirmation before queueing the transaction.
- [x] P6-09: Add request size limits, rate limits, timeout handling, Arabic
  error messages, and server-side log redaction for transcript content and API
  keys.
- [x] P6-10: Test start/stop gestures, unsupported-browser fallback, provider
  errors, JSON extraction validation, unknown values, edited review values,
  explicit confirmation, and proof that no audio/blob storage code is used.

## Phase 6b — Optional Notes and Zero Amount

**Outcome:** Transactions may use amount `0` and an optional `ملاحظات` field for
in-kind items or extra detail, with notes included in the duplicate key.

- [x] P6b-01: Update `docs/PRD.md`, `AGENTS.md`, and this plan for non-negative
  amounts, optional notes, and dedupe including normalized notes.
- [x] P6b-02: Add a Supabase migration: `amount >= 0`, nullable `notes`, and a
  rebuilt unique index on name + direction + amount + date + normalized notes.
- [x] P6b-03: Update shared Zod schemas, API/local mappers, and Dexie schema
  version so create/update/list/extract carry `notes`.
- [x] P6b-04: Add the notes field to the manual form, list display, CSV
  import/export, and voice extraction prompt/parser; accept amount `0`.
- [x] P6b-05: Update tests for zero amounts, notes, and notes-aware duplicates;
  run lint, test, and build.

## Phase 7 — PWA, Operations, and Release Readiness

**Outcome:** Dawnly is installable, securely deployable to Vercel, protected
against Free-plan inactivity, and verified against all PRD acceptance criteria.

- [x] P7-01: Configure `vite-plugin-pwa` `1.3.0` with Arabic app name, short
  name, icons, theme color, manifest display mode, and an offline app shell.
- [ ] P7-02: Verify PWA installation from Chrome desktop and Android. Confirm
  the installed shortcut opens Dawnly correctly in RTL and still requires the
  PIN on a new app load.
- [x] P7-03: Create Vercel environment-variable documentation for public URL,
  public anon key, service-role key, PIN hash, OpenRouter key, session-signing
  secret, and Cron secret. Mark every secret as server-only.
- [ ] P7-04: Deploy preview and production environments separately. Validate that
  production environment variables are not included in the built client bundle.
- [x] P7-05: Implement `GET /api/health/supabase`, protected by a constant-time
  Cron secret check. It performs a minimal authenticated Supabase read and
  returns no transaction data.
- [ ] P7-06: Configure Cloudflare Cron to call the health endpoint once every 24
  hours with the secret header. Record the schedule, endpoint, secret name, and
  owner setup steps in deployment documentation; do not put a secret in the URL.
- [x] P7-07: Add non-sensitive observability for API failures, sync failures,
  health-check failures, and AI errors. Do not log the PIN, full transcript,
  transaction names, or amounts.
- [x] P7-08: Run a manual security review: client bundle contains no secrets,
  PIN brute-force lockout works, RLS blocks anonymous access, unauthorized API
  requests fail, and imported/voice data follows retention rules.
- [ ] P7-09: Run the full acceptance pass from `docs/PRD.md` section 11 on
  desktop and mobile. Include offline mode, narrow-screen usability, dark mode,
  CSV import/export, voice fallback, and PWA installation.
- [x] P7-10: Create a concise owner handoff document covering changing the PIN
  hash, removing sample data, exporting a backup, inspecting Vercel errors,
  resuming Supabase if required, and rotating secrets.

> Release gate: P7-02, P7-04, P7-06, and P7-09 remain unchecked until the
> owner supplies the real Vercel Preview/Production URLs and secrets, deploys
> the Cloudflare Worker, and completes the Chrome desktop/Android acceptance
> pass. Local code, build, release-scan, RLS, and Wrangler dry-run evidence is
> recorded in `docs/release-checklist.md` and `docs/security-review.md`.
