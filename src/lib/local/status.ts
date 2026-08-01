import { dawnlyDb } from './database'
import type { LocalMetadata } from '../../types/local'

export const SYNC_NOTICE_KEY = 'syncNotice'

export type LocalSyncStatus = {
  online: boolean
  pendingCount: number
  notice: string | null
}

type StatusListener = () => void

const listeners = new Set<StatusListener>()

export function notifyLocalDataChanged(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeLocalDataChanged(listener: StatusListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function readOnlineState(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

export async function readLocalSyncStatus(): Promise<LocalSyncStatus> {
  const noticeRecord = await dawnlyDb.metadata.get(SYNC_NOTICE_KEY)
  return {
    online: readOnlineState(),
    pendingCount: await dawnlyDb.pendingMutations.count(),
    notice: noticeRecord?.value ?? null,
  }
}

export async function setSyncNotice(message: string | null): Promise<void> {
  if (message === null) {
    await dawnlyDb.metadata.delete(SYNC_NOTICE_KEY)
  } else {
    const notice: LocalMetadata = {
      key: SYNC_NOTICE_KEY,
      value: message,
      updatedAt: new Date().toISOString(),
    }
    await dawnlyDb.metadata.put(notice)
  }
  notifyLocalDataChanged()
}
