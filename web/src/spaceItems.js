// Which of a Space's items count as in it, nearby or left out, after the person's choices.
export function sortItems({ result, itemChoices = {}, areaChoices = {} }) {
  // Scans saved when choices were per area keep those choices until an item is changed.
  const choiceFor = item => itemChoices[item.id] ?? areaChoices[item.area]
  // Scans saved before Spaces had names have no area on their items, so those all count as in the Space.
  const isNearby = item => item.inSpace === false
  const items = result?.items ?? []
  return {
    inSpace: items.filter(i => choiceFor(i) === 'add' || (!isNearby(i) && choiceFor(i) !== 'leave')),
    leftOut: items.filter(i => choiceFor(i) === 'leave'),
    nearby: items.filter(i => isNearby(i) && !choiceFor(i)),
  }
}

export const countLabel = n => (n === 1 ? '1 item' : `${n} items`)
export const scannedDay = ms => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
export const scannedAt = ms => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
