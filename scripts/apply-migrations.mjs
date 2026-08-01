#!/usr/bin/env node
/**
 * Applies local SQL migrations to the linked Dawnly Supabase project.
 * Requires SUPABASE_ACCESS_TOKEN (personal access token with project access)
 * and project ref. Prefer the Supabase MCP apply_migration tool when available.
 *
 * Usage:
 *   set SUPABASE_ACCESS_TOKEN=...
 *   node scripts/apply-migrations.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_REF = 'qapysuvrqqobnmwcqyuz'
const token = process.env.SUPABASE_ACCESS_TOKEN

if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN before running this script.')
  process.exit(1)
}

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()

for (const file of files) {
  const query = readFileSync(join(migrationsDir, file), 'utf8')
  console.log(`Applying ${file}...`)

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )

  if (!response.ok) {
    const text = await response.text()
    console.error(`Failed on ${file}: ${response.status} ${text}`)
    process.exit(1)
  }

  console.log(`Applied ${file}`)
}

console.log('All migrations applied.')
