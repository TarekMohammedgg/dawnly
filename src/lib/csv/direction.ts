import {
  DIRECTION_LABELS,
  type TransactionDirection,
} from '../../types/transaction'

const LABEL_TO_DIRECTION = new Map<string, TransactionDirection>(
  Object.entries(DIRECTION_LABELS).map(([direction, label]) => [
    label,
    direction as TransactionDirection,
  ]),
)

/** Maps an Arabic direction label to the internal enum; null if unrecognized. */
export function parseDirectionLabel(
  value: string,
): TransactionDirection | null {
  const trimmed = value.trim()
  return LABEL_TO_DIRECTION.get(trimmed) ?? null
}

export function directionToLabel(direction: TransactionDirection): string {
  return DIRECTION_LABELS[direction]
}
