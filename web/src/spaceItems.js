// Which of a Space's items count as in it or nearby, after the person's choices.
export function sortItems({ result, itemChoices = {}, areaChoices = {} }) {
  // Scans saved when choices were per area keep those choices until an item is changed.
  const choiceFor = item => itemChoices[item.id] ?? areaChoices[item.area]
  // Scans saved before Spaces had names have no area on their items, so those all count as in the Space.
  const isNearby = item => item.inSpace === false
  const items = result?.items ?? []
  // New items that may already be listed wait for the person to confirm, outside every other list.
  const confirmed = items.filter(i => i.possibleRepeatOf == null)
  return {
    // Scans saved when items could be left out and brought back may still have 'leave' choices, which stay hidden.
    inSpace: confirmed.filter(i => choiceFor(i) === 'add' || (!isNearby(i) && choiceFor(i) !== 'leave')),
    nearby: confirmed.filter(i => isNearby(i) && !choiceFor(i)),
    repeats: items.filter(i => i.possibleRepeatOf != null),
  }
}

export const countLabel = (n, noun = 'item') => (n === 1 ? `1 ${noun}` : `${n} ${noun}s`)
export const scannedDay = ms => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
export const scannedAt = ms => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

// In display order: what people care about most comes first, and Other is last.
export const CATEGORIES = [
  ['furniture', 'Furniture'],
  ['electronics', 'Electronics'],
  ['appliances', 'Appliances'],
  ['decor', 'Decor'],
  ['plants', 'Plants'],
  ['kitchen', 'Kitchen'],
  ['fitness_hobbies', 'Hobbies & gear'], // the id stays, so saved scans keep their items here
  ['other', 'Other'],
]
// Scans saved before the list was shortened used these names.
const OLD_CATEGORIES = { appliance: 'appliances', lighting: 'decor', textile: 'decor', storage: 'furniture', books_media: 'fitness_hobbies', plant: 'plants', tool: 'fitness_hobbies', outdoor: 'other', toy_game: 'fitness_hobbies', kitchenware: 'kitchen' }
export const categoryOf = item => {
  const category = OLD_CATEGORIES[item.category] ?? item.category
  return CATEGORIES.some(([id]) => id === category) ? category : 'other'
}
