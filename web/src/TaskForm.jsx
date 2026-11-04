import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { CheckboxList, CheckboxListItem } from '@astryxdesign/core/CheckboxList'
import { DateInput } from '@astryxdesign/core/DateInput'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Selector } from '@astryxdesign/core/Selector'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { CATEGORIES, categoryOf } from './spaceItems.js'
import { MAX_TASK, isRepeat, isoDay, nextDue } from './tasks.js'
import './Inventory.css'

// Short labels, so four fit across an iPhone.
const HOW_OFTEN = [['once', 'Once'], ['weekly', 'Weekly'], ['2weeks', '2 weeks'], ['monthly', 'Monthly']]
const NOBODY = 'nobody'

/** Choosing more Things for a task: the Space's others, by category, ticked and added together. onAdd(ids). */
function ThingPicker({ things, onAdd, onClose }) {
  const [picked, setPicked] = useState([])
  const close = open => { if (!open) onClose() }
  return (
    <Dialog isOpen onOpenChange={close} width={440}>
      <Layout
        header={<DialogHeader title="Add things to this task" onOpenChange={close} />}
        content={
          <LayoutContent>
            <VStack gap={4}>
              {things.length === 0 && <Text as="p" color="secondary">Every thing in this Space is already on this task.</Text>}
              {CATEGORIES.map(([id, label]) => {
                const inCategory = things.filter(t => categoryOf(t) === id)
                if (!inCategory.length) return null
                // One list per category; ticks from all of them are added together.
                const ids = inCategory.map(t => String(t.id))
                return (
                  <CheckboxList
                    key={id}
                    label={`${label} (${inCategory.length})`}
                    value={picked.filter(p => ids.includes(p))}
                    onChange={chosen => setPicked(p => [...p.filter(x => !ids.includes(x)), ...chosen])}
                  >
                    {inCategory.map(t => <CheckboxListItem key={t.id} value={String(t.id)} label={t.quantity > 1 ? `${t.name} × ${t.quantity}` : t.name} />)}
                  </CheckboxList>
                )
              })}
              <Button label={picked.length ? `Add ${picked.length === 1 ? '1 thing' : `${picked.length} things`}` : 'Add'} variant="primary" isDisabled={!picked.length} onClick={() => onAdd(picked)} />
            </VStack>
          </LayoutContent>
        }
      />
    </Dialog>
  )
}

/**
 * Adds a task to a Space, or changes one. A page that scrolls the document, like Add a person, so the
 * iPhone cursor stays in its field. things: the Space's Things to choose from; people: the household.
 * onSave({ name, repeat, due, personId, thingIds }); onRemove only when editing.
 */
export default function TaskForm({ task, spaceName, things, people, onSave, onRemove, onClose }) {
  const [name, setName] = useState(task?.name ?? '')
  const [repeat, setRepeat] = useState(task?.repeat ?? 'weekly')
  const [due, setDue] = useState(task?.due ?? isoDay())
  const [personId, setPersonId] = useState(task?.personId ?? NOBODY)
  const [thingIds, setThingIds] = useState((task?.thingIds ?? []).map(String))
  const [picking, setPicking] = useState(false)
  const ready = name.trim().length > 0 && Boolean(due)
  useEffect(() => { window.scrollTo(0, 0) }, [])

  function save() {
    if (!ready) return
    // Plain code keeps what's stored sensible: a short name, a known repeat, a real person and only this Space's Things.
    onSave({
      name: name.trim().slice(0, MAX_TASK),
      repeat: isRepeat(repeat) ? repeat : 'once',
      due,
      personId: people.some(p => p.id === personId) ? personId : null,
      thingIds: things.filter(t => thingIds.includes(String(t.id))).map(t => t.id),
    })
  }

  const chosen = things.filter(t => thingIds.includes(String(t.id)))
  return (
    <VStack gap={5} padding={4} className="page">
      <HStack><IconButton label={spaceName} icon={<Icon icon="chevronLeft" />} onClick={onClose} /></HStack>
      <Heading level={1}>{task ? 'Edit task' : 'Add a task'}</Heading>
      <form onSubmit={e => { e.preventDefault(); save() }}>
        <VStack gap={4}>
          <TextInput label="Task" placeholder="Water the plants" autoComplete="off" value={name} onChange={v => setName(v.slice(0, MAX_TASK))} />
          <VStack gap={1}>
            <Text type="label">How often</Text>
            <SegmentedControl label="How often" layout="fill" value={repeat} onChange={setRepeat}>
              {HOW_OFTEN.map(([id, label]) => <SegmentedControlItem key={id} value={id} label={label} />)}
            </SegmentedControl>
          </VStack>
          <VStack gap={1}>
            <DateInput label={repeat === 'once' ? 'Due' : 'Next due'} value={due} onChange={v => setDue(v ?? '')} />
            {repeat !== 'once' && due && <Text as="p" type="supporting" color="secondary">After that, {new Date(`${nextDue(repeat, due)}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, and so on. Marking it done sets the next date from that day.</Text>}
          </VStack>
          {people.length > 0
            ? <Selector label="Who" options={[{ value: NOBODY, label: 'No one yet' }, ...people.map(p => ({ value: p.id, label: p.name }))]} value={personId} onChange={setPersonId} />
            : <Text as="p" type="supporting" color="secondary">Add people on My home to choose who does it.</Text>}
          {/* Only what the task is for, each removable; more come from the Space's inventory. */}
          {things.length > 0 && (
            <VStack gap={1}>
              <Text type="label">{chosen.length ? `Things (${chosen.length})` : 'Things'}</Text>
              {chosen.length > 0
                ? (
                  <List hasDividers edge="flush">
                    {chosen.map(t => (
                      <ListItem
                        key={t.id}
                        label={t.quantity > 1 ? `${t.name} × ${t.quantity}` : t.name}
                        startContent={t.picture ? <img className="inventory-crop" src={t.picture} alt="" /> : <span className="inventory-crop" />}
                        endContent={<Button label="Remove" aria-label={`Remove from task: ${t.name}`} variant="ghost" className="quiet-action" onClick={() => setThingIds(ids => ids.filter(id => id !== String(t.id)))} />}
                      />
                    ))}
                  </List>
                )
                : <Text as="p" type="supporting" color="secondary">Optional. Link the things this task is for, like the plants to water.</Text>}
              <HStack><Button label="Add a thing" onClick={() => setPicking(true)} /></HStack>
            </VStack>
          )}
          <Button label={task ? 'Save changes' : 'Add task'} type="submit" variant="primary" isDisabled={!ready} />
          {task && <Button label="Delete task" variant="destructive" onClick={onRemove} />}
        </VStack>
      </form>
      {picking && (
        <ThingPicker
          things={things.filter(t => !thingIds.includes(String(t.id)))}
          onAdd={ids => { setThingIds(current => [...current, ...ids]); setPicking(false) }}
          onClose={() => setPicking(false)}
        />
      )}
    </VStack>
  )
}
