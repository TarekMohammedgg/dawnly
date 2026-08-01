export type TranscriptionResult = {
  transcript: string
  confidence: number | null
}

export type TranscriptionErrorCode =
  | 'unsupported'
  | 'permission_denied'
  | 'no_speech'
  | 'aborted'
  | 'network'
  | 'unknown'

export class TranscriptionError extends Error {
  readonly code: TranscriptionErrorCode

  constructor(code: TranscriptionErrorCode, message: string) {
    super(message)
    this.name = 'TranscriptionError'
    this.code = code
  }
}

export type TranscriptionProvider = {
  isSupported(): boolean
  start(): Promise<void>
  stop(): Promise<TranscriptionResult>
  cancel(): void
}
