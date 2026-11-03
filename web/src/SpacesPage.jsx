import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { progress } from './itemFields.js'
import { countLabel, scannedDay, sortItems } from './spaceItems.js'
import './Inventory.css'

function status(space, failed) {
  if (failed) return "Couldn't finish. Tap to try again."
  if (!space.result) return 'Finding items…'
  if (space.addFrames) return 'Adding photos…'
  const { inSpace } = sortItems(space)
  const { decided, total } = progress(inSpace)
  // Decluttering progress shows once it has started.
  const decluttering = !decided ? null : decided === total ? 'All decided' : `${total - decided} left to decide`
  return [countLabel(inSpace.length), decluttering, `Scanned ${scannedDay(space.savedAt)}`].filter(Boolean).join(' · ')
}

function SpaceRow({ space, failed, onOpen }) {
  return (
    <ListItem
      label={space.spaceName}
      description={status(space, failed)}
      startContent={space.cover ? <img className="inventory-crop" src={space.cover} alt="" /> : <span className="inventory-crop" />}
      onClick={onOpen}
    />
  )
}

/** Every Space on this phone, and the way to scan another. */
export default function SpacesPage({ spaces, failed, processing, onOpen, onScanAnother, onAsk }) {
  return (
    <VStack gap={4} padding={4} className="inventory">
      <HStack gap={2} vAlign="center" hAlign="between">
        <Heading level={1}>Your Spaces</Heading>
        <Button label="Scan another Space" size="sm" isDisabled={processing} onClick={onScanAnother} />
      </HStack>
      <List hasDividers edge="flush">
        {spaces.map(space => <SpaceRow key={space.id} space={space} failed={failed[space.id]} onOpen={() => onOpen(space.id)} />)}
      </List>
      {processing && <Text as="p" color="secondary" justify="center">You can scan another Space when this one finishes.</Text>}
      {spaces.some(s => s.result) && <Button label="Ask Muse about all Spaces" variant="primary" size="lg" onClick={onAsk} />}
      {spaces.some(s => s.result) && <Text as="p" color="secondary" justify="center">Open a Space to declutter it.</Text>}
    </VStack>
  )
}
