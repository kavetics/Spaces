import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { useToast } from '@astryxdesign/core/Toast'
import { countLabel } from './spaceItems.js'
import { dueTag, markDone, taskLine, thingsOf } from './tasks.js'

const UNDO_MS = 6000
const TAG = { late: 'red', soon: 'yellow', later: 'neutral' }
// Short enough for the end of a row: "Due today" → "Today", "Due Fri" → "Fri".
const shortTag = label => label.replace(/^Due (\w)/, (_, c) => c.toUpperCase())
/**
 * Tasks as rows: a box to mark each done, its name over how often or where, who and how many Things,
 * and when it's due at the end of the row.
 * Marking one done is immediate and gets a few seconds of Undo. items: the Space's, for its Things;
 * where(task) names its Space on My home.
 */
export default function TaskList({ tasks, people, itemsOf, where, onChange, onOpen }) {
  const toast = useToast()
  // A one-time task with no one and no Space name to show has nothing to add under its name: the date says it.
  const line = (task, things) => {
    const text = [taskLine(task, people, where?.(task)), things.length > 1 && countLabel(things.length, 'thing')].filter(Boolean).join(' · ')
    return text === 'Once' ? null : text
  }
  function done(task) {
    if (task.doneAt) { onChange(task, { doneAt: null }); return }
    const { patch, before } = markDone(task)
    onChange(task, patch)
    const body = task.repeat === 'once' ? `Done: ${task.name}` : `Done. Next: ${dueTag({ due: patch.due }).label.replace(/^Due /, '')}`
    const dismiss = toast({ body, autoHideDuration: UNDO_MS, endContent: <Button label="Undo" onClick={() => { onChange(task, before); dismiss() }} /> })
  }
  return (
    <List hasDividers edge="flush" className="task-list">
      {tasks.map(task => {
        const things = thingsOf(task, itemsOf(task))
        const tag = task.doneAt ? null : dueTag(task)
        return (
          <ListItem
            key={task.id}
            align="start"
            label={<Text as="p" className={task.doneAt ? 'task-done' : undefined}>{task.name}</Text>}
            description={line(task, things) && <Text as="p" type="supporting">{line(task, things)}</Text>}
            onClick={() => onOpen(task)}
            startContent={<CheckboxInput label={`${task.doneAt ? 'Not done' : 'Done'}: ${task.name}`} isLabelHidden value={Boolean(task.doneAt)} onChange={() => done(task)} />}
            endContent={tag && <Badge label={shortTag(tag.label)} variant={TAG[tag.level]} className={tag.level === 'late' ? 'let-go-tag' : undefined} />}
          />
        )
      })}
    </List>
  )
}
