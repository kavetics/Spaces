// Links the home together: Space → area → category → item → the photo and spot it was seen in.
// Ask Muse sends this as its context, and citations follow it back to the photo.
import { CATEGORIES, categoryOf, scannedDay, sortItems } from './spaceItems.js'

function areaNode(items, startRef, name, nearby) {
  const categories = CATEGORIES.flatMap(([id, label]) => {
    const inCategory = items.filter(i => categoryOf(i) === id)
    return inCategory.length ? [{ name: label, items: inCategory.map(startRef) }] : []
  })
  return { name, nearby, categories }
}

/**
 * Builds the graph from finished Spaces. Removed items aren't in them, so they never reach Muse.
 * Returns what to send, plus each short reference's stable place: { spaceId, itemId, savedAt, name }.
 */
export function buildGraph(spaces) {
  const places = {}
  let next = 0
  const nodes = spaces.filter(s => s.result).map(space => {
    const { inSpace, nearby } = sortItems(space)
    const itemNode = item => {
      const ref = `i${next++}`
      places[ref] = { spaceId: space.id, itemId: item.id, savedAt: space.savedAt, name: item.name }
      return { ref, name: item.name, description: item.description, quantity: item.quantity, unsure: Boolean(item.needsReview) }
    }
    const nearbyAreas = [...new Set(nearby.map(i => i.area))]
    return {
      name: space.spaceName,
      scanned: scannedDay(space.savedAt),
      areas: [
        areaNode(inSpace, itemNode, '', false),
        ...nearbyAreas.map(area => areaNode(nearby.filter(i => i.area === area), itemNode, area, true)),
      ],
    }
  })
  return { nodes, places }
}

/** A citation's item, if it's still there: a rescan or removal since the answer means it isn't. */
export function findCited(spaces, { spaceId, itemId, savedAt }) {
  const space = spaces.find(s => s.id === spaceId)
  if (!space || space.savedAt !== savedAt) return null
  const item = space.result?.items.find(i => i.id === itemId)
  return item ? { space, item } : null
}
