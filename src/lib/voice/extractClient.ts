import { apiFetch } from '../api/client'
import type {
  ExtractTransactionRequest,
  ExtractTransactionResponse,
} from '../../types/api'

export async function extractTransactionFromTranscript(
  token: string,
  transcript: string,
): Promise<ExtractTransactionResponse> {
  const body: ExtractTransactionRequest = { transcript }
  return apiFetch<ExtractTransactionResponse>('/api/ai/extract-transaction', {
    method: 'POST',
    token,
    body,
  })
}
