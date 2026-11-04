import { useState } from 'react'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Divider } from '@astryxdesign/core/Divider'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import Initials from './Initials.jsx'
import { progress } from './itemFields.js'
import { sellingButton, sellingLists } from './Selling.jsx'
import { countLabel, sortItems } from './spaceItems.js'
import TaskList from './TaskList.jsx'
import { isDueSoon, isoDay } from './tasks.js'
import './Inventory.css'

// The dock's two starters: selling shows Decisions at work, what's due shows Tasks.
const DOCK_STARTERS = ['What could I sell?', "What's due this week?"]

function status(space, failed) {
  if (failed) return "Couldn't finish. Tap to try again."
  if (!space.result) return 'Finding things…'
  if (space.addFrames) return 'Adding photos…'
  const { inSpace } = sortItems(space)
  const { decided, total } = progress(inSpace)
  // Only what's left to do: decluttering progress once it has started. The scan date is on the Space itself.
  const decluttering = !decided ? null : decided === total ? 'All decided' : `${total - decided} to decide`
  return [countLabel(inSpace.length, 'thing'), decluttering].filter(Boolean).join(' · ')
}

function SpaceRow({ space, failed, people, onOpen }) {
  return (
    <ListItem
      // Small gold words by the name say Muse can see this Space, the same words as the Space's own pill.
      label={space.shared
        ? <HStack gap={2} vAlign="center" wrap="wrap"><Text>{space.spaceName}</Text><Text type="supporting" className="shared-label nowrap">Sharing with Muse</Text></HStack>
        : space.spaceName}
      description={status(space, failed)}
      startContent={space.cover ? <img className="inventory-crop" src={space.cover} alt="" /> : <span className="inventory-crop" />}
      endContent={<Initials people={people.filter(p => p.spaceIds?.includes(space.id))} />}
      onClick={onOpen}
    />
  )
}

// The Spaces and Tasks lists open and close; each one's state is remembered on this phone.
const OPEN_KEY = 'spaces-home-open'
const TASKS_KEY = 'tasks-home-open'
const savedOpen = key => { try { return localStorage.getItem(key) !== 'closed' } catch { return true } }
const saveOpen = (key, open) => { try { localStorage.setItem(key, open ? 'open' : 'closed') } catch { /* just not remembered */ } }

const andList = names => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0])

/** The home: its Spaces, the People who share them, what's due, the Decisions made so far, and Muse, which uses them all. */
export default function SpacesPage({ spaces, failed, processing, onOpen, onScanAnother, onAsk, onSelling, people, onPeople, onTaskChange }) {
  const ready = spaces.filter(s => s.result)
  const { toSell, toLetGo } = sellingLists(spaces)
  // What's still for sale is worth its asking prices, or Muse's estimates where no price is set, as on a Space.
  const toSellValue = toSell.reduce((sum, e) => sum + (e.item.details?.askingPrice ?? e.item.details?.estimatedValue?.amount ?? 0), 0)
  const decided = ready.reduce((n, s) => n + progress(sortItems(s).inSpace).decided, 0)
  const shared = ready.filter(s => s.shared).map(s => s.spaceName)
  const [spacesOpen, setSpacesOpen] = useState(() => savedOpen(OPEN_KEY))
  const [tasksOpen, setTasksOpen] = useState(() => savedOpen(TASKS_KEY))
  // Every open task in every Space, soonest first, so late and this week's come first. A task marked done here
  // stays in view until the page is left, so its Undo has something to point at.
  const today = isoDay()
  const allTasks = ready.flatMap(s => (s.tasks ?? []).map(t => ({ ...t, spaceId: s.id })))
  const [shownIds] = useState(() => new Set(allTasks.filter(t => !t.doneAt).map(t => t.id)))
  const due = allTasks.filter(t => !t.doneAt || shownIds.has(t.id)).sort((a, b) => a.due.localeCompare(b.due))
  const late = due.filter(t => !t.doneAt && t.due < today).length
  const openCount = allTasks.filter(t => !t.doneAt).length
  const dueOpen = due.filter(t => !t.doneAt && isDueSoon(t, today)).length
  const spaceOf = task => ready.find(s => s.id === task.spaceId)
  return (
    <VStack gap={5} padding={4} className="inventory">
      {/* Who shares the home is one line under its name, as on a Space. */}
      <VStack gap={2}>
        <Heading level={1}>My home</Heading>
        <HStack gap={2} vAlign="center">
          {people.length > 0 && <Initials people={people} />}
          <Text color="secondary" className="grow">{people.length ? andList(people.map(p => p.name)) : 'No one added yet'}</Text>
          <Button label={people.length ? 'Edit people' : 'Add people'} aria-label={people.length ? 'Edit people' : 'Add people'} variant="ghost" className="gold-link" onClick={onPeople} />
        </HStack>
      </VStack>

      {/* Scan a Space sits on the Spaces heading row, outside the dropdown's trigger, as Add does on Things. */}
      <VStack className="inventory-with-action spaces-with-scan">
        <Button label="Scan a Space" className="inventory-action" isDisabled={processing} onClick={onScanAnother} />
        <Collapsible className="inventory-action-trigger" isOpen={spacesOpen} onOpenChange={open => { setSpacesOpen(open); saveOpen(OPEN_KEY, open) }} trigger={<Heading level={2}>Spaces ({spaces.length})</Heading>}>
          <VStack gap={1}>
            <List hasDividers edge="flush">
              {spaces.map(space => <SpaceRow key={space.id} space={space} failed={failed[space.id]} people={people} onOpen={() => onOpen(space.id)} />)}
            </List>
            {processing && <Text as="p" color="secondary">You can scan another Space when this one finishes.</Text>}
          </VStack>
        </Collapsible>
      </VStack>

      <Divider />
      {/* The list button says what it opens and how many are left, full width under the line. */}
      <VStack gap={2}>
        <Heading level={2}>Decisions</Heading>
        <Text as="p" color="secondary">
          {/* Only what's for sale and roughly what it's worth; the rest is on the Sell & let go page. */}
          {toSell.length
            ? <>{toSell.length} to sell{toSellValue > 0 && <>, about <Badge label={`$${toSellValue}`} variant="green" className="money" /></>}</>
            : decided ? `${decided} decided` : 'Open a Space to declutter it.'}
        </Text>
        {sellingButton(spaces) && <Button label={toSell.length + toLetGo.length ? `Sell & let go (${toSell.length + toLetGo.length})` : 'See sold and gone'} onClick={onSelling} />}
      </VStack>

      <Divider />
      {/* A dropdown while there are tasks to list; otherwise a plain heading with one line, so there's nothing to open. */}
      {due.length > 0
        ? (
          <Collapsible isOpen={tasksOpen} onOpenChange={open => { setTasksOpen(open); saveOpen(TASKS_KEY, open) }} trigger={<Heading level={2}>{openCount ? `Tasks (${openCount})` : 'Tasks'}</Heading>}>
            <VStack gap={1}>
              <Text as="p" color="secondary">
                {dueOpen ? [`${dueOpen} due this week`, late && `${late} late`].filter(Boolean).join(' · ') : 'Nothing due this week.'}
              </Text>
              <TaskList
                tasks={due}
                people={people}
                itemsOf={task => spaceOf(task)?.result.items ?? []}
                where={task => spaceOf(task)?.spaceName}
                onChange={(task, patch) => onTaskChange(task.spaceId, task, patch)}
                onOpen={task => onOpen(task.spaceId)}
              />
            </VStack>
          </Collapsible>
        )
        : (
          <VStack gap={1}>
            <Heading level={2}>Tasks</Heading>
            <Text as="p" color="secondary">
              {allTasks.length ? 'All done.' : 'Open a Space to add tasks, or let Muse suggest some.'}
            </Text>
          </VStack>
        )}

      {/* Muse, always in reach at the bottom of My home. The bar only looks like a text box: it opens Ask Muse,
          where typing works well on iPhone; a fixed box here would misplace the cursor. A starter asks at once. */}
      {ready.length > 0 && (
        <VStack gap={2} className={shared.length ? 'muse-dock' : 'muse-dock dock-locked'} role="region" aria-label="Ask Muse">
          {/* Until a Space is shared, Muse has nothing to see: the dock shows greyed out and can't be tapped,
              and one line says how to turn it on. Sharing is opt-in, per Space. */}
          {shared.length === 0 && <Text as="p" type="supporting" color="secondary">Share a Space with Muse to ask about your home.</Text>}
          <HStack gap={2}>
            {DOCK_STARTERS.map(q => <Button key={q} label={q} size="sm" className="dock-chip" isDisabled={!shared.length} onClick={() => onAsk({ ask: q })} />)}
          </HStack>
          <Button
            label="Ask Muse about your home"
            className="dock-bar"
            isDisabled={!shared.length}
            onClick={() => onAsk({ focus: true })}
            endContent={<span className="dock-send"><Icon icon="arrowUp" size="sm" /></span>}
          />
        </VStack>
      )}
    </VStack>
  )
}
