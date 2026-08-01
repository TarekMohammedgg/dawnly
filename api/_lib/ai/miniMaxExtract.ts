import type { ExtractTransactionDraft } from '../../../src/types/api.ts'
import {
  AI_EXTRACT_MAX_TOKENS,
  AI_EXTRACT_TEMPERATURE,
  AI_EXTRACT_TIMEOUT_MS,
  MINIMAX_CHAT_URL,
  MINIMAX_MODEL,
} from './aiConfig.ts'
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from './extractionPrompt.ts'
import { parseExtractionContent } from './parseExtraction.ts'

type MiniMaxChoice = {
  message?: { content?: string | null }
}

type MiniMaxResponse = {
  choices?: MiniMaxChoice[]
}

export async function extractWithMiniMax(
  apiKey: string,
  transcript: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExtractTransactionDraft> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, AI_EXTRACT_TIMEOUT_MS)

  try {
    const response = await fetchImpl(MINIMAX_CHAT_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        temperature: AI_EXTRACT_TEMPERATURE,
        max_completion_tokens: AI_EXTRACT_MAX_TOKENS,
        stream: false,
        thinking: { type: 'disabled' },
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: buildExtractionUserPrompt(transcript) },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`minimax_http_${response.status}`)
    }

    const body = (await response.json()) as MiniMaxResponse
    const content = body.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('minimax_empty')
    }

    return parseExtractionContent(content)
  } finally {
    clearTimeout(timer)
  }
}
