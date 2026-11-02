import { useRef } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Heading } from '@astryxdesign/core/Heading'
import { Spinner } from '@astryxdesign/core/Spinner'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { shrinkPhoto } from './api.js'
import './Inventory.css'

/** After each part of a Space is scanned: scan another part, add photos, or finish. Earlier parts process meanwhile. */
export default function MoreParts({ space, parts, onScanAnother, onAddPhotos, onDone }) {
  const input = useRef(null)
  const working = !space.result || Boolean(space.addFrames)

  async function addFromLibrary(event) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    onAddPhotos((await Promise.all(files.map(f => shrinkPhoto(f).catch(() => null)))).filter(Boolean))
  }

  return (
    <Center className="inventory-center" padding={6}>
      <VStack gap={5} className="space-picker">
        <VStack gap={1}>
          <Heading level={1}>Is there more to {space.spaceName}?</Heading>
          <Text as="p" color="secondary">
            {parts === 1 ? 'You scanned 1 part.' : `You scanned ${parts} parts.`} If you couldn't see everything from there, scan another part from a new spot.
          </Text>
        </VStack>
        {working && (
          <HStack gap={2} vAlign="center" role="status">
            <Spinner size="md" />
            <Text color="secondary">Finding items in what you've scanned so far.</Text>
          </HStack>
        )}
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={addFromLibrary} />
        <VStack gap={2}>
          <Button label="Scan another part" size="lg" onClick={onScanAnother} />
          <Button label="Add photos" size="lg" onClick={() => input.current?.click()} />
          <Button label="Done" variant="primary" size="lg" onClick={onDone} />
        </VStack>
      </VStack>
    </Center>
  )
}
