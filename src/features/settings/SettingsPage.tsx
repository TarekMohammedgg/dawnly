import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { apiFetch, ApiClientError } from '../../lib/api/client'
import { useAuthSession } from '../../lib/auth/sessionContext'
import { buildTransactionsCsv, downloadCsvFile } from '../../lib/csv/exportCsv'
import { readCachedTransactions } from '../../lib/local/transactions'
import { useAppRouter } from '../../lib/routing/routerContext'
import { APP_ROUTES } from '../../lib/routing/routes'
import { useColorMode } from '../../lib/theme/colorModeContext'
import type { AiKeyStatus, AiProvider } from '../../types/api'

const PROVIDER_LABELS: Record<AiProvider, string> = {
  openrouter: 'OpenRouter',
  minimax: 'MiniMax',
}

function providerKeyLabel(provider: AiProvider): string {
  return provider === 'minimax'
    ? 'مفتاح Token Plan لـ MiniMax'
    : 'مفتاح OpenRouter'
}

function isProviderConfigured(
  status: AiKeyStatus | null,
  provider: AiProvider,
): boolean {
  return Boolean(status?.[provider]?.configured)
}

type ThemeModeToggleProps = {
  checked: boolean
  onChange: (checked: boolean) => void
}

function ThemeModeToggle({ checked, onChange }: ThemeModeToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="تبديل الوضع الداكن"
      className="theme-mode-toggle"
      onClick={() => {
        onChange(!checked)
      }}
    >
      <span
        className="theme-mode-toggle__thumb"
        aria-hidden="true"
        style={{
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
        }}
      />
    </button>
  )
}

export function SettingsPage() {
  const { navigate } = useAppRouter()
  const { mode, setMode } = useColorMode()
  const { session, clearSession } = useAuthSession()
  const isDark = mode === 'dark'

  const [status, setStatus] = useState<AiKeyStatus | null>(null)
  const [provider, setProvider] = useState<AiProvider>('openrouter')
  const [apiKey, setApiKey] = useState('')
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [saving, setSaving] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exportMessage, setExportMessage] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      if (!session) {
        return
      }

      setLoadingStatus(true)
      setError(null)

      try {
        const next = await apiFetch<AiKeyStatus>('/api/settings/ai-key', {
          token: session.token,
        })
        if (!cancelled) {
          setStatus(next)
          setProvider(next.provider)
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof ApiClientError
              ? cause.message
              : 'تعذر قراءة حالة مفتاح API',
          )
        }
      } finally {
        if (!cancelled) {
          setLoadingStatus(false)
        }
      }
    }

    void loadStatus()
    return () => {
      cancelled = true
    }
  }, [session])

  async function onProviderChange(
    _event: MouseEvent<HTMLElement>,
    nextProvider: AiProvider | null,
  ) {
    if (!session || !nextProvider || nextProvider === provider) {
      return
    }

    setSwitching(true)
    setMessage(null)
    setError(null)
    setApiKey('')
    setProvider(nextProvider)

    try {
      const next = await apiFetch<AiKeyStatus>('/api/settings/ai-key', {
        method: 'PUT',
        token: session.token,
        body: { provider: nextProvider },
      })
      setStatus(next)
      setProvider(next.provider)
    } catch (cause) {
      setProvider(status?.provider ?? 'openrouter')
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'تعذر تبديل مزود الذكاء الاصطناعي',
      )
    } finally {
      setSwitching(false)
    }
  }

  async function onSaveKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) {
      return
    }

    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const next = await apiFetch<AiKeyStatus>('/api/settings/ai-key', {
        method: 'PUT',
        token: session.token,
        body: { provider, api_key: apiKey },
      })
      setStatus(next)
      setProvider(next.provider)
      setApiKey('')
      setMessage(`تم حفظ مفتاح ${PROVIDER_LABELS[next.provider]}`)
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : 'تعذر حفظ مفتاح API',
      )
    } finally {
      setSaving(false)
    }
  }

  async function onExportCsv() {
    setExporting(true)
    setExportMessage(null)
    setExportError(null)

    try {
      const transactions = await readCachedTransactions({})
      if (transactions.length === 0) {
        setExportError('لا توجد معاملات للتصدير')
        return
      }

      const csv = buildTransactionsCsv(transactions)
      downloadCsvFile('dawnly-backup.csv', csv)
      setExportMessage(`تم تصدير ${transactions.length} معاملة`)
    } catch {
      setExportError('تعذر تصدير النسخة الاحتياطية')
    } finally {
      setExporting(false)
    }
  }

  const busy = saving || switching || loadingStatus
  const configured = isProviderConfigured(status, provider)

  return (
    <Stack spacing={3}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 700 }}>
        الإعدادات
      </Typography>

      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: 360,
        }}
      >
        <Typography component="span" variant="body1" sx={{ fontWeight: 600 }}>
          الوضع الداكن
        </Typography>
        <ThemeModeToggle
          checked={isDark}
          onChange={(nextChecked) => {
            setMode(nextChecked ? 'dark' : 'light')
          }}
        />
      </Stack>

      <Stack
        component="form"
        onSubmit={onSaveKey}
        spacing={2.5}
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          pt: 3,
        }}
      >
        <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }}>
          مزود الذكاء الاصطناعي
        </Typography>

        <ToggleButtonGroup
          exclusive
          fullWidth
          color="primary"
          value={provider}
          onChange={onProviderChange}
          disabled={busy}
          aria-label="مزود الذكاء الاصطناعي"
          sx={{
            '& .MuiToggleButton-root': {
              fontWeight: 700,
              py: 1.25,
              color: 'text.secondary',
              borderColor: 'divider',
              transition:
                'background-color 160ms ease, border-color 160ms ease, color 160ms ease',
              '&:hover': {
                backgroundColor: 'action.hover',
                color: 'primary.main',
                borderColor: 'primary.main',
              },
              '&.Mui-selected': {
                backgroundColor: 'action.selected',
                color: 'primary.main',
                borderColor: 'primary.main',
                fontWeight: 800,
                '&:hover': {
                  backgroundColor: 'action.selected',
                },
              },
            },
          }}
        >
          <ToggleButton value="openrouter">OpenRouter</ToggleButton>
          <ToggleButton value="minimax">MiniMax</ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          الحالة:{' '}
          {loadingStatus
            ? 'جاري التحقق…'
            : configured
              ? 'مُعدّ'
              : 'غير مُعدّ'}
        </Typography>

        <TextField
          label={providerKeyLabel(provider)}
          type="password"
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value)
          }}
          autoComplete="off"
          fullWidth
          required
          disabled={busy}
          slotProps={{
            htmlInput: {
              'aria-label': providerKeyLabel(provider),
              minLength: 8,
            },
          }}
        />

        {message ? <Alert severity="success">{message}</Alert> : null}
        {error ? <Alert severity="error">{error}</Alert> : null}

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={busy || apiKey.trim().length < 8}
          sx={{ fontWeight: 700 }}
        >
          حفظ المفتاح
        </Button>
      </Stack>

      <Paper
        variant="outlined"
        sx={{ p: 2, borderRadius: 3, bgcolor: 'background.paper' }}
      >
        <Stack spacing={1.5}>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }}>
            إدارة البيانات
          </Typography>
          <Typography variant="body2" color="text.secondary">
            استورد معاملاتك من ملف CSV أو نزّل نسخة احتياطية من البيانات المحفوظة محليًا.
          </Typography>
          {exportMessage ? <Alert severity="success">{exportMessage}</Alert> : null}
          {exportError ? <Alert severity="error">{exportError}</Alert> : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Button
              variant="contained"
              size="large"
              startIcon={<UploadFileOutlinedIcon />}
              onClick={() => {
                navigate(APP_ROUTES.import)
              }}
              sx={{ fontWeight: 700 }}
            >
              استيراد CSV
            </Button>
            <Button
              variant="outlined"
              size="large"
              disabled={exporting}
              startIcon={<DownloadOutlinedIcon />}
              onClick={() => {
                void onExportCsv()
              }}
              sx={{ fontWeight: 700 }}
            >
              تصدير CSV
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Button
        variant="outlined"
        color="inherit"
        onClick={() => {
          clearSession()
        }}
        sx={{ alignSelf: 'start', fontWeight: 600 }}
      >
        تسجيل الخروج
      </Button>
    </Stack>
  )
}
