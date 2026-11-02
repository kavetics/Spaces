// An item's decision and sale details, following the Spaces inventory item schema.
// Private fields stay on this phone: they're never sent to the server, Muse or a listing.

export const DECISIONS = [
  ['keep', 'Keep'],
  ['sell', 'Sell'],
  ['donate', 'Donate'],
  ['trash', 'Toss'],
]
export const decisionLabel = status => DECISIONS.find(([id]) => id === status)?.[1] ?? null

export const CONDITIONS = [
  ['like-new', 'Like new'],
  ['good', 'Good'],
  ['fair', 'Fair'],
  ['needs-repair', 'Needs repair'],
]
export const conditionLabel = c => CONDITIONS.find(([id]) => id === c)?.[1] ?? null

export const LISTING = [
  ['not-listed', 'Not listed'],
  ['draft', 'Draft'],
  ['listed', 'Listed'],
  ['sold', 'Sold'],
]

const PRIVATE = ['purchaseDate', 'purchasePrice', 'serialNumber']

/** The fields that may leave the phone: listing-safe details and the decision, never private ones. */
export function shareableFields(item) {
  const d = item.details ?? {}
  return {
    status: item.status ?? 'undecided',
    brand: d.brand ?? null,
    model: d.model ?? null,
    size: d.size ?? null,
    condition: d.condition ?? null,
    estimatedValue: d.estimatedValue?.amount ?? null,
    askingPrice: d.askingPrice ?? null,
    listingStatus: d.listingStatus ?? null,
  }
}

/**
 * Adds what the AI found to an item's details without overwriting anything the person typed.
 * Fields the AI filled are remembered, so the screen can label them until the person edits them.
 */
export function mergeAiDetails(details = {}, found) {
  const aiFields = new Set(details.aiFields ?? [])
  const next = { ...details }
  for (const [key, value] of Object.entries(found)) {
    if (PRIVATE.includes(key)) continue
    const empty = value == null || (Array.isArray(value) && !value.length) || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length)
    if (empty) continue
    const typedByPerson = next[key] != null && !aiFields.has(key)
    if (typedByPerson) continue
    next[key] = value
    aiFields.add(key)
  }
  return { ...next, aiFields: [...aiFields] }
}

/** A field the person changed is theirs now, so it loses its AI label. */
export function editDetail(details = {}, key, value) {
  return { ...details, [key]: value, aiFields: (details.aiFields ?? []).filter(f => f !== key) }
}

/** "12 of 30 decided", and what the items marked to sell might bring, for the Space header. */
export function progress(items) {
  const decided = items.filter(i => i.status && i.status !== 'undecided').length
  const selling = items.filter(i => i.status === 'sell')
  const value = selling.reduce((sum, i) => sum + (i.details?.askingPrice ?? i.details?.estimatedValue?.amount ?? 0), 0)
  return { decided, total: items.length, selling: selling.length, value }
}
