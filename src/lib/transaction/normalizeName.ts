/** Collapse whitespace and trim; matches server/DB name normalization. */
export function normalizePersonName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** Case-folded identity key for grouping a person's ledger. */
export function normalizePersonNameKey(name: string): string {
  return normalizePersonName(name).toLowerCase()
}
