const ENCRYPTED_PAYLOAD_VERSION = 'v1'
const AES_GCM_IV_BYTES = 12
const LOCAL_KEY_DERIVATION_ITERATIONS = 600_000
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

let localEncryptionKey: CryptoKey | null = null

function requireWebCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('تشفير التخزين المحلي غير متاح')
  }
  return globalThis.crypto
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function decodeBase64Url(encoded: string): Uint8Array<ArrayBuffer> {
  const padded = encoded.replaceAll('-', '+').replaceAll('_', '/')
  const padding = '='.repeat((4 - (padded.length % 4)) % 4)
  const binary = atob(`${padded}${padding}`)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function toOwnedBytes(rawText: string): Uint8Array<ArrayBuffer> {
  const encoded = textEncoder.encode(rawText)
  const ownedBytes = new Uint8Array(new ArrayBuffer(encoded.byteLength))
  ownedBytes.set(encoded)
  return ownedBytes
}

const localKeySalt = toOwnedBytes('dawnly-local-cache-v1')

function requireLocalEncryptionKey(): CryptoKey {
  if (!localEncryptionKey) {
    throw new Error('التخزين المحلي مقفول')
  }
  return localEncryptionKey
}

function serializeLocalJson(record: unknown): string {
  const serialized = JSON.stringify(record)
  if (serialized === undefined) {
    throw new Error('تعذر تجهيز بيانات التخزين المحلي')
  }
  return serialized
}

function createInitializationVector(cryptoApi: Crypto): Uint8Array<ArrayBuffer> {
  const initializationVector = new Uint8Array(
    new ArrayBuffer(AES_GCM_IV_BYTES),
  )
  cryptoApi.getRandomValues(initializationVector)
  return initializationVector
}

function formatEncryptedPayload(
  initializationVector: Uint8Array,
  ciphertext: Uint8Array,
): string {
  return [
    ENCRYPTED_PAYLOAD_VERSION,
    encodeBase64Url(initializationVector),
    encodeBase64Url(ciphertext),
  ].join('.')
}

function parseEncryptedPayload(payload: string): {
  initializationVector: Uint8Array<ArrayBuffer>
  ciphertext: Uint8Array<ArrayBuffer>
} {
  const [version, encodedIv, encodedCiphertext] = payload.split('.')
  if (
    version !== ENCRYPTED_PAYLOAD_VERSION ||
    !encodedIv ||
    !encodedCiphertext
  ) {
    throw new Error('بيانات التخزين المحلي غير صالحة')
  }

  return {
    initializationVector: decodeBase64Url(encodedIv),
    ciphertext: decodeBase64Url(encodedCiphertext),
  }
}

export async function setLocalEncryptionKey(pin: string): Promise<void> {
  const cryptoApi = requireWebCrypto()
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    toOwnedBytes(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  localEncryptionKey = await cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: localKeySalt,
      iterations: LOCAL_KEY_DERIVATION_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function clearLocalEncryptionKey(): void {
  localEncryptionKey = null
}

export async function encryptLocalJson(record: unknown): Promise<string> {
  const cryptoApi = requireWebCrypto()
  const encryptionKey = requireLocalEncryptionKey()
  const serialized = serializeLocalJson(record)
  const initializationVector = createInitializationVector(cryptoApi)
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv: initializationVector },
    encryptionKey,
    toOwnedBytes(serialized),
  )
  return formatEncryptedPayload(initializationVector, new Uint8Array(encrypted))
}

export async function decryptLocalJson<T>(payload: string): Promise<T> {
  const cryptoApi = requireWebCrypto()
  const encryptionKey = requireLocalEncryptionKey()
  const encryptedPayload = parseEncryptedPayload(payload)
  const decrypted = await cryptoApi.subtle.decrypt(
    { name: 'AES-GCM', iv: encryptedPayload.initializationVector },
    encryptionKey,
    encryptedPayload.ciphertext,
  )
  return JSON.parse(textDecoder.decode(decrypted)) as T
}
