import 'fake-indexeddb/auto'
import { beforeAll } from 'vitest'
import { setLocalEncryptionKey } from '../lib/local/encryption'

beforeAll(async () => {
  await setLocalEncryptionKey('123456')
})
