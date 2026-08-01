import Alert from '@mui/material/Alert'
import { useEffect, useState } from 'react'
import {
  readLocalSyncStatus,
  subscribeLocalDataChanged,
  type LocalSyncStatus,
} from '../../lib/local/status'

function initialStatus(): LocalSyncStatus {
  return {
    online: typeof navigator === 'undefined' || navigator.onLine,
    pendingCount: 0,
    notice: null,
  }
}

export function SyncStatusIndicator() {
  const [status, setStatus] = useState<LocalSyncStatus>(initialStatus)

  useEffect(() => {
    let cancelled = false
    const refreshStatus = () => {
      void readLocalSyncStatus().then((nextStatus) => {
        if (!cancelled) {
          setStatus(nextStatus)
        }
      })
    }
    const unsubscribe = subscribeLocalDataChanged(refreshStatus)
    const refreshConnectivity = () => refreshStatus()

    refreshStatus()
    window.addEventListener('online', refreshConnectivity)
    window.addEventListener('offline', refreshConnectivity)

    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('online', refreshConnectivity)
      window.removeEventListener('offline', refreshConnectivity)
    }
  }, [])

  if (status.notice) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        {status.notice}
      </Alert>
    )
  }

  if (!status.online) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        أنت غير متصل بالإنترنت. ستُحفظ التغييرات محليًا وتتم مزامنتها تلقائيًا عند عودة الاتصال.
      </Alert>
    )
  }

  if (status.pendingCount > 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        توجد تغييرات في انتظار المزامنة. ستُحفظ تلقائيًا.
      </Alert>
    )
  }

  return null
}
