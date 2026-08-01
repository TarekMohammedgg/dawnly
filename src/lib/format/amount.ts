/** Formats a positive whole EGP amount for Arabic display. */
export function formatAmount(amount: number): string {
  return `${amount.toLocaleString('ar-EG')} ج.م`
}
