// Sharing a Space with the Muse app: its item list goes to the Spaces server. Room photos never do;
// items marked Sell also send up to 3 small sale photos and their listing draft, so Muse can list them.
import { pictureOf } from './crop.js'
import { decisionOf, shareableFields } from './itemFields.js'
import { categoryOf, sortItems } from './spaceItems.js'

export const MAX_LISTING_PHOTOS = 3
const LISTING_PHOTO_PX = 640 // clear enough for a listing, small enough to send

const OWNER_KEY = 'spaces-owner-key'

// The owner key lives only on this phone. Storage can be blocked, so reading and writing never throw.
export function getOwnerKey() {
  try { return localStorage.getItem(OWNER_KEY) || '' } catch { return '' }
}
export function setOwnerKey(key) {
  try { localStorage.setItem(OWNER_KEY, key) } catch { /* the key just won't be remembered */ }
}

/**
 * What leaves the phone for a shared Space: item names, decisions and listing-safe details. Items
 * marked Sell add their listing draft. Photos are added when sending (see shareSpace); here, the
 * time an item last changed stands in for them, so a new sale photo makes the Space send again.
 */
export function sharePayload(space) {
  const { inSpace, nearby } = sortItems(space)
  const item = (i, isNearby) => ({
    name: i.name,
    description: i.description,
    quantity: i.quantity,
    category: categoryOf(i),
    nearby: isNearby,
    area: isNearby ? i.area : '',
    unsure: Boolean(i.needsReview),
    ...shareableFields(i),
    ...(decisionOf(i.status) === 'sell' && {
      listingTitle: i.listingDraft?.title ?? null,
      listingDescription: i.listingDraft?.description ?? null,
      changedAt: i.updatedAt ?? null,
    }),
  })
  return {
    name: space.spaceName,
    scannedAt: new Date(space.savedAt).toISOString(),
    items: [...inSpace.map(i => item(i, false)), ...nearby.map(i => item(i, true))],
  }
}

async function call(path, key, options = {}) {
  let res
  try {
    res = await fetch(`/api/shared${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${key}`, ...(options.body && { 'Content-Type': 'application/json' }) },
      signal: AbortSignal.timeout(30000),
    })
  } catch {
    throw new Error("Couldn't reach the Spaces server. Check your connection.")
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw Object.assign(new Error('That owner key is wrong.'), { wrongKey: true })
  if (!res.ok) throw new Error(data.error || `Sharing failed (${res.status}).`)
  return data
}

/** Checks the owner key and returns the ids of Spaces already shared. */
export const listShared = key => call('', key).then(d => d.ids)
/** Up to 3 sale photos for an item marked Sell, as small JPEGs; its scan picture if it has none. */
async function listingPhotos(item) {
  const sale = (item.salePhotos ?? []).slice(0, MAX_LISTING_PHOTOS)
  const photos = await Promise.all(sale.map(blob => pictureOf(blob, LISTING_PHOTO_PX).catch(() => null)))
  const usable = photos.filter(Boolean)
  return usable.length ? usable : item.picture?.startsWith('data:image/jpeg') ? [item.picture] : []
}

export async function shareSpace(space, key) {
  const payload = sharePayload(space)
  const { inSpace, nearby } = sortItems(space)
  const items = [...inSpace, ...nearby]
  payload.items = await Promise.all(payload.items.map(async (sent, n) => (
    decisionOf(sent.status) === 'sell' ? { ...sent, photos: await listingPhotos(items[n]) } : sent
  )))
  return call(`/${space.id}`, key, { method: 'PUT', body: JSON.stringify(payload) })
}
export const unshareSpace = (id, key) => call(`/${id}`, key, { method: 'DELETE' })
