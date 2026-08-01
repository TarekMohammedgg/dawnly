import type { ExtractTransactionDraft } from '../../../src/types/api.js'
import type { AiProvider } from '../../../src/types/api.js'
import { extractWithMiniMax } from './miniMaxExtract.js'
import { extractWithOpenRouter } from './openRouterExtract.js'

export async function extractTransactionDraft(
  provider: AiProvider,
  apiKey: string,
  transcript: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExtractTransactionDraft> {
  if (provider === 'openrouter') {
    return extractWithOpenRouter(apiKey, transcript, fetchImpl)
  }

  return extractWithMiniMax(apiKey, transcript, fetchImpl)
}
