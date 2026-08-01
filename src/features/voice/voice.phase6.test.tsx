import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppThemeProvider } from '../../components/AppThemeProvider'
import { draftToFormValues } from '../../lib/voice/draftToFormValues'
import {
  TranscriptionError,
  type TranscriptionProvider,
  type TranscriptionResult,
} from '../../lib/voice/transcriptionProvider'
import { HoldToRecordButton } from './HoldToRecordButton'
import { VoiceReviewDialog } from './VoiceReviewDialog'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

afterEach(() => {
  cleanup()
})

function renderVoice(ui: ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>)
}

describe('draftToFormValues', () => {
  it('maps null draft fields to blank form inputs', () => {
    expect(
      draftToFormValues({
        name: null,
        direction: null,
        amount: null,
        notes: null,
        transaction_date: null,
        currency: 'EGP',
      }),
    ).toMatchObject({
      name: '',
      direction: '',
      amount: '',
      notes: '',
    })

    expect(
      draftToFormValues({
        name: 'أحمد',
        direction: 'payable',
        amount: 50,
        notes: 'سكر',
        transaction_date: '2026-08-01',
        currency: 'EGP',
      }),
    ).toEqual({
      name: 'أحمد',
      direction: 'payable',
      amount: '50',
      notes: 'سكر',
      transactionDate: '2026-08-01',
    })
  })
})

describe('HoldToRecordButton', () => {
  it('starts on pointer down and stops on pointer up', async () => {
    const user = userEvent.setup()
    const start = vi.fn(async () => undefined)
    const stop = vi.fn(
      async (): Promise<TranscriptionResult> => ({
        transcript: 'أحمد عليه ٥٠',
        confidence: 0.9,
      }),
    )
    const cancel = vi.fn()
    const onTranscript = vi.fn()

    const createProvider = (): TranscriptionProvider => ({
      isSupported: () => true,
      start,
      stop,
      cancel,
    })

    renderVoice(
      <HoldToRecordButton
        createProvider={createProvider}
        onTranscript={onTranscript}
        onUnsupportedManual={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', {
      name: 'اضغط مع الاستمرار للتسجيل',
    })

    await user.pointer({ keys: '[MouseLeft>]', target: button })
    expect(start).toHaveBeenCalledTimes(1)

    await user.pointer({ keys: '[/MouseLeft]', target: button })
    expect(stop).toHaveBeenCalledTimes(1)
    expect(onTranscript).toHaveBeenCalledWith({
      transcript: 'أحمد عليه ٥٠',
      confidence: 0.9,
    })
  })

  it('shows unsupported fallback and opens manual entry', async () => {
    const user = userEvent.setup()
    const onUnsupportedManual = vi.fn()

    renderVoice(
      <HoldToRecordButton
        createProvider={() => ({
          isSupported: () => false,
          start: async () => undefined,
          stop: async () => {
            throw new TranscriptionError('unsupported', 'unsupported')
          },
          cancel: () => undefined,
        })}
        onTranscript={vi.fn()}
        onUnsupportedManual={onUnsupportedManual}
      />,
    )

    expect(
      screen.getByText(/التسجيل الصوتي غير مدعوم في هذا المتصفح/),
    ).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'فتح الإدخال اليدوي' }))
    expect(onUnsupportedManual).toHaveBeenCalledTimes(1)
  })

  it('cancels on Escape without submitting a transcript', async () => {
    const user = userEvent.setup()
    const cancel = vi.fn()
    const onTranscript = vi.fn()
    let resolveStop: ((value: TranscriptionResult) => void) | null = null

    renderVoice(
      <HoldToRecordButton
        createProvider={() => ({
          isSupported: () => true,
          start: async () => undefined,
          stop: () =>
            new Promise<TranscriptionResult>((resolve) => {
              resolveStop = resolve
            }),
          cancel,
        })}
        onTranscript={onTranscript}
        onUnsupportedManual={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', {
      name: 'اضغط مع الاستمرار للتسجيل',
    })
    await user.pointer({ keys: '[MouseLeft>]', target: button })
    await user.keyboard('{Escape}')
    expect(cancel).toHaveBeenCalled()
    expect(onTranscript).not.toHaveBeenCalled()
    resolveStop?.({ transcript: 'should-not-fire', confidence: null })
  })
})

describe('VoiceReviewDialog', () => {
  it('requires explicit confirmation with edited values', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn(async () => undefined)
    const onCancel = vi.fn()

    renderVoice(
      <VoiceReviewDialog
        open
        transcript="أحمد عليه خمسين"
        initialValues={{
          name: 'أحمد',
          direction: 'payable',
          amount: '50',
          notes: '',
          transactionDate: '2026-08-01',
        }}
        nameSuggestions={['أحمد']}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByText('أحمد عليه خمسين')).toBeTruthy()

    const amount = screen.getByLabelText('المبلغ')
    await user.clear(amount)
    await user.type(amount, '60')
    await user.click(screen.getByRole('button', { name: 'تأكيد الحفظ' }))

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'أحمد',
        direction: 'payable',
        amount: 60,
        notes: null,
        transaction_date: '2026-08-01',
        currency: 'EGP',
      }),
    )
  })
})

describe('no audio retention', () => {
  it('voice modules never store MediaRecorder blobs or audio IndexedDB keys', () => {
    const roots = [
      resolve(process.cwd(), 'src/lib/voice'),
      resolve(process.cwd(), 'src/features/voice'),
      resolve(process.cwd(), 'api/_lib/ai'),
      resolve(process.cwd(), 'api/ai'),
    ]

    const banned = [
      'MediaRecorder',
      'createObjectURL',
      'audio/webm',
      'audio/ogg',
      'indexedDB.put',
      'Blob(',
    ]

    for (const root of roots) {
      const files = [
        'browserSpeechRecognition.ts',
        'transcriptionProvider.ts',
        'extractClient.ts',
        'draftToFormValues.ts',
        'HoldToRecordButton.tsx',
        'VoiceReviewDialog.tsx',
        'extract-transaction.ts',
        'openRouterExtract.ts',
        'miniMaxExtract.ts',
        'extractTransaction.ts',
        'parseExtraction.ts',
        'extractionPrompt.ts',
        'aiConfig.ts',
        'rateLimit.ts',
      ]

      for (const file of files) {
        const path = resolve(root, file)
        let source: string
        try {
          source = readFileSync(path, 'utf8')
        } catch {
          continue
        }
        for (const token of banned) {
          expect(source.includes(token), `${path} contains ${token}`).toBe(
            false,
          )
        }
      }
    }
  })
})
