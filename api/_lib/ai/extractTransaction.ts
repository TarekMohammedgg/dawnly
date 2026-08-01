import type { ExtractTransactionDraft } from '../../../src/types/api.ts'
import type { AiProvider } from '../../../src/types/api.ts'
import { extractWithMiniMax } from './miniMaxExtract.ts'
import { extractWithOpenRouter } from './openRouterExtract.ts'

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
