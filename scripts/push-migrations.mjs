#!/usr/bin/env node
/**
 * Push local SQL migrations to the live Dawnly Postgres database.
 *
 * Requires in `.env.local`:
 *   SUPABASE_DB_PASSWORD=...  (quote if it contains #)
 * Optional:
 *   SUPABASE_DB_URL=postgresql://...
 *
 * Usage:
 *   node scripts/push-migrations.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const PROJECT_REF = 'qapysuvrqqobnmwcqyuz'

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) {
    return {}
  }

  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        let value = line.slice(index + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        return [line.slice(0, index).trim(), value]
      }),
  )
}

const env = loadEnvLocal()
const password = env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD

if (!password && !env.SUPABASE_DB_URL) {
  console.error(
    'Missing SUPABASE_DB_PASSWORD or SUPABASE_DB_URL in .env.local',
  )
  process.exit(1)
}

const encodedPassword = password ? encodeURIComponent(password) : ''
const candidates = [
  env.SUPABASE_DB_URL,
  password
    ? `postgresql://postgres.${PROJECT_REF}:${encodedPassword}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`
    : null,
].filter(Boolean)

console.log('Pushing migrations to live project', PROJECT_REF, '...')

for (const dbUrl of candidates) {
  const result = spawnSync(
    'npx',
    ['supabase', 'db', 'push', '--db-url', dbUrl, '--yes', '--include-all'],
    {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env },
    },
  )

  if (result.status === 0) {
    console.log('Migrations pushed successfully.')
    process.exit(0)
  }
}

process.exit(1)
