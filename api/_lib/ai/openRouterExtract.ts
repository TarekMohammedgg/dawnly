import type { ExtractTransactionDraft } from '../../../src/types/api.js'
import {
  AI_EXTRACT_MAX_TOKENS,
  AI_EXTRACT_TEMPERATURE,
  AI_EXTRACT_TIMEOUT_MS,
  OPENROUTER_CHAT_URL,
  OPENROUTER_MODEL,
} from './aiConfig.js'
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
} from './extractionPrompt.js'
import { parseExtractionContent } from './parseExtraction.js'

type OpenRouterChoice = {
  message?: { content?: string | null }
}

type OpenRouterResponse = {
  choices?: OpenRouterChoice[]
}

export async function extractWithOpenRouter(
  apiKey: string,
  transcript: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExtractTransactionDraft> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, AI_EXTRACT_TIMEOUT_MS)

  try {
    const response = await fetchImpl(OPENROUTER_CHAT_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: AI_EXTRACT_TEMPERATURE,
        max_tokens: AI_EXTRACT_MAX_TOKENS,
        stream: false,
        reasoning: { effort: 'none' },
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: buildExtractionUserPrompt(transcript) },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`openrouter_http_${response.status}`)
    }

    const body = (await response.json()) as OpenRouterResponse
    const content = body.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('openrouter_empty')
    }

    return parseExtractionContent(content)
  } finally {
    clearTimeout(timer)
  }
}
