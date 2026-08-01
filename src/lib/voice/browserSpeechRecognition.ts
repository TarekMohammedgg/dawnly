import {
  TranscriptionError,
  type TranscriptionProvider,
  type TranscriptionResult,
} from './transcriptionProvider'

type SpeechRecognitionAlternativeLike = {
  transcript?: string
  confidence?: number
}

type SpeechRecognitionResultLike = {
  isFinal?: boolean
  length: number
  [index: number]: SpeechRecognitionAlternativeLike
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const root = globalThis as typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }

  return root.SpeechRecognition ?? root.webkitSpeechRecognition ?? null
}

export function isBrowserSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null
}

/**
 * Browser SpeechRecognition provider for Egyptian Arabic (`ar-EG`).
 * Does not capture or retain audio blobs.
 */
export function createBrowserTranscriptionProvider(): TranscriptionProvider {
  let recognition: SpeechRecognitionLike | null = null
  let running = false
  let finalTranscript = ''
  let interimTranscript = ''
  let bestConfidence: number | null = null
  let lastError: TranscriptionError | null = null
  let stopResolver: ((result: TranscriptionResult) => void) | null = null
  let stopRejecter: ((error: TranscriptionError) => void) | null = null

  function resetSessionState() {
    finalTranscript = ''
    interimTranscript = ''
    bestConfidence = null
    lastError = null
  }

  function clearHandlers() {
    if (!recognition) {
      return
    }
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
  }

  function finishStop() {
    const resolve = stopResolver
    const reject = stopRejecter
    stopResolver = null
    stopRejecter = null
    running = false
    clearHandlers()
    recognition = null

    if (lastError && lastError.code !== 'aborted' && !finalTranscript.trim() && !interimTranscript.trim()) {
      reject?.(lastError)
      return
    }

    const transcript = (finalTranscript || interimTranscript).trim()
    if (!transcript) {
      reject?.(
        new TranscriptionError(
          'no_speech',
          'لم يُسمع كلام واضح. حاول مرة أخرى',
        ),
      )
      return
    }

    resolve?.({
      transcript,
      confidence: bestConfidence,
    })
  }

  return {
    isSupported() {
      return isBrowserSpeechRecognitionSupported()
    },

    async start() {
      if (running) {
        return
      }

      const Ctor = getSpeechRecognitionConstructor()
      if (!Ctor) {
        throw new TranscriptionError(
          'unsupported',
          'التسجيل الصوتي غير مدعوم في هذا المتصفح. استخدم الإدخال اليدوي',
        )
      }

      resetSessionState()
      recognition = new Ctor()
      recognition.lang = 'ar-EG'
      recognition.continuous = true
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      recognition.onresult = (event) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]
          const alternative = result?.[0]
          const text = alternative?.transcript?.trim() ?? ''
          if (!text) {
            continue
          }

          if (typeof alternative?.confidence === 'number') {
            bestConfidence = alternative.confidence
          }

          if (result?.isFinal) {
            finalTranscript = `${finalTranscript} ${text}`.trim()
          } else {
            interim = `${interim} ${text}`.trim()
          }
        }
        interimTranscript = interim
      }

      recognition.onerror = (event) => {
        const code = event.error
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          lastError = new TranscriptionError(
            'permission_denied',
            'يلزم السماح باستخدام الميكروفون',
          )
        } else if (code === 'no-speech') {
          lastError = new TranscriptionError(
            'no_speech',
            'لم يُسمع كلام واضح. حاول مرة أخرى',
          )
        } else if (code === 'aborted') {
          lastError = new TranscriptionError('aborted', 'تم إلغاء التسجيل')
        } else if (code === 'network') {
          lastError = new TranscriptionError(
            'network',
            'تعذر الاتصال بخدمة التعرف على الكلام',
          )
        } else {
          lastError = new TranscriptionError(
            'unknown',
            'تعذر إكمال التسجيل الصوتي',
          )
        }
      }

      recognition.onend = () => {
        if (stopResolver || stopRejecter) {
          finishStop()
        } else {
          running = false
          clearHandlers()
          recognition = null
        }
      }

      running = true
      try {
        recognition.start()
      } catch {
        running = false
        clearHandlers()
        recognition = null
        throw new TranscriptionError(
          'unknown',
          'تعذر بدء التسجيل الصوتي',
        )
      }
    },

    stop() {
      if (!running || !recognition) {
        return Promise.reject(
          new TranscriptionError('aborted', 'لا يوجد تسجيل جارٍ'),
        )
      }

      return new Promise<TranscriptionResult>((resolve, reject) => {
        stopResolver = resolve
        stopRejecter = reject
        try {
          recognition?.stop()
        } catch {
          finishStop()
        }
      })
    },

    cancel() {
      stopResolver = null
      stopRejecter = null
      running = false
      resetSessionState()
      try {
        recognition?.abort()
      } catch {
        // ignore
      }
      clearHandlers()
      recognition = null
    },
  }
}
