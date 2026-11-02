// Sharing a Space with the Muse app: its item list goes to the Spaces server, never its photos.
import { shareableFields } from './itemFields.js'
import { categoryOf, sortItems } from './spaceItems.js'

const OWNER_KEY = 'spaces-owner-key'

// The owner key lives only on this phone. Storage can be blocked, so reading and writing never throw.
export function getOwnerKey() {
  try { return localStorage.getItem(OWNER_KEY) || '' } catch { return '' }
}
export function setOwnerKey(key) {
  try { localStorage.setItem(OWNER_KEY, key) } catch { /* the key just won't be remembered */ }
}

/** What leaves the phone for a shared Space: item names, decisions and listing-safe details. Never photos or private fields. */
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
export const shareSpace = (space, key) => call(`/${space.id}`, key, { method: 'PUT', body: JSON.stringify(sharePayload(space)) })
export const unshareSpace = (id, key) => call(`/${id}`, key, { method: 'DELETE' })
