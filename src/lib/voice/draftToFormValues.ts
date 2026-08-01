import { todayIsoDate } from '../format/date'
import type { TransactionFormValues } from '../transaction/formValidation'
import type { ExtractTransactionDraft } from '../../types/api'

/** Maps an AI draft into editable form values; null fields stay blank. */
export function draftToFormValues(
  draft: ExtractTransactionDraft,
): TransactionFormValues {
  return {
    name: draft.name ?? '',
    direction: draft.direction ?? '',
    amount: draft.amount != null ? String(draft.amount) : '',
    notes: draft.notes ?? '',
    transactionDate: draft.transaction_date ?? todayIsoDate(),
  }
}
