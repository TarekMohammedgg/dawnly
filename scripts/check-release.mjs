import { readdir, readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'

const distDirectory = resolve('dist')
const requiredFiles = ['index.html', 'manifest.webmanifest', 'sw.js']
const secretEnvironmentNames = [
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DAWNLY_PIN_HASH',
  'DAWNLY_SESSION_SECRET',
  'DAWNLY_CRON_SECRET',
  'OPENROUTER_API_KEY',
  'MINIMAX_API_KEY',
]
const forbiddenClientMarkers = [
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DAWNLY_PIN_HASH',
  'DAWNLY_SESSION_SECRET',
  'DAWNLY_CRON_SECRET',
  'OPENROUTER_API_KEY',
  'MINIMAX_API_KEY',
  'sb_secret_',
]
const clientFileExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.svg',
  '.webmanifest',
])

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const entryPath = join(directory, entry.name)
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
    }),
  )
  return nestedFiles.flat()
}

async function readLocalSecretValues() {
  let localEnv
  try {
    localEnv = await readFile(resolve('.env.local'), 'utf8')
  } catch (cause) {
    if (cause?.code === 'ENOENT') {
      return []
    }
    throw cause
  }

  return localEnv
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/))
    .filter((match) => match && secretEnvironmentNames.includes(match[1]))
    .map((match) => match[2].replace(/^['"]|['"]$/g, '').trim())
    .filter((localSecretValue) => localSecretValue.length > 0)
}

function configuredSecretValues() {
  return secretEnvironmentNames
    .map((name) => process.env[name])
    .filter((configuredValue) => configuredValue && configuredValue.length > 0)
}

async function assertRequiredFiles() {
  for (const fileName of requiredFiles) {
    try {
      await readFile(join(distDirectory, fileName))
    } catch {
      throw new Error(`missing production artifact: ${fileName}`)
    }
  }
}

async function assertManifest() {
  const manifest = JSON.parse(
    await readFile(join(distDirectory, 'manifest.webmanifest'), 'utf8'),
  )
  const hasRequiredIconSizes = ['192x192', '512x512'].every((size) =>
    manifest.icons?.some((icon) => icon.sizes === size),
  )
  if (
    manifest.lang !== 'ar' ||
    manifest.dir !== 'rtl' ||
    manifest.display !== 'standalone' ||
    manifest.prefer_related_applications === true ||
    !hasRequiredIconSizes
  ) {
    throw new Error('manifest is missing the Arabic standalone PWA contract')
  }
}

async function assertNoSecrets(files) {
  const contents = await Promise.all(
    files
      .filter((filePath) => clientFileExtensions.has(extname(filePath)))
      .map(async (filePath) => [filePath, await readFile(filePath, 'utf8')]),
  )
  const secretValues = [
    ...configuredSecretValues(),
    ...(await readLocalSecretValues()),
  ]

  for (const [filePath, content] of contents) {
    if (forbiddenClientMarkers.some((marker) => content.includes(marker))) {
      throw new Error(`server-only environment marker found in ${filePath}`)
    }
    if (secretValues.some((secretValue) => content.includes(secretValue))) {
      throw new Error(`configured server-only value found in ${filePath}`)
    }
  }
}

async function main() {
  const files = await listFiles(distDirectory)
  await assertRequiredFiles()
  await assertManifest()
  await assertNoSecrets(files)
  console.log('Release check passed: PWA artifacts exist and no server-only values were bundled.')
}

try {
  await main()
} catch (cause) {
  console.error(
    `Release check failed: ${cause instanceof Error ? cause.message : 'unknown error'}`,
  )
  process.exitCode = 1
}
