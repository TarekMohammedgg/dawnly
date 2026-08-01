#!/usr/bin/env node
import { randomBytes, scryptSync } from 'node:crypto'

const pin = process.argv[2]
if (!pin || !/^\d{6}$/.test(pin)) {
  console.error('Usage: node scripts/hash-pin.mjs <six-digit-pin>')
  process.exit(1)
}

const salt = randomBytes(16)
const derived = scryptSync(pin, salt, 64, { N: 16384, r: 8, p: 1 })
console.log(
  [
    'scrypt',
    '16384',
    '8',
    '1',
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$'),
)
