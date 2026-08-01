import MicIcon from '@mui/icons-material/Mic'
import MicNoneIcon from '@mui/icons-material/MicNone'
import KeyboardVoiceRoundedIcon from '@mui/icons-material/KeyboardVoiceRounded'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createBrowserTranscriptionProvider } from '../../lib/voice/browserSpeechRecognition'
import {
  TranscriptionError,
  type TranscriptionProvider,
  type TranscriptionResult,
} from '../../lib/voice/transcriptionProvider'

type HoldToRecordButtonProps = {
  disabled?: boolean
  onTranscript: (result: TranscriptionResult) => void
  onUnsupportedManual: () => void
  onError?: (message: string) => void
  createProvider?: () => TranscriptionProvider
}

export function HoldToRecordButton({
  disabled = false,
  onTranscript,
  onUnsupportedManual,
  onError,
  createProvider = createBrowserTranscriptionProvider,
}: HoldToRecordButtonProps) {
  const provider = useMemo(() => createProvider(), [createProvider])
  const providerRef = useRef(provider)
  const recordingRef = useRef(false)
  const [recording, setRecording] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const supported = provider.isSupported()

  useEffect(() => {
    providerRef.current = provider
  }, [provider])

  useEffect(() => {
    return () => {
      provider.cancel()
      recordingRef.current = false
    }
  }, [provider])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && recordingRef.current) {
        event.preventDefault()
        providerRef.current.cancel()
        recordingRef.current = false
        setRecording(false)
        setStatusError(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  async function beginRecording() {
    if (disabled || recordingRef.current) {
      return
    }

    if (!providerRef.current.isSupported()) {
      return
    }

    setStatusError(null)
    recordingRef.current = true
    setRecording(true)

    try {
      await providerRef.current.start()
    } catch (cause) {
      recordingRef.current = false
      setRecording(false)
      const message =
        cause instanceof TranscriptionError
          ? cause.message
          : 'تعذر بدء التسجيل الصوتي'
      setStatusError(message)
      onError?.(message)
    }
  }

  async function endRecording() {
    if (!recordingRef.current) {
      return
    }

    recordingRef.current = false
    setRecording(false)

    try {
      const result = await providerRef.current.stop()
      onTranscript(result)
    } catch (cause) {
      if (cause instanceof TranscriptionError && cause.code === 'aborted') {
        return
      }
      const message =
        cause instanceof TranscriptionError
          ? cause.message
          : 'تعذر إكمال التسجيل الصوتي'
      setStatusError(message)
      onError?.(message)
    }
  }

  function cancelRecording() {
    if (!recordingRef.current) {
      return
    }
    providerRef.current.cancel()
    recordingRef.current = false
    setRecording(false)
  }

  if (!supported) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 2, borderRadius: 4, bgcolor: 'background.paper' }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 42,
                height: 42,
                borderRadius: 2.5,
                bgcolor: 'info.light',
                color: 'info.dark',
              }}
            >
              <KeyboardVoiceRoundedIcon />
            </Box>
            <Typography variant="h6">التسجيل الصوتي</Typography>
          </Stack>
          <Alert severity="info">
            التسجيل الصوتي غير مدعوم في هذا المتصفح. استخدم الإدخال اليدوي لإضافة
            معاملة.
          </Alert>
          <Button
            variant="outlined"
            size="large"
            onClick={onUnsupportedManual}
            sx={{ fontWeight: 700, minHeight: 48 }}
          >
            فتح الإدخال اليدوي
          </Button>
        </Stack>
      </Paper>
    )
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 4,
        borderColor: recording ? 'error.main' : 'secondary.main',
        bgcolor: recording ? 'error.light' : 'secondary.light',
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 2.5,
              bgcolor: 'secondary.main',
              color: 'secondary.contrastText',
            }}
          >
            <KeyboardVoiceRoundedIcon />
          </Box>
          <Box>
            <Typography variant="h6">سجّلها بصوتك</Typography>
            <Typography variant="body2" color="text.secondary">
              أسرع طريقة لإضافة معاملة جديدة
            </Typography>
          </Box>
        </Stack>
        <Button
          type="button"
          variant="contained"
          color={recording ? 'error' : 'secondary'}
          size="large"
          disabled={disabled}
          aria-pressed={recording}
          aria-label={
            recording ? 'جارٍ التسجيل، أفلت للإيقاف' : 'اضغط مع الاستمرار للتسجيل'
          }
          onPointerDown={(event) => {
            event.preventDefault()
            void beginRecording()
          }}
          onPointerUp={() => {
            void endRecording()
          }}
          onPointerCancel={() => {
            cancelRecording()
          }}
          onPointerLeave={() => {
            if (recordingRef.current) {
              void endRecording()
            }
          }}
          onContextMenu={(event) => {
            event.preventDefault()
          }}
          sx={{
            minHeight: 74,
            justifyContent: 'flex-start',
            gap: 1.5,
            px: 1.5,
            textAlign: 'right',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          <Box
            className={recording ? 'dawnly-recording-pulse' : undefined}
            sx={{
              display: 'inline-flex',
              flex: '0 0 auto',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'rgba(255, 255, 255, 0.18)',
            }}
          >
            {recording ? <MicIcon aria-hidden /> : <MicNoneIcon aria-hidden />}
          </Box>
          <Stack
            component="span"
            spacing={0.15}
            sx={{ alignItems: 'flex-start' }}
          >
            <Typography component="span" variant="body1" sx={{ fontWeight: 800 }}>
              {recording ? 'جارٍ التسجيل… أفلت للحفظ' : 'اضغط مع الاستمرار للتسجيل'}
            </Typography>
            <Typography component="span" variant="caption" sx={{ opacity: 0.84 }}>
              {recording ? 'اترك الزر عندما تنتهي' : 'ثم راجع البيانات قبل الحفظ'}
            </Typography>
          </Stack>
        </Button>
        <Typography variant="caption" color="text.secondary">
          تحدث باللهجة المصرية ثم أفلت للمراجعة قبل الحفظ
        </Typography>
        {statusError ? <Alert severity="error">{statusError}</Alert> : null}
      </Stack>
    </Paper>
  )
}
