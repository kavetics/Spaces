// Tasks on a Space: chores like watering the plants. Plain code owns the dates: due tags, the next date
// after marking one done, and the first date of a task Muse suggested. Saved with the Space on this phone.

export const REPEATS = [['once', 'Once'], ['weekly', 'Weekly'], ['2weeks', 'Every 2 weeks'], ['monthly', 'Monthly']]
const REPEAT_IDS = REPEATS.map(([id]) => id)
export const MAX_TASK = 60

const DAY_MS = 24 * 60 * 60 * 1000
const pad = n => String(n).padStart(2, '0')
/** A date as YYYY-MM-DD in the phone's own time zone. */
export const isoDay = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const fromIso = day => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d) }
const daysFrom = (today, day) => Math.round((fromIso(day) - fromIso(today)) / DAY_MS)

export const repeatLabel = repeat => REPEATS.find(([id]) => id === repeat)?.[1] ?? 'Once'
export const isRepeat = repeat => REPEAT_IDS.includes(repeat)

/** The day after one repeat from a day: a week, two weeks, or the same date next month (or its last day). */
export function nextDue(repeat, from = isoDay()) {
  const date = fromIso(from)
  if (repeat === 'weekly') date.setDate(date.getDate() + 7)
  else if (repeat === '2weeks') date.setDate(date.getDate() + 14)
  else if (repeat === 'monthly') {
    const day = date.getDate()
    date.setDate(1)
    date.setMonth(date.getMonth() + 1)
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()))
  }
  return isoDay(date)
}

/**
 * When a task is due, in words, and how urgent: late (red), this week (gold) or later (grey).
 * "Due yesterday", "Due today", "Due Fri", "Nov 16".
 */
export function dueTag(task, today = isoDay()) {
  const days = daysFrom(today, task.due)
  const date = fromIso(task.due)
  const short = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (days < -1) return { label: `Late · ${short}`, level: 'late' }
  if (days === -1) return { label: 'Due yesterday', level: 'late' }
  if (days === 0) return { label: 'Due today', level: 'soon' }
  if (days === 1) return { label: 'Due tomorrow', level: 'soon' }
  if (days < 7) return { label: `Due ${date.toLocaleDateString(undefined, { weekday: 'short' })}`, level: 'soon' }
  return { label: short, level: 'later' }
}

/** Late or due within a week, and not done. */
export const isDueSoon = (task, today = isoDay()) => !task.doneAt && daysFrom(today, task.due) < 7

/** Open tasks, soonest first; done one-time tasks after them, most recent first. */
export function sortTasks(tasks = []) {
  const open = tasks.filter(t => !t.doneAt).sort((a, b) => a.due.localeCompare(b.due))
  const done = tasks.filter(t => t.doneAt).sort((a, b) => b.doneAt.localeCompare(a.doneAt))
  return { open, done }
}

/**
 * Marking a task done. A repeating task moves to one repeat after today; a one-time task is kept as done.
 * Returns the change, and the fields to put back for Undo.
 */
export function markDone(task, today = isoDay()) {
  const before = { due: task.due, doneAt: task.doneAt ?? null, lastDoneAt: task.lastDoneAt ?? null }
  const patch = task.repeat === 'once'
    ? { doneAt: new Date().toISOString() }
    : { due: nextDue(task.repeat, today), lastDoneAt: new Date().toISOString() }
  return { patch, before }
}

/** The Things a task is about that are still in the Space. Removed or rescanned ones drop out. */
export const thingsOf = (task, items) => (task.thingIds ?? []).map(id => items.find(i => i.id === id)).filter(Boolean)
/** Who does it, if they're still on the household list. */
export const personOf = (task, people) => people.find(p => p.id === task.personId) ?? null

/** "Weekly · Hrushank", or with where: "Backyard · Hrushank". */
export function taskLine(task, people, where) {
  return [where ?? repeatLabel(task.repeat), personOf(task, people)?.name].filter(Boolean).join(' · ')
}

const key = name => String(name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Plain-code checks on Muse's suggested tasks. A Thing must be in this Space, the person on the household
 * list and "how often" one of the four choices; anything else is dropped from the suggestion. Suggestions with
 * the same name and repeat become one task with all their Things ("Water the plants" with every plant),
 * and ones the Space already has are left out. The first date is today plus one repeat (today for Once).
 */
export function checkSuggestions(suggested, { things, people, existing = [], today = isoDay(), max = 5 }) {
  const thingIds = new Set(things.map(t => t.id))
  const personIds = new Set(people.map(p => p.id))
  const taken = new Set(existing.map(t => key(t.name)))
  const merged = new Map()
  for (const s of Array.isArray(suggested) ? suggested : []) {
    const name = String(s?.name ?? '').trim().slice(0, MAX_TASK)
    if (!name || taken.has(key(name)) || !isRepeat(s.repeat)) continue
    const ids = [...new Set((s.thingIds ?? []).filter(id => thingIds.has(id)))]
    const group = `${key(name)}|${s.repeat}`
    const same = merged.get(group)
    if (same) { same.thingIds = [...new Set([...same.thingIds, ...ids])]; continue }
    merged.set(group, {
      name,
      repeat: s.repeat,
      thingIds: ids,
      personId: personIds.has(s.personId) ? s.personId : null,
      due: s.repeat === 'once' ? today : nextDue(s.repeat, today),
      reason: String(s.reason ?? '').trim().slice(0, 160),
    })
  }
  return [...merged.values()].slice(0, max)
}

/** Before a rescan replaces the items: a task holds its Things by name, since the new ones get new ids. */
export function unlinkTask(task, items) {
  const { thingIds: _, ...rest } = task
  return { ...rest, thingIds: [], thingNames: task.thingNames ?? thingsOf(task, items).map(i => i.name) }
}

/** After the rescan: each task links to the new items with the same names. Ones not seen again drop out. */
export function relinkTasks(tasks, items) {
  if (!tasks) return tasks
  return tasks.map(({ thingNames, ...task }) => {
    if (!thingNames) return task
    const names = new Set(thingNames.map(n => n.toLowerCase()))
    return { ...task, thingIds: items.filter(i => names.has(i.name.toLowerCase())).map(i => i.id) }
  })
}
