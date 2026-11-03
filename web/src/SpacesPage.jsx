import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Collapsible } from '@astryxdesign/core/Collapsible'
import { Divider } from '@astryxdesign/core/Divider'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import Initials, { peopleLabel } from './Initials.jsx'
import { progress } from './itemFields.js'
import { sellingButton, sellingLists } from './Selling.jsx'
import { countLabel, scannedDay, sortItems } from './spaceItems.js'
import './Inventory.css'

function status(space, failed) {
  if (failed) return "Couldn't finish. Tap to try again."
  if (!space.result) return 'Finding things…'
  if (space.addFrames) return 'Adding photos…'
  const { inSpace } = sortItems(space)
  const { decided, total } = progress(inSpace)
  // Decluttering progress shows once it has started.
  const decluttering = !decided ? null : decided === total ? 'All decided' : `${total - decided} left to decide`
  return [countLabel(inSpace.length, 'thing'), decluttering, `Scanned ${scannedDay(space.savedAt)}`].filter(Boolean).join(' · ')
}

function SpaceRow({ space, failed, people, onOpen }) {
  return (
    <ListItem
      label={space.spaceName}
      description={status(space, failed)}
      startContent={space.cover ? <img className="inventory-crop" src={space.cover} alt="" /> : <span className="inventory-crop" />}
      endContent={<Initials people={people.filter(p => p.spaceIds?.includes(space.id))} />}
      onClick={onOpen}
    />
  )
}

// The Spaces list opens and closes; its state is remembered on this phone.
const OPEN_KEY = 'spaces-home-open'
const savedOpen = () => { try { return localStorage.getItem(OPEN_KEY) !== 'closed' } catch { return true } }
const saveOpen = open => { try { localStorage.setItem(OPEN_KEY, open ? 'open' : 'closed') } catch { /* just not remembered */ } }

const SHOW_SHARING = import.meta.env.VITE_SHOW_SHARING === 'true'
const andList = names => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0])

/** The home: its Spaces, the People who share them, the Decisions made so far, and Muse, which uses all three. */
export default function SpacesPage({ spaces, failed, processing, onOpen, onScanAnother, onAsk, onSelling, people, onPeople }) {
  const ready = spaces.filter(s => s.result)
  const { toSell, toLetGo, sold, gone } = sellingLists(spaces)
  const decided = ready.reduce((n, s) => n + progress(sortItems(s).inSpace).decided, 0)
  const shared = ready.filter(s => s.shared).map(s => s.spaceName)
  const [spacesOpen, setSpacesOpen] = useState(savedOpen)
  return (
    <VStack gap={5} padding={4} className="inventory">
      <HStack gap={2} vAlign="center" hAlign="between">
        <Heading level={1}>Your home</Heading>
        <Button label="Scan a Space" size="sm" isDisabled={processing} onClick={onScanAnother} />
      </HStack>

      <Collapsible isOpen={spacesOpen} onOpenChange={open => { setSpacesOpen(open); saveOpen(open) }} trigger={<Heading level={2}>Spaces ({spaces.length})</Heading>}>
        <VStack gap={1}>
          <List hasDividers edge="flush">
            {spaces.map(space => <SpaceRow key={space.id} space={space} failed={failed[space.id]} people={people} onOpen={() => onOpen(space.id)} />)}
          </List>
          {processing && <Text as="p" color="secondary">You can scan another Space when this one finishes.</Text>}
        </VStack>
      </Collapsible>

      <Divider />
      <HStack gap={2} vAlign="center" hAlign="between">
        <VStack gap={1}>
          <Heading level={2}>People</Heading>
          {people.length
            ? (
              <HStack gap={2} vAlign="center">
                <Initials people={people} />
                <Text as="p" color="secondary">{peopleLabel(people.length)} · {andList(people.map(p => p.name))}</Text>
              </HStack>
            )
            : <Text as="p" color="secondary">Add who shares your home.</Text>}
        </VStack>
        <Button label={people.length ? 'Edit' : 'Add'} aria-label={people.length ? 'Edit people' : 'Add people'} size="sm" onClick={onPeople} />
      </HStack>

      <Divider />
      <HStack gap={2} vAlign="center" hAlign="between">
        <VStack gap={0}>
          <Heading level={2}>Decisions</Heading>
          <Text as="p" color="secondary">
            {toSell.length || toLetGo.length || sold.length || gone.length
              ? [toSell.length && `${toSell.length} for sale`, toLetGo.length && `${toLetGo.length} to let go`, sold.length && `${sold.length} sold`, gone.length && `${gone.length} gone`].filter(Boolean).join(' · ')
              : decided ? `${decided} decided, all kept` : 'Open a Space to declutter it.'}
          </Text>
        </VStack>
        {sellingButton(spaces) && <Button label="See list" aria-label="For sale and letting go" size="sm" onClick={onSelling} />}
      </HStack>

      {ready.length > 0 && (
        <>
          <Divider />
          <VStack gap={2}>
            <Heading level={2}>Muse</Heading>
            <Text as="p" color="secondary">
              {SHOW_SHARING
                ? (shared.length ? `Muse in the Meta AI app can see: ${andList(shared)}.` : 'Turn on Muse in a Space to let the Meta AI app use it.')
                : 'Ask about your things, people and decisions, across every Space.'}
            </Text>
            <Button label="Ask Muse" variant="primary" size="lg" onClick={onAsk} />
          </VStack>
        </>
      )}
    </VStack>
  )
}
