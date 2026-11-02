import { useEffect, useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { List, ListItem } from '@astryxdesign/core/List'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { countLabel, scannedDay, sortItems } from './spaceItems.js'
import './Inventory.css'

function status(space, failed) {
  if (failed) return "Couldn't finish. Tap to try again."
  if (!space.result) return 'Finding items…'
  return `${countLabel(sortItems(space).inSpace.length)} · Scanned ${scannedDay(space.savedAt)}`
}

function SpaceRow({ space, failed, onOpen }) {
  const [photo, setPhoto] = useState(null)
  const frame = space.frames[0]
  useEffect(() => {
    if (!frame) return
    const url = URL.createObjectURL(frame)
    setPhoto(url)
    return () => URL.revokeObjectURL(url)
  }, [frame])
  return (
    <ListItem
      label={space.spaceName}
      description={status(space, failed)}
      startContent={photo ? <img className="inventory-crop" src={photo} alt="" /> : <span className="inventory-crop" />}
      onClick={onOpen}
    />
  )
}

/** Every Space on this phone, and the way to scan another. */
export default function SpacesPage({ spaces, failed, processing, onOpen, onScanAnother, onAsk, onDeclutter }) {
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
      {spaces.some(s => s.result) && <Button label="Declutter" variant="primary" size="lg" onClick={onDeclutter} />}
      {spaces.some(s => s.result) && <Button label="Ask Muse about all Spaces" size="lg" onClick={onAsk} />}
    </VStack>
  )
}
