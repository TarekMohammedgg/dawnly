import Dexie, { type Table } from 'dexie'
import type {
  LocalMetadata,
  LocalTransaction,
  StoredLocalTransaction,
  StoredPendingMutation,
} from '../../types/local'

export const LOCAL_DATABASE_NAME = 'dawnly-local'
/** v3: sensitive transaction and mutation payloads are encrypted. */
export const LOCAL_SCHEMA_VERSION = 3

export class DawnlyDatabase extends Dexie {
  declare transactions: Table<StoredLocalTransaction, string>
  declare pendingMutations: Table<StoredPendingMutation, string>
  declare metadata: Table<LocalMetadata, string>

  constructor() {
    super(LOCAL_DATABASE_NAME)
    this.version(1).stores({
      transactions: 'id, transactionDate, updatedAt, syncState',
      pendingMutations: 'clientMutationId, createdAt, transactionId',
      metadata: 'key',
    })

    this.version(2)
      .stores({
        transactions: 'id, transactionDate, updatedAt, syncState',
        pendingMutations: 'clientMutationId, createdAt, transactionId',
        metadata: 'key',
      })
      .upgrade(async (migrationTransaction) => {
        const rows = await migrationTransaction.table('transactions').toArray()
        for (const row of rows) {
          const next = row as LocalTransaction & { notes?: string | null }
          if (next.notes === undefined) {
            next.notes = null
            await migrationTransaction.table('transactions').put(next)
          }
        }
        await migrationTransaction.table('metadata').put({
          key: 'schemaVersion',
          value: '2',
          updatedAt: new Date().toISOString(),
        })
      })

    this.version(LOCAL_SCHEMA_VERSION)
      .stores({
        transactions: 'id, updatedAt, syncState',
        pendingMutations: 'clientMutationId, createdAt, transactionId, operation',
        metadata: 'key',
      })
      .upgrade(async (migrationTransaction) => {
        await migrationTransaction.table('metadata').put({
          key: 'schemaVersion',
          value: String(LOCAL_SCHEMA_VERSION),
          updatedAt: new Date().toISOString(),
        })
      })
  }
}

export const dawnlyDb = new DawnlyDatabase()

export async function clearLocalDatabase(): Promise<void> {
  await dawnlyDb.transaction(
    'rw',
    dawnlyDb.transactions,
    dawnlyDb.pendingMutations,
    dawnlyDb.metadata,
    async () => {
      await dawnlyDb.transactions.clear()
      await dawnlyDb.pendingMutations.clear()
      await dawnlyDb.metadata.clear()
    },
  )
}
