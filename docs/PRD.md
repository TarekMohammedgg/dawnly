# Dawnly — Product Requirements Document

**Status:** Approved initial draft
**Platform:** Arabic-first, installable web application (PWA)
**Target audience:** One non-technical user
**Only currency:** Egyptian pound (EGP)

## 1. Summary

**Dawnly** is a simple personal ledger for recording money **owed to me** and money **I owe** for individual people. It supports manual entry, Egyptian-Arabic voice entry, and CSV import, then presents a clear chronological ledger and totals for both directions.

The application is designed to be calm and easy for the project owner's mother: Arabic is the only language, there are no user accounts, and there is no AI chat interface or AI-style gradient visual treatment.

## 2. Goals

- Record personal transactions quickly with as few steps as possible.
- Make Egyptian-Arabic voice input a primary entry method, not a secondary feature.
- Continue working offline without losing newly entered data.
- Provide a well-organized history for every person and accurate totals.
- Protect access with a simple PIN, without requiring an account or email address.

## 3. Out of scope for v1

- Multiple users or shared data.
- Google sign-in or any identity provider.
- Google Sheets and Google Drive API integration.
- Excel, image, or handwriting import.
- Multiple currencies, negative amounts, or decimal amounts.
- A Flutter application or a separately distributed mobile app.
- General-purpose AI chat.
- Analytics beyond the total owed to the user and total owed by the user.
- Deleting all data or recovering the PIN from the user-facing interface.

## 4. Terminology and business rules

| Term | Meaning |
| --- | --- |
| **Owed to me** | Money that another person owes the user. Displayed in Arabic as `ليّا`. |
| **I owe** | Money the user owes another person. Displayed in Arabic as `عليّا`. |
| **Name** | A free-form person name. Existing names are suggested to prevent spelling variations. |
| **Transaction** | One record containing name, direction, amount, optional notes, date, and currency. |
| **Notes** | Optional free-text (`ملاحظات`) for in-kind items or extra detail (e.g. سكر، كنز). |

### Data rules

- Required visible fields: `name`, `direction`, `amount`, `date`, and `currency`.
- Optional visible field: `notes` (`ملاحظات`). Empty notes are stored as absent/null.
- Direction is limited to `ليّا` (owed to me) or `عليّا` (I owe).
- Amounts are non-negative whole numbers only (`>= 0`); negatives and decimals are invalid. Zero is allowed for non-monetary entries described in notes.
- Currency is always `EGP` and may be presented to the user as Egyptian pounds.
- Dates are Gregorian only, displayed as `DD/MM/YYYY`, with no user-facing time field.
- The current date is prefilled and can be edited before or after saving.
- The same person may have transactions in both directions; every transaction remains separate.
- A duplicate is prevented only when **name + direction + amount + date + notes** are identical (notes compared after normalizing whitespace; empty and missing notes match). A different date, direction, or notes value is a valid separate transaction.
- Dashboard totals `ليّا` / `عليّا` sum amounts; zero-amount rows do not change money totals but still appear in lists.
- The default ledger order is newest first.

## 5. User journeys

### 5.1 First launch

1. The user opens the Vercel URL or the Dawnly shortcut installed on their phone home screen.
2. A simple Arabic PIN screen appears.
3. The user enters the fixed six-digit PIN.
4. After successful verification, the dashboard and Supabase sample data appear.
5. A PIN is required every time the application is opened; there is no “remember me” option.

### 5.2 Manual entry

1. The user selects **Add transaction**.
2. They type a name and receive matching suggestions from previously saved names.
3. They select `ليّا` or `عليّا` and enter a non-negative whole-number amount (zero allowed).
4. They may optionally add notes (`ملاحظات`) for in-kind items or extra detail.
5. They review the date, which defaults to today. Currency remains EGP.
6. They save the transaction; it appears immediately even when the device is offline.

### 5.3 Voice entry

1. The user holds down a recording control, similar to WhatsApp voice recording.
2. Recording continues while the control is held, then stops and is sent for analysis when released.
3. The system transcribes Egyptian Arabic speech and extracts the transaction fields (including optional notes).
4. A review screen shows the transcript and editable extracted fields.
5. No transaction is saved until the user selects **Confirm save**.
6. The original audio file is deleted immediately after successful or unsuccessful processing. Neither the application nor the server retains it.

### 5.4 CSV import

1. The user chooses one CSV file with `,` as the separator.
2. The import screen clearly states the supported column headers: `الاسم، النوع، المبلغ، التاريخ، العملة، ملاحظات`.
3. The application reads the file and presents every row in an Excel-like review table.
4. The user can edit extracted values before importing them.
5. If the currency column is missing or its value is blank, the application uses `EGP`. If `ملاحظات` is missing or blank, notes are empty.
6. On confirmation, the application validates formatting and duplicates, imports valid rows only, and explains why any rejected rows were not imported.

### 5.5 Offline use and synchronization

1. The application loads the latest available local copy of data when it opens.
2. Adds, edits, and deletes are immediately stored in IndexedDB, with a pending-sync state while offline.
3. When connectivity returns, or when a change occurs online, the queued operations synchronize automatically with Supabase.
4. There is no manual sync button, to avoid confusing the user.
5. Changes made directly in Supabase appear after the site is reloaded.
6. If a local change conflicts with a version in Supabase, Supabase is the source of truth. The application shows the resolved result after synchronization or reload.

## 6. Pages and interface

### Dashboard

- Two primary cards only: total `ليّا` and total `عليّا`.
- A clear manual transaction button.
- A hold-to-record voice entry control.
- Recent transactions below the total cards.

### Ledger

- A chronological list ordered newest first.
- Every transaction shows name, direction, EGP amount, date, and notes when present.
- Edit and delete controls.
- Delete requires explicit confirmation.
- Name search plus comprehensive filters for date, direction, amount, and all available fields.

### Person detail page

- Opened by selecting a name from the ledger or search results.
- Shows that person's total `ليّا`, total `عليّا`, net balance, and chronological transaction list.

### Import and export

- CSV import only, as described in section 5.4.
- CSV export for a user-downloadable backup from Settings.

### Settings

- Light/dark mode toggle.
- Choose the active AI provider (`OpenRouter` or `MiniMax`) and update that
  provider’s API key. MiniMax uses the Token Plan Subscription Key. Keys are
  stored encrypted in Supabase Vault and are never shown again after save; only
  a configured / not-configured status is displayed per provider.
- CSV backup export.
- Sign out, which clears the in-memory PIN session and returns the user to the
  lock screen.
- No user-facing control to delete all data or change/recover the PIN.

### Design principles

- Complete right-to-left support, Arabic only, and a readable Arabic typeface.
- Calm and neutral presentation, low information density, direct language, and large mobile-friendly controls.
- No AI gradients or chat-like interface.
- Web-first responsive design.
- PWA installable as a home-screen shortcut for fast access.

## 7. Security and access

- There are no user accounts; the application is intended for one person.
- A fixed six-digit PIN is selected and managed by the project owner outside the end-user interface.
- The PIN is requested at every application launch.
- After five incorrect attempts, PIN input is locked for one minute.
- The client must never access Supabase secrets, OpenRouter keys, or MiniMax keys.
- AI provider selection (`openrouter` | `minimax`) and each provider’s API key
  are stored in Supabase Vault and updated only through the authenticated
  Settings screen via a Vercel API. Vault secret names: `AI_PROVIDER`,
  `OPENROUTER_API_KEY`, and `MINIMAX_API_KEY` (MiniMax Token Plan Subscription
  Key). The browser receives status only (active provider and configured /
  not-configured per provider), never plaintext keys. Server AI routes may fall
  back to `OPENROUTER_API_KEY` or `MINIMAX_API_KEY` in Vercel env if the matching
  Vault secret is empty.
- PIN verification, protected writes, and AI services run through a Vercel server-side API.
- Supabase Row Level Security (RLS) must restrict transaction tables. Transaction data must not be publicly readable or writable with a publishable/anonymous key.
- Public client configuration may use the project URL and publishable key (`sb_publishable_…`). The secret key (`sb_secret_…`, or legacy service-role) stays server-only.
- The installable app uses an Arabic RTL standalone PWA shell. Its service
  worker may cache static application assets and the route fallback, but it
  must exclude `/api/*` and must never cache transaction responses.
- `GET /api/health/supabase` is an operations-only endpoint protected by the
  server-only `DAWNLY_CRON_SECRET` in the `x-dawnly-cron-secret` header. The
  endpoint performs a minimal authenticated Supabase read, returns health
  status without transaction data, and is called once every 24 hours by a
  Cloudflare Worker Cron Trigger. The secret is never placed in a URL or sent
  to the browser.

## 8. Proposed technical architecture

| Layer | Choice |
| --- | --- |
| Frontend | React `19.2.8`, React DOM `19.2.8`, TypeScript `6.0.3`, MUI `9.2.0`, Vite `8.2.0`, `@vitejs/plugin-react` `6.0.5`, and `vite-plugin-pwa` `1.3.0`; RTL and PWA. |
| Hosting and API | Vercel for frontend hosting and Serverless Functions. |
| Database | Supabase PostgreSQL through `@supabase/supabase-js` `2.111.0`. |
| Local storage | IndexedDB through Dexie `4.4.4` for an offline-readable copy and queued unsynced operations. The database has `transactions`, `pendingMutations`, and `metadata` tables. |
| Data utilities | Papa Parse `5.5.4` for CSV and Zod `4.4.3` for shared validation. |
| AI | Browser `SpeechRecognition` (`ar-EG`) for Egyptian-Arabic transcription; OpenRouter (`openai/gpt-5.6-luna`) or MiniMax Token Plan (`MiniMax-M3`), server-side only, for field extraction. |
| Keep-alive | Cloudflare Cron runs a protected daily read/health request to avoid Supabase Free project inactivity. |
| Testing | Vitest `4.1.10`, Testing Library React `16.3.2`, and fake-indexeddb `6.2.5`, running against the same locked application versions. |

The dashboard stays in the initial client bundle for fast post-PIN rendering;
the import, ledger, person, and settings routes are loaded on demand so the
initial download remains small on mobile connections.

### Local-first synchronization

- The browser stores one validated local transaction shape and one validated
  mutation shape. Each queued mutation records its operation, transaction ID,
  payload, client mutation ID, attempt count, timestamps, and last error.
- Create, edit, and delete actions are written to IndexedDB before any network
  request. A single sequential worker replays the queue after unlock, after a
  local change, and when the browser reports that it is online.
- Protected server mutation routes record server-only idempotency receipts by
  client mutation ID. The browser never receives privileged Supabase access or
  the receipt store.
- A successful list response is cached locally and displayed immediately on a
  later unlock. When the server rejects a queued mutation because its version
  has changed, the server list replaces the local record and the interface
  explains the resolution in Arabic.

### Keep-alive notes

- The request secret is stored in Cloudflare and Vercel only, never in the browser.
- Cron calls a protected Vercel endpoint that performs a genuine health read from Supabase.
- The Cloudflare Worker keeps its health secret in an encrypted Worker Secret;
  Preview and Production use separate Worker environments and schedules.
- This is a practical Free-plan safeguard, not a replacement for local storage and CSV backups.

## 9. Data model

### `transactions` table

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | Unique internal identifier. |
| `name` | Text | Person's name after trimming excess whitespace. |
| `direction` | Enum | `receivable` for `ليّا`; `payable` for `عليّا`. |
| `amount` | Non-negative integer | Value in Egyptian pounds; `0` allowed for non-monetary entries. |
| `notes` | Text (nullable) | Optional `ملاحظات`; empty stored as null. |
| `transaction_date` | Date | Gregorian transaction date. |
| `currency` | Text | Fixed value: `EGP`. |
| `created_at` | Timestamp | Internal auditing and sync field. |
| `updated_at` | Timestamp | Internal editing and conflict-resolution field. |

### Sample data

- Sample data is inserted into Supabase once when the project is initialized.
- It appears on every device after the correct PIN is entered because it is shared application data.
- The project owner deletes it manually from Supabase after confirming the application works correctly.

## 10. Non-functional requirements

- The application must remain usable offline for viewing the last stored data and creating new changes locally.
- A confirmed entry must not be lost because of a network interruption.
- All user-facing errors and messages must be clear Arabic.
- Small-to-medium CSV imports must provide a clear review experience, even if the application internally processes the file in batches.
- The application must work well in modern desktop and mobile browsers.

## 11. Core acceptance criteria

1. Dawnly data cannot be accessed until a correct six-digit PIN is entered.
2. The PIN screen is locked for one minute after five incorrect attempts.
3. A user can manually add, edit, and delete a valid transaction.
4. The application accepts zero amounts and rejects negative and decimal amounts. Notes are optional.
5. Existing names are suggested while entering a transaction.
6. Voice recording stops on release, then displays the transcript and editable fields before save; original audio is not retained.
7. The application imports comma-separated CSV files and displays an editable preview before any row is added.
8. It prevents duplicates with matching name, direction, amount, date, and notes, while allowing transactions that differ by direction, date, or notes.
9. The dashboard clearly displays the total `ليّا` and total `عليّا`.
10. The latest locally stored data remains visible offline, and changes synchronize automatically when connectivity returns.
11. All data can be exported as CSV from Settings.
12. The application is Arabic and RTL in both light and dark modes, and can be installed as a PWA.

## 12. Suggested implementation phases

1. **Foundation:** RTL design, PIN, Supabase, transaction model, dashboard, and ledger.
2. **Reliability:** IndexedDB, synchronization queue, edit/delete, search and filters, and CSV export.
3. **Import:** CSV preview, validation, duplicate prevention, and confirmed import.
4. **Voice:** Hold-to-record interaction, transcription, field extraction, and review.
5. **Release:** PWA, dark mode, API/RLS security, Cloudflare Cron, and acceptance testing.
