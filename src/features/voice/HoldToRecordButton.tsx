import MicIcon from '@mui/icons-material/Mic'
import MicNoneIcon from '@mui/icons-material/MicNone'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
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
      <Stack spacing={1.5}>
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
    )
  }

  return (
    <Stack spacing={1}>
      <Button
        type="button"
        variant={recording ? 'contained' : 'outlined'}
        color={recording ? 'error' : 'primary'}
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
          fontWeight: 700,
          minHeight: 48,
          alignSelf: 'stretch',
          gap: 1,
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {recording ? <MicIcon aria-hidden /> : <MicNoneIcon aria-hidden />}
        {recording ? 'جارٍ التسجيل… أفلت للحفظ' : 'اضغط مع الاستمرار للتسجيل'}
      </Button>
      <Typography variant="caption" color="text.secondary">
        تحدث باللهجة المصرية ثم أفلت للمراجعة قبل الحفظ
      </Typography>
      {statusError ? <Alert severity="error">{statusError}</Alert> : null}
    </Stack>
  )
}
